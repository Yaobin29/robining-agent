# Robining Agent

Robining Agent is a portable, local-first orchestration framework for Agent builders.
It turns an intent into a small, inspectable route while keeping host runtimes,
tool bridges, and private data separate.

## Robining Agent 是什么

Robining Agent 是一个面向 Agent 构建者的可移植、本地优先编排框架：把用户意图转成可检查的执行路线，并把宿主运行时、工具桥接和私有数据彼此隔离。

## Core ideas / 核心思想

- Six semantic buckets: `core`, `capabilities`, `template`, `projects`, `outputs`, `local-runtime`.
- Three-layer onion: host adapter → Robin orchestration → tool bridge/backend.
- Explicit intent types: `WHY`, `HOW`, and `MIX`.
- Evidence states: `ok`, `partial`, and `blocked`.
- No credentials, personal memory, machine state, or project data are required.

## Quick start / 快速开始

```bash
python3 -m capabilities.robining_agent.cli route --role reusable-capability --lifecycle live --reuse-scope repo-wide --privacy public
python3 -m capabilities.robining_agent.cli classify --text "Why did the measurement change?"
python3 -m unittest discover -s template/tests
```

## Repository map / 目录

```text
core/                         Constitution and routing rules / 宪法与路由规则
capabilities/                 Orchestration, contracts, and public skills / 编排、契约与公开 skills
template/                     Examples and tests / 示例与测试
projects/example/             Anonymous example only / 仅匿名示例
outputs/                      Output protocol placeholder / 输出协议占位
local-runtime/                Runtime interface placeholder / 运行态接口占位
```

## Scope and limitations / 范围与限制

This repository provides routing contracts and portable orchestration logic. It does not bundle an LLM, solver, MCP credentials, personal memory, or a specific host runtime.

本仓库提供路由契约和可移植编排逻辑，不包含 LLM、求解器、MCP 凭据、个人记忆或特定宿主运行时。

## License

Original material in this release is MIT licensed. Third-party material must retain its original license; see `NOTICE` and `provenance-and-license-matrix.md`.
