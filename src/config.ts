import {readFileSync} from "node:fs";
import path from "node:path";

export interface LocalConfig {
  provider?: "openai-compatible" | "anthropic";
  model?: string;
  openaiBaseUrl?: string;
}

export function configPath(): string {
  return process.env.XDG_CONFIG_HOME ? path.join(process.env.XDG_CONFIG_HOME, "robining-agent", "config.json") : path.join(process.env.HOME ?? process.cwd(), ".config", "robining-agent", "config.json");
}

export function loadConfig(): LocalConfig {
  try {
    return JSON.parse(readFileSync(configPath(), "utf8")) as LocalConfig;
  } catch {
    return {};
  }
}
