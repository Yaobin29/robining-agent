import assert from "node:assert/strict";
import {mkdtempSync, statSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {test} from "node:test";
import {AgentRuntime} from "../src/agent.js";
import {authPath, configPath, saveAuth, saveConfig} from "../src/config.js";
import {classifyIntent} from "../src/intent.js";
import {ensureMarkdown, renderMarkdown} from "../src/markdown.js";
import {AnthropicProvider, OpenAICompatibleProvider, PROVIDER_PRESETS, type LLMProvider} from "../src/providers.js";
import {routeTask} from "../src/router.js";
import {createTools} from "../src/tools.js";
import type {ModelRequest} from "../src/types.js";

test("classifies WHY, HOW, and MIX", () => {
  assert.equal(classifyIntent("Why did the run fail?"), "WHY");
  assert.equal(classifyIntent("How do I build this?"), "HOW");
  assert.equal(classifyIntent("Why did it fail and how can I fix it?"), "MIX");
  assert.equal(classifyIntent("为什么失败，应该如何修复？"), "MIX");
});

test("routes a TaskBrief through the Robin layer", () => {
  const route = routeTask({goal: "x", type: "MIX", constraints: [], inputs: [], requested_outputs: []});
  assert.equal(route.capability, "orchestration");
  assert.equal(route.bucket, "core");
  assert.ok(route.verification_gates.length > 0);
});

test("routes project, output, and private-state requests to the right buckets", () => {
  assert.equal(routeTask({goal: "read the project experiment file", type: "HOW", constraints: [], inputs: [], requested_outputs: []}).bucket, "projects");
  assert.equal(routeTask({goal: "write a final report", type: "HOW", constraints: [], inputs: [], requested_outputs: []}).bucket, "outputs");
  assert.equal(routeTask({goal: "update the local config token", type: "HOW", constraints: [], inputs: [], requested_outputs: []}).bucket, "local-runtime");
});

test("formats plain answers as Markdown and renders Markdown structure", () => {
  const markdown = ensureMarkdown("A short answer.", "WHY");
  assert.match(markdown, /^## Why/);
  assert.match(renderMarkdown("## Evidence\n\n- observed", "WHY"), /Evidence/);
});

test("blocks when no provider is configured", async () => {
  const summary = await new AgentRuntime({provider: undefined}).run("Explain this");
  assert.equal(summary.status, "blocked");
  assert.match(summary.message ?? "", /No model provider/);
});

test("read tool stays inside the project root", async () => {
  const read = createTools().find((tool) => tool.name === "read");
  assert.ok(read);
  const result = await read.execute({id: "1", name: "read", input: {path: "../../etc/passwd"}}, {root: process.cwd(), confirm: async () => false});
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /outside the project root/);
});

test("setup presets include common providers", () => {
  assert.deepEqual(PROVIDER_PRESETS.slice(0, 3).map((preset) => preset.id), ["deepseek", "kimi", "glm"]);
});

test("local setup writes preferences and auth with private permissions", () => {
  const previous = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = mkdtempSync(path.join(os.tmpdir(), "robining-test-"));
  saveConfig({provider: "deepseek", model: "deepseek-v4-flash", openaiBaseUrl: "https://api.deepseek.com"});
  saveAuth({provider: "deepseek", apiKey: "test-only-key"});
  assert.equal(statSync(configPath()).mode & 0o777, 0o600);
  assert.equal(statSync(authPath()).mode & 0o777, 0o600);
  if (previous === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = previous;
});

class ToolLoopProvider implements LLMProvider {
  readonly name = "test";
  readonly model = "test-model";
  readonly requests: ModelRequest[] = [];
  private turn = 0;

  async *stream(request: ModelRequest) {
    this.requests.push(request);
    if (this.turn++ === 0) yield {type: "tool_call" as const, call: {id: "call-read-1", name: "read", input: {path: "sample.txt"}}};
    else yield {type: "text" as const, text: "The file was read successfully."};
    yield {type: "done" as const};
  }
}

test("tool loop preserves assistant calls and matching tool results", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "robining-tool-loop-"));
  const {writeFileSync} = await import("node:fs");
  writeFileSync(path.join(root, "sample.txt"), "fixture");
  const provider = new ToolLoopProvider();
  const session = {id: "tool-loop-session", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [] as Array<{role: "user" | "assistant" | "tool"; content: string; toolCallId?: string; toolCalls?: Array<{id: string; name: string; input: Record<string, unknown>}>}>};
  const summary = await new AgentRuntime({root, provider, session}).run("Read sample.txt and summarize it");
  assert.equal(summary.status, "ok");
  assert.equal(summary.intent, "HOW");
  assert.equal(summary.route?.bucket, "projects");
  assert.equal(provider.requests.length, 2);
  const assistant = provider.requests[1].messages.find((message) => message.role === "assistant");
  const tool = provider.requests[1].messages.find((message) => message.role === "tool");
  assert.equal(assistant?.toolCalls?.[0]?.id, "call-read-1");
  assert.equal(tool?.toolCallId, "call-read-1");
  assert.equal(session.messages.find((message) => message.role === "assistant")?.toolCalls?.[0]?.id, "call-read-1");
  assert.equal(session.messages.find((message) => message.role === "tool")?.toolCallId, "call-read-1");
});

