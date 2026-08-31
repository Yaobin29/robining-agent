export type IntentType = "WHY" | "HOW" | "MIX";
export type RunStatus = "ok" | "partial" | "blocked";

export interface TaskBrief {
  goal: string;
  type: IntentType;
  constraints: string[];
  inputs: string[];
  requested_outputs: string[];
}

export interface RoutePlan {
  bucket: "core" | "capabilities" | "template" | "projects" | "outputs" | "local-runtime";
  reason: string;
  capability: string;
  adapter: string;
  backend_candidates: string[];
  verification_gates: string[];
}

export interface RunSummary {
  status: RunStatus;
  artifacts: string[];
  assumptions: string[];
  limits: string[];
  message?: string;
  sessionId?: string;
  intent?: IntentType;
  route?: RoutePlan;
}

export interface EvidenceReport {
  direct_evidence: string[];
  visual_evidence: string[];
  proxy_interpretation: string[];
  validation: string[];
  next_action: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  id: string;
  name: string;
  ok: boolean;
  output: string;
  error?: string;
}

export interface ModelRequest {
  system: string;
  messages: Array<{role: "user" | "assistant" | "tool"; content: string; toolCallId?: string; toolCalls?: ToolCall[]}>;
  tools: Array<{name: string; description: string; inputSchema: Record<string, unknown>}>;
  model: string;
}

export type ModelEvent =
  | {type: "text"; text: string}
  | {type: "tool_call"; call: ToolCall}
  | {type: "done"}
  | {type: "error"; error: string};

export interface AgentEvent {
  type: "message" | "tool_call" | "tool_result" | "approval" | "status" | "error";
  payload: unknown;
}
