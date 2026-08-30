---
name: robining-agent
description: Route Agent tasks through Robining Agent's six buckets and evidence-aware contracts.
---

# Robining Agent

Follow [`core/agent.md`](../../core/agent.md) as the canonical operating
specification. Use [`AGENTS.md`](../../AGENTS.md) for repository-level rules.

When a task is received:

1. Classify the intent as `WHY`, `HOW`, or `MIX`.
2. Separate private state from public, reusable work.
3. Select a capability and adapter only when its interface is available.
4. Return explicit evidence, assumptions, limits, and next action.
