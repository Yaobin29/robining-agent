# Robining Agent

Robining Agent 是一个面向 Agent 构建者的可移植、本地优先编排框架。它把用户意图转成可检查的执行路线，并将宿主运行时、工具桥接与私有数据彼此隔离。

## 核心思想

- 六大语义桶：`core`、`capabilities`、`template`、`projects`、`outputs`、`local-runtime`。
- 三层洋葱架构：宿主适配层 → Robining 编排层 → 工具桥接/后端。
- 明确的问题类型：`WHY`、`HOW`、`MIX`。
- 明确的证据状态：`ok`、`partial`、`blocked`。
- 不需要凭据、个人记忆、机器状态或真实项目数据即可运行最小内核。
- 核心 Agent 规范位于 `core/agent.md`，GitHub Agent 入口位于 `.github/agents/robining-agent.agent.md`。

## 快速开始

```bash
npm install
npm run build
npm link
robining doctor
robining
```

npm 正式发布后，也可以直接使用 `npm install -g robining-agent` 全局安装。

本地开发：

```bash
npm install
npm run build
```

模型调用需要配置供应商凭据：

```bash
ROBINING_PROVIDER=openai-compatible OPENAI_API_KEY=... robining
# 或
ROBINING_PROVIDER=anthropic ANTHROPIC_API_KEY=... robining
```

路由内核和测试：

```bash
python3 -m capabilities.robining_agent.cli route --role reusable-capability --lifecycle live --reuse-scope repo-wide --privacy public
python3 -m capabilities.robining_agent.cli classify --text "为什么测量结果发生变化？"
python3 -m unittest discover -s template/tests
npm test
```

## CLI 命令

```text
robining                         交互式 REPL
robining run --prompt <text>      执行一次 headless 任务
robining resume <id> --prompt <text> 继续会话
robining sessions                 列出本地会话
robining doctor                   检查运行时和模型配置
```

第一版采用 Node 兼容的 TypeScript，不依赖 Bun 专属 API，因此可以在 Bun
下运行；CI 会使用 Bun 再次执行构建和测试。

## 目录结构

| 目录 | 用途 |
|---|---|
| `core/` | 公开宪法与路由规则 |
| `capabilities/` | 编排、契约与公开 skills |
| `template/` | 示例与测试 |
| `projects/example/` | 匿名示例项目 |
| `outputs/` | 输出协议占位 |
| `local-runtime/` | 运行态接口占位 |

## 范围与限制

本仓库提供路由契约和可移植编排逻辑，不包含 LLM、求解器、MCP 凭据、个人记忆或特定宿主运行时。

## 许可证

本版本的原创内容采用 MIT。第三方材料必须保留其原始许可证，详见 `NOTICE` 和 `provenance-and-license-matrix.md`。
