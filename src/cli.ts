#!/usr/bin/env node
import {createInterface} from "node:readline/promises";
import {stdin as input, stdout as output} from "node:process";
import path from "node:path";
import {AgentRuntime} from "./agent.js";
import {providerFromEnv} from "./providers.js";
import {SessionStore} from "./session.js";
import {configPath} from "./config.js";

function argValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function help(): void {
  console.log(`Robining Agent\n\nUsage:\n  robining                         Start interactive mode\n  robining run --prompt <text>      Run one task\n  robining doctor                   Check runtime and provider setup\n  robining sessions                 List saved sessions\n  robining resume <session-id>      Continue a saved session\n\nOptions:\n  --root <path>                    Project root for tools\n  --yes                            Auto-approve write and shell tools\n  --json                           Emit the final summary as JSON`);
}

async function doctor(): Promise<number> {
  const provider = providerFromEnv();
  console.log(JSON.stringify({runtime: process.version, provider: provider?.name ?? null, model: provider?.model ?? null, configPath: configPath(), cwd: process.cwd()}, null, 2));
  if (!provider) console.error("No provider configured. Set ROBINING_PROVIDER and an API key.");
  return 0;
}

async function runTask(prompt: string, args: string[], session?: import("./session.js").SessionRecord): Promise<number> {
  const root = path.resolve(argValue(args, "--root") ?? process.cwd());
  const json = args.includes("--json");
  const autoApprove = args.includes("--yes");
  const rl = createInterface({input, output});
  const runtime = new AgentRuntime({root, provider: providerFromEnv(), session, confirm: async (message) => autoApprove || (await rl.question(`${message} [y/N] `)).toLowerCase() === "y", onEvent: (event) => { if (!json && event.type === "message") process.stdout.write(String(event.payload)); if (!json && event.type === "tool_call") console.log(`\n[tool] ${JSON.stringify(event.payload)}`); if (!json && event.type === "tool_result") console.log(`\n[result] ${JSON.stringify(event.payload)}`); }});
  const summary = await runtime.run(prompt);
  if (!json) console.log(`\n\n[${summary.status}] ${summary.message ?? ""}\nsession: ${summary.sessionId}`);
  else console.log(JSON.stringify(summary));
  await rl.close();
  return summary.status === "blocked" ? 4 : summary.status === "partial" ? 5 : 0;
}

async function interactive(): Promise<number> {
  const rl = createInterface({input, output});
  console.log("Robining Agent. Type /help for commands; /exit to quit.");
  const runtime = new AgentRuntime({provider: providerFromEnv(), confirm: async (message) => (await rl.question(`${message} [y/N] `)).toLowerCase() === "y", onEvent: (event) => { if (event.type === "message") process.stdout.write(String(event.payload)); if (event.type === "tool_call") console.log(`\n[tool] ${JSON.stringify(event.payload)}`); if (event.type === "tool_result") console.log(`\n[result] ${JSON.stringify(event.payload)}`); }});
  while (true) {
    const prompt = (await rl.question("\nrobining> ")).trim();
    if (!prompt) continue;
    if (prompt === "/exit" || prompt === "/quit") break;
    if (prompt === "/help") { help(); continue; }
    const summary = await runtime.run(prompt);
    console.log(`\n\n[${summary.status}] ${summary.message ?? ""}\nsession: ${summary.sessionId}`);
  }
  await rl.close();
  return 0;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) { help(); return 0; }
  const command = args[0];
  if (!command) return interactive();
  if (command === "doctor") return doctor();
  if (command === "sessions") { console.log(JSON.stringify(await new SessionStore().list(), null, 2)); return 0; }
  if (command === "run") { const prompt = argValue(args, "--prompt"); if (!prompt) { console.error("--prompt is required"); return 2; } return runTask(prompt, args); }
  if (command === "resume") { const id = args[1]; const prompt = argValue(args, "--prompt"); if (!id || !prompt) { console.error("usage: robining resume <session-id> --prompt <text>"); return 2; } try { const session = await new SessionStore().load(id); return runTask(prompt, args, session); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); return 2; } }
  help();
  return 2;
}

main().then((code) => process.exitCode = code).catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 5; });
