import {chmodSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import path from "node:path";

export type ConfiguredProvider = "deepseek" | "kimi" | "glm" | "openai-compatible" | "anthropic";

export interface LocalConfig {
  provider?: ConfiguredProvider;
  model?: string;
  openaiBaseUrl?: string;
}

export interface LocalAuth {
  provider?: ConfiguredProvider;
  apiKey?: string;
}

export function configPath(): string {
  return process.env.XDG_CONFIG_HOME ? path.join(process.env.XDG_CONFIG_HOME, "robining-agent", "config.json") : path.join(process.env.HOME ?? process.cwd(), ".config", "robining-agent", "config.json");
}

export function authPath(): string {
  return path.join(path.dirname(configPath()), "auth.json");
}

export function loadConfig(): LocalConfig {
  try {
    return JSON.parse(readFileSync(configPath(), "utf8")) as LocalConfig;
  } catch {
    return {};
  }
}

export function loadAuth(): LocalAuth {
  try {
    return JSON.parse(readFileSync(authPath(), "utf8")) as LocalAuth;
  } catch {
    return {};
  }
}

function writePrivateJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), {recursive: true, mode: 0o700});
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600});
  chmodSync(filePath, 0o600);
}

export function saveConfig(config: LocalConfig): void {
  writePrivateJson(configPath(), config);
}

export function saveAuth(auth: LocalAuth): void {
  writePrivateJson(authPath(), auth);
}
