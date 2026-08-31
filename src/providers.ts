import type {ModelEvent, ModelRequest, ToolCall} from "./types.js";
import {loadAuth, loadConfig, type ConfiguredProvider} from "./config.js";

export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  stream(request: ModelRequest): AsyncIterable<ModelEvent>;
}

export interface ProviderPreset {
  id: ConfiguredProvider;
  label: string;
  protocol: "openai-compatible" | "anthropic";
  model: string;
  baseUrl?: string;
  keyEnv: string[];
}

export const PROVIDER_PRESETS: readonly ProviderPreset[] = [
  {id: "deepseek", label: "DeepSeek", protocol: "openai-compatible", model: "deepseek-v4-flash", baseUrl: "https://api.deepseek.com", keyEnv: ["DEEPSEEK_API_KEY", "OPENAI_API_KEY"]},
  {id: "kimi", label: "Kimi (Moonshot)", protocol: "openai-compatible", model: "kimi-k2.5", baseUrl: "https://api.moonshot.cn/v1", keyEnv: ["KIMI_API_KEY", "MOONSHOT_API_KEY", "OPENAI_API_KEY"]},
  {id: "glm", label: "GLM (Zhipu)", protocol: "openai-compatible", model: "glm-4.5", baseUrl: "https://open.bigmodel.cn/api/paas/v4", keyEnv: ["GLM_API_KEY", "ZHIPU_API_KEY", "OPENAI_API_KEY"]},
  {id: "openai-compatible", label: "OpenAI-compatible", protocol: "openai-compatible", model: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1", keyEnv: ["OPENAI_API_KEY"]},
  {id: "anthropic", label: "Anthropic", protocol: "anthropic", model: "claude-3-5-sonnet-latest", keyEnv: ["ANTHROPIC_API_KEY"]},
];

export function providerPreset(id: string | undefined): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((preset) => preset.id === id?.toLowerCase());
}

function parseToolCall(raw: any, fallbackId: string): ToolCall | undefined {
  const functionCall = raw?.function ?? raw;
  if (!functionCall?.name) return undefined;
  let input: Record<string, unknown> = {};
  try {
    input = typeof functionCall.arguments === "string" ? JSON.parse(functionCall.arguments) : (functionCall.arguments ?? {});
  } catch {
    return {id: raw?.id ?? fallbackId, name: functionCall.name, input: {raw: String(functionCall.arguments)}};
  }
  return {id: raw?.id ?? fallbackId, name: functionCall.name, input};
}

function redactProviderError(text: string): string {
  return text.replace(/sk-[A-Za-z0-9_-]{8,}/g, "[redacted]").replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]").slice(0, 800);
}

async function providerError(response: Response): Promise<string> {
  let detail = "";
  try { detail = redactProviderError(await response.text()); } catch { /* ignore unreadable error bodies */ }
  return `provider returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`;
}

function openAIMessages(request: ModelRequest): Array<Record<string, unknown>> {
  return [{role: "system", content: request.system}, ...request.messages.map((message) => {
    if (message.role === "tool") return {role: "tool", content: message.content, tool_call_id: message.toolCallId};
    if (message.role === "assistant" && message.toolCalls?.length) {
      return {role: "assistant", content: message.content || null, tool_calls: message.toolCalls.map((call) => ({id: call.id, type: "function", function: {name: call.name, arguments: JSON.stringify(call.input)}}))};
    }
    return {role: message.role, content: message.content};
  })];
}

function anthropicMessages(request: ModelRequest): Array<Record<string, unknown>> {
  return request.messages.map((message) => {
    if (message.role === "tool") return {role: "user", content: [{type: "tool_result", tool_use_id: message.toolCallId, content: message.content}]};
    if (message.role === "assistant" && message.toolCalls?.length) {
      const content: Array<Record<string, unknown>> = [];
      if (message.content) content.push({type: "text", text: message.content});
      content.push(...message.toolCalls.map((call) => ({type: "tool_use", id: call.id, name: call.name, input: call.input})));
      return {role: "assistant", content};
    }
    return {role: message.role, content: message.content};
  });
}

export class OpenAICompatibleProvider implements LLMProvider {
  constructor(readonly model: string, private readonly apiKey: string, private readonly baseUrl = "https://api.openai.com/v1", readonly name = "openai-compatible") {}

  async *stream(request: ModelRequest): AsyncIterable<ModelEvent> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {"content-type": "application/json", authorization: `Bearer ${this.apiKey}`},
      body: JSON.stringify({model: this.model, stream: false, messages: openAIMessages(request), tools: request.tools.map((tool) => ({type: "function", function: {name: tool.name, description: tool.description, parameters: tool.inputSchema}}))}),
    });
    if (!response.ok) {
      yield {type: "error", error: await providerError(response)};
      return;
    }
    const data: any = await response.json();
    const message = data?.choices?.[0]?.message;
    if (message?.content) yield {type: "text", text: String(message.content)};
    for (const [index, raw] of (message?.tool_calls ?? []).entries()) {
      const call = parseToolCall(raw, `call-${index}`);
      if (call) yield {type: "tool_call", call};
    }
    yield {type: "done"};
  }
}

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  constructor(readonly model: string, private readonly apiKey: string) {}

  async *stream(request: ModelRequest): AsyncIterable<ModelEvent> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {"content-type": "application/json", "x-api-key": this.apiKey, "anthropic-version": "2023-06-01"},
      body: JSON.stringify({model: this.model, max_tokens: 4096, system: request.system, messages: anthropicMessages(request), tools: request.tools.map((tool) => ({name: tool.name, description: tool.description, input_schema: tool.inputSchema}))}),
    });
    if (!response.ok) {
      yield {type: "error", error: await providerError(response)};
      return;
    }
    const data: any = await response.json();
    for (const [index, block] of (data?.content ?? []).entries()) {
      if (block?.type === "text") yield {type: "text", text: String(block.text)};
      if (block?.type === "tool_use") yield {type: "tool_call", call: {id: block.id ?? `call-${index}`, name: block.name, input: block.input ?? {}}};
    }
    yield {type: "done"};
  }
}

export function providerFromEnv(): LLMProvider | undefined {
  const config = loadConfig();
  const auth = loadAuth();
  const provider = (process.env.ROBINING_PROVIDER ?? config.provider ?? auth.provider ?? "openai-compatible").toLowerCase();
  const preset = providerPreset(provider) ?? providerPreset("openai-compatible")!;
  const key = preset.keyEnv.map((name) => process.env[name]).find(Boolean) ?? (auth.provider === provider || !auth.provider ? auth.apiKey : undefined);
  if (!key) return undefined;
  const model = process.env.OPENAI_MODEL ?? process.env.ANTHROPIC_MODEL ?? config.model ?? preset.model;
  if (preset.protocol === "anthropic") return new AnthropicProvider(model, key);
  const baseUrl = process.env.OPENAI_BASE_URL ?? config.openaiBaseUrl ?? preset.baseUrl;
  return new OpenAICompatibleProvider(model, key, baseUrl, preset.id);
}
