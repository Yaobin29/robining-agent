import type {ModelEvent, ModelRequest, ToolCall} from "./types.js";
import {loadConfig} from "./config.js";

export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  stream(request: ModelRequest): AsyncIterable<ModelEvent>;
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

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name = "openai-compatible";
  constructor(readonly model: string, private readonly apiKey: string, private readonly baseUrl = "https://api.openai.com/v1") {}

  async *stream(request: ModelRequest): AsyncIterable<ModelEvent> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {"content-type": "application/json", authorization: `Bearer ${this.apiKey}`},
      body: JSON.stringify({model: this.model, stream: false, messages: [{role: "system", content: request.system}, ...request.messages.map((message) => message.role === "tool" ? {role: "tool", content: message.content, tool_call_id: message.toolCallId} : {role: message.role, content: message.content})], tools: request.tools.map((tool) => ({type: "function", function: {name: tool.name, description: tool.description, parameters: tool.inputSchema}}))}),
    });
    if (!response.ok) {
      yield {type: "error", error: `provider returned HTTP ${response.status}`};
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
      body: JSON.stringify({model: this.model, max_tokens: 4096, system: request.system, messages: request.messages.map((message) => message.role === "tool" ? {role: "user", content: `Tool result (${message.toolCallId ?? "unknown"}): ${message.content}`} : {role: message.role, content: message.content}), tools: request.tools.map((tool) => ({name: tool.name, description: tool.description, input_schema: tool.inputSchema}))}),
    });
    if (!response.ok) {
      yield {type: "error", error: `provider returned HTTP ${response.status}`};
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
  const provider = (process.env.ROBINING_PROVIDER ?? config.provider ?? "openai-compatible").toLowerCase();
  if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return new AnthropicProvider(process.env.ANTHROPIC_MODEL ?? config.model ?? "claude-3-5-sonnet-latest", process.env.ANTHROPIC_API_KEY);
  }
  if ((provider === "openai" || provider === "openai-compatible") && process.env.OPENAI_API_KEY) {
    return new OpenAICompatibleProvider(process.env.OPENAI_MODEL ?? config.model ?? "gpt-4o-mini", process.env.OPENAI_API_KEY, process.env.OPENAI_BASE_URL ?? config.openaiBaseUrl);
  }
  return undefined;
}
