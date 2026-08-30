import type {RoutePlan, TaskBrief} from "./types.js";

export const BUCKETS = ["core", "capabilities", "template", "projects", "outputs", "local-runtime"] as const;

export function routeTask(task: TaskBrief): RoutePlan {
  const capability = task.type === "WHY" ? "analysis" : task.type === "MIX" ? "orchestration" : "execution";
  return {
    capability,
    adapter: "host-neutral",
    backend_candidates: ["configured-provider", "local-tool-bridge"],
    verification_gates: ["separate evidence from interpretation", "report missing backends truthfully"],
  };
}
