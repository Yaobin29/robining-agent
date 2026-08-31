import type {RoutePlan, TaskBrief} from "./types.js";

export const BUCKETS = ["core", "capabilities", "template", "projects", "outputs", "local-runtime"] as const;

export function routeTask(task: TaskBrief): RoutePlan {
  const goal = task.goal.toLowerCase();
  let bucket: RoutePlan["bucket"] = "core";
  let reason = "general reasoning and reusable rules";
  if (/private|secret|credential|token|auth|config|log|session|runtime|记忆|密钥|配置/.test(goal)) {
    bucket = "local-runtime";
    reason = "contains local state, configuration, authentication, or working memory concerns";
  } else if (/report|export|deliverable|output|summary|报告|导出|结果/.test(goal)) {
    bucket = "outputs";
    reason = "asks for a result or artifact that can leave the workflow";
  } else if (/skill|tool|adapter|capabilit|工具|技能|适配/.test(goal)) {
    bucket = "capabilities";
    reason = "asks for reusable execution logic or an integration";
  } else if (/template|example|fixture|scaffold|模板|示例/.test(goal)) {
    bucket = "template";
    reason = "asks for a reusable example or starter scaffold";
  } else if (/project|research|experiment|data|file|项目|研究|实验|数据|文件|\.(md|txt|json|csv|ts|py)\b/.test(goal)) {
    bucket = "projects";
    reason = "works on active project source or input material";
  }
  const capability = task.type === "WHY" ? "analysis" : task.type === "MIX" ? "orchestration" : "execution";
  return {
    bucket,
    reason,
    capability,
    adapter: "host-neutral",
    backend_candidates: ["configured-provider", "local-tool-bridge"],
    verification_gates: ["separate evidence from interpretation", "report missing backends truthfully"],
  };
}
