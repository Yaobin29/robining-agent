import {spawn} from "node:child_process";
import {promises as fs} from "node:fs";
import path from "node:path";
import type {ToolCall, ToolResult} from "./types.js";

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(call: ToolCall, context: ToolContext): Promise<ToolResult>;
}

export interface ToolContext {
  root: string;
  confirm: (message: string) => Promise<boolean>;
}

function safePath(root: string, requested: string): string {
  const resolved = path.resolve(root, requested);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error("path is outside the project root");
  return resolved;
}

export function createTools(): Tool[] {
  return [
    {name: "read", description: "Read a UTF-8 file", inputSchema: {type: "object", properties: {path: {type: "string"}}, required: ["path"]}, async execute(call, context) {
      try { const file = safePath(context.root, String(call.input.path)); return {id: call.id, name: call.name, ok: true, output: (await fs.readFile(file, "utf8")).slice(0, 100_000)}; }
      catch (error) { return {id: call.id, name: call.name, ok: false, output: "", error: String(error)}; }
    }},
    {name: "write", description: "Write a UTF-8 file after confirmation", inputSchema: {type: "object", properties: {path: {type: "string"}, content: {type: "string"}}, required: ["path", "content"]}, async execute(call, context) {
      try { const file = safePath(context.root, String(call.input.path)); if (!await context.confirm(`Write ${path.relative(context.root, file)}?`)) return {id: call.id, name: call.name, ok: false, output: "", error: "user rejected write"}; await fs.mkdir(path.dirname(file), {recursive: true}); await fs.writeFile(file, String(call.input.content), "utf8"); return {id: call.id, name: call.name, ok: true, output: `wrote ${path.relative(context.root, file)}`}; }
      catch (error) { return {id: call.id, name: call.name, ok: false, output: "", error: String(error)}; }
    }},
    {name: "edit", description: "Replace text in a UTF-8 file after confirmation", inputSchema: {type: "object", properties: {path: {type: "string"}, oldText: {type: "string"}, newText: {type: "string"}}, required: ["path", "oldText", "newText"]}, async execute(call, context) {
      try { const file = safePath(context.root, String(call.input.path)); if (!await context.confirm(`Edit ${path.relative(context.root, file)}?`)) return {id: call.id, name: call.name, ok: false, output: "", error: "user rejected edit"}; const current = await fs.readFile(file, "utf8"); const oldText = String(call.input.oldText); if (!current.includes(oldText)) return {id: call.id, name: call.name, ok: false, output: "", error: "oldText not found"}; await fs.writeFile(file, current.replace(oldText, String(call.input.newText)), "utf8"); return {id: call.id, name: call.name, ok: true, output: `edited ${path.relative(context.root, file)}`}; }
      catch (error) { return {id: call.id, name: call.name, ok: false, output: "", error: String(error)}; }
    }},
    {name: "bash", description: "Run a shell command after confirmation", inputSchema: {type: "object", properties: {command: {type: "string"}}, required: ["command"]}, async execute(call, context) {
      const command = String(call.input.command);
      if (!await context.confirm(`Run shell command: ${command}?`)) return {id: call.id, name: call.name, ok: false, output: "", error: "user rejected command"};
      return await new Promise<ToolResult>((resolve) => { const child = spawn("/bin/sh", ["-lc", command], {cwd: context.root, env: process.env}); let output = ""; child.stdout.on("data", (chunk) => { output += chunk; }); child.stderr.on("data", (chunk) => { output += chunk; }); const timer = setTimeout(() => child.kill("SIGTERM"), 120_000); child.on("close", (code) => { clearTimeout(timer); resolve({id: call.id, name: call.name, ok: code === 0, output: output.slice(0, 100_000), error: code === 0 ? undefined : `command exited with ${code}`}); }); });
    }},
  ];
}