test("one runtime keeps the same session until a new session is requested", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "robining-session-loop-"));
  const provider = new ToolLoopProvider();
  const runtime = new AgentRuntime({root, provider});
  const first = await runtime.run("Read sample.txt");
  const firstId = runtime.sessionId;
  await runtime.run("Please continue");
  assert.equal(runtime.sessionId, firstId);
  assert.ok(provider.requests.at(-1)?.messages.filter((message) => message.role === "user").length === 2);
  const fresh = await runtime.newSession();
  assert.notEqual(fresh.id, firstId);
  assert.equal(runtime.sessionId, fresh.id);
  assert.equal(first.sessionId, firstId);
});

test("OpenAI-compatible provider serializes tool calls and exposes safe error details", async () => {
  const originalFetch = globalThis.fetch;
  let captured: any;
  globalThis.fetch = async (_url, init) => {
    captured = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({error: {message: "invalid tool sequence sk-secret-value"}}), {status: 400, headers: {"content-type": "application/json"}});
  };
  try {
    const provider = new OpenAICompatibleProvider("test", "unused", "https://example.test/v1");
    const events = [];
    for await (const event of provider.stream({system: "system", model: "test", tools: [], messages: [
      {role: "user", content: "read"},
      {role: "assistant", content: "", toolCalls: [{id: "call-1", name: "read", input: {path: "a.txt"}}]},
      {role: "tool", content: "ok", toolCallId: "call-1"},
    ]})) events.push(event);
    assert.equal(captured.messages[3].tool_call_id, "call-1");
    assert.equal(captured.messages[2].tool_calls[0].function.arguments, '{"path":"a.txt"}');
    assert.match(events[0].type === "error" ? events[0].error : "", /invalid tool sequence/);
    assert.doesNotMatch(events[0].type === "error" ? events[0].error : "", /sk-secret/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Anthropic provider serializes tool_use and tool_result blocks", async () => {
  const originalFetch = globalThis.fetch;
  let captured: any;
  globalThis.fetch = async (_url, init) => {
    captured = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({content: [{type: "text", text: "done"}]}), {status: 200, headers: {"content-type": "application/json"}});
  };
  try {
    const provider = new AnthropicProvider("test", "unused");
    for await (const _event of provider.stream({system: "system", model: "test", tools: [], messages: [
      {role: "assistant", content: "", toolCalls: [{id: "call-1", name: "read", input: {path: "a.txt"}}]},
      {role: "tool", content: "ok", toolCallId: "call-1"},
    ]})) { /* consume */ }
    assert.equal(captured.messages[0].content[0].type, "tool_use");
    assert.equal(captured.messages[1].content[0].tool_use_id, "call-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
