import type {IntentType} from "./types.js";

export function classifyIntent(text: string): IntentType {
  const value = text.toLowerCase();
  const why = /\b(why|cause|reason|mechanism|failure|explain)\b/.test(value);
  const how = /\b(how|implement|build|fix|optimi[sz]e|steps?)\b/.test(value);
  if (why && how) return "MIX";
  if (why) return "WHY";
  return "HOW";
}
