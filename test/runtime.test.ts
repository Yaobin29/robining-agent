import assert from "node:assert/strict";
import {test} from "node:test";
import {AgentRuntime} from "../src/agent.js";
import {classifyIntent} from "../src/intent.js";
import {routeTask} from "../src/router.js";
import {createTools} from "../src/tools.js";

test("classifies WHY, HOW, and MIX", () => {
  assert.equal(classifyIntent("Why did the run fail?"), "WHY");
  assert.equal(classifyIntent("How do I build this?"), "HOW");
  assert.equal(classifyIntent("Why did it fail and how can I fix it?"), "MIX");
});

test("routes a TaskBrief through the Robin layer", () => {
  const route = routeTask({goal: "x", type: "MIX", constraints: [], inputs: [], requested_outputs: []});
  assert.equal(route.capability, "orchestration");
  assert.ok(route.verification_gates.length > 0);
});

test("blocks when no provider is configured", async () => {
  const summary = await new AgentRuntime({provider: undefined}).run("Explain this");
  assert.equal(summary.status, "blocked");
  assert.match(summary.message ?? "", /No model provider/);
});

test("read tool stays inside the project root", async () => {
  const read = createTools().find((tool) => tool.name === "read");
  assert.ok(read);
  const result = await read.execute({id: "1", name: "read", input: {path: "../../etc/passwd"}}, {root: process.cwd(), confirm: async () => false});
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /outside the project root/);
});
