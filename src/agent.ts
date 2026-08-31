import {classifyIntent} from "./intent.js";
import {routeTask} from "./router.js";
import type {LLMProvider} from "./providers.js";
import {createTools, type Tool, type ToolContext} from "./tools.js";
import {SessionStore, type SessionRecord} from "./session.js";
import type {AgentEvent, ModelRequest, RunSummary, TaskBrief, ToolResult} from "./types.js";

const SYSTEM_PROMPT = `You are Robining Agent, a local-first orchestration agent.
Classify each request as WHY, HOW, or MIX. Respect the six semantic buckets.
Use tools only when needed. Separate observed evidence, proxy interpretation,
assumptions, limitations, and unresolved claims. Never invent tool output or
validation. Private data stays local.`;

export interface AgentOptions {
  root?: string;
  provider?: LLMProvider;
  confirm?: ToolContext["confirm"];
  onEvent?: (event: AgentEvent) => void;
  maxTurns?: number;
  session?: SessionRecord;
}

export class AgentRuntime {
  private readonly tools: Tool[];
  private readonly sessions: SessionStore;

  constructor(private readonly options: AgentOptions = {}) {
    this.tools = createTools();
    this.sessions = new SessionStore();
  }

  async run(prompt: string): Promise<RunSummary> {
    const provider = this.options.provider;
    const session = this.options.session ?? await this.sessions.create();
    const type = classifyIntent(prompt);
    const task: TaskBrief = {goal: prompt, type, constraints: [], inputs: [], requested_outputs: ["RunSummary", "EvidenceReport"]};
    const route = routeTask(task);
    const messages: ModelRequest["messages"] = session.messages.map((message) => ({
      role: message.role,
      content: message.content,
      ...(message.toolCallId ? {toolCallId: message.toolCallId} : {}),
      ...(message.toolCalls ? {toolCalls: message.toolCalls} : {}),
    }));
    await this.sessions.append(session, {role: "user", content: prompt});
    if (!provider) return this.finish(session, {status: "blocked", artifacts: [], assumptions: ["No model provider was configured"], limits: ["Set ROBINING_PROVIDER and the corresponding API key"], message: "No model provider configured.", sessionId: session.id});

    messages.push({role: "user", content: prompt});
    const context: ToolContext = {root: this.options.root ?? process.cwd(), confirm: this.options.confirm ?? (async () => false)};
    const maxTurns = this.options.maxTurns ?? 8;
    let lastText = "";
    for (let turn = 0; turn < maxTurns; turn += 1) {
      const request: ModelRequest = {system: `${SYSTEM_PROMPT}\nSelected capability: ${route.capability}.`, messages, model: provider.model, tools: this.tools.map((tool) => ({name: tool.name, description: tool.description, inputSchema: tool.inputSchema}))};
      const toolCalls: Array<{id: string; name: string; input: Record<string, unknown>}> = [];
      let text = "";
      let failed: string | undefined;
      for await (const event of provider.stream(request)) {
        if (event.type === "text") { text += event.text; this.options.onEvent?.({type: "message", payload: event.text}); }
        if (event.type === "tool_call") { toolCalls.push(event.call); this.options.onEvent?.({type: "tool_call", payload: event.call}); }
        if (event.type === "error") failed = event.error;
      }
      if (text || toolCalls.length) {
        if (text) lastText = text;
        const assistantMessage = {role: "assistant" as const, content: text, ...(toolCalls.length ? {toolCalls} : {})};
        messages.push(assistantMessage);
        await this.sessions.append(session, assistantMessage);
      }
      if (failed) return this.finish(session, {status: "blocked", artifacts: [], assumptions: [], limits: [failed], message: failed, sessionId: session.id});
      if (!toolCalls.length) return this.finish(session, {status: "ok", artifacts: [], assumptions: [], limits: [], message: lastText, sessionId: session.id});
      for (const call of toolCalls) {
        const tool = this.tools.find((candidate) => candidate.name === call.name);
        const result: ToolResult = tool ? await tool.execute(call, context) : {id: call.id, name: call.name, ok: false, output: "", error: "unknown tool"};
        this.options.onEvent?.({type: "tool_result", payload: result});
        const toolMessage = {role: "tool" as const, content: JSON.stringify(result), toolCallId: call.id};
        messages.push(toolMessage);
        await this.sessions.append(session, toolMessage);
      }
    }
    return this.finish(session, {status: "partial", artifacts: [], assumptions: [], limits: [`turn limit reached (${maxTurns})`], message: lastText, sessionId: session.id});
  }

  private async finish(session: SessionRecord, summary: RunSummary): Promise<RunSummary> {
    await this.sessions.save(session);
    return summary;
  }
}
