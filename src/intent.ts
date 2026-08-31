import type {IntentType} from "./types.js";

export function classifyIntent(text: string): IntentType {
  const value = text.toLowerCase();
  const why = /\b(why|cause|reason|mechanism|failure|explain|because)\b|为什么|为何|原因|机制|原理|失效|解释/.test(value);
  const how = /\b(how|implement|build|fix|optimi[sz]e|steps?|configure|setup|plan)\b|如何|怎么|怎样|实现|构建|修复|优化|步骤|配置|方案|计划/.test(value);
  if (why && how) return "MIX";
  if (why) return "WHY";
  return "HOW";
}
