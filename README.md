# Robining Agent

Chinese documentation: [README.zh-CN.md](README.zh-CN.md)

Robining Agent is a portable, local-first orchestration framework for Agent builders.
It turns an intent into a small, inspectable route while keeping host runtimes,
tool bridges, and private data separate.

## Core ideas

- Six semantic buckets: `core`, `capabilities`, `template`, `projects`, `outputs`, `local-runtime`.
- Three-layer onion: host adapter → Robin orchestration → tool bridge/backend.
- Explicit intent types: `WHY`, `HOW`, and `MIX`.
- Evidence states: `ok`, `partial`, and `blocked`.
- Core agent specification: [`core/agent.md`](core/agent.md), with a GitHub Agent entry at [`.github/agents/robining-agent.agent.md`](.github/agents/robining-agent.agent.md).
- No credentials, personal memory, machine state, or project data are required.

## Quick start

```bash
npm install
npm run build
npm link
robining doctor
robining
```

After the npm release is published, the same CLI can be installed globally with
`npm install -g robining-agent`.

On the first run, use the guided setup once:

```bash
robining setup
robining
```

The wizard supports DeepSeek, Kimi (Moonshot), GLM (Zhipu), OpenAI-compatible
endpoints, and Anthropic. Provider preferences are stored in `config.json` and
the API key is stored separately in a user-only `auth.json` (directory mode
`0700`, file mode `0600`). Environment variables always take precedence.

For local development:

```bash
npm install
npm run build
```

The CLI requires a provider key only for model-backed runs. You can use
`robining setup` or configure environment variables directly:

| Provider | `ROBINING_PROVIDER` | Key | Default model | Default base URL |
| --- | --- | --- | --- | --- |
| DeepSeek | `deepseek` | `DEEPSEEK_API_KEY` | `deepseek-v4-flash` | `https://api.deepseek.com` |
| Kimi | `kimi` | `KIMI_API_KEY` or `MOONSHOT_API_KEY` | `kimi-k2.5` | `https://api.moonshot.cn/v1` |
| GLM | `glm` | `GLM_API_KEY` or `ZHIPU_API_KEY` | `glm-4.5` | `https://open.bigmodel.cn/api/paas/v4` |
| OpenAI-compatible | `openai-compatible` | `OPENAI_API_KEY` | `gpt-4o-mini` | `https://api.openai.com/v1` |
| Anthropic | `anthropic` | `ANTHROPIC_API_KEY` | `claude-3-5-sonnet-latest` | Anthropic API |

For any OpenAI-compatible provider, `OPENAI_BASE_URL` and `OPENAI_MODEL` can
override the preset. Never commit `auth.json` or put an API key in a public
issue, log, or repository file.

```bash
python3 -m capabilities.robining_agent.cli route --role reusable-capability --lifecycle live --reuse-scope repo-wide --privacy public
python3 -m capabilities.robining_agent.cli classify --text "Why did the measurement change?"
python3 -m unittest discover -s template/tests
npm test
```

## CLI commands

```text
robining                         interactive REPL
robining setup                   guided provider setup
robining run --prompt <text>      one headless task
robining resume <id> --prompt <text>
robining sessions                 list saved sessions
robining doctor                   inspect runtime and provider setup
```

The first release uses Node-compatible TypeScript and runs on Bun without
Bun-specific APIs. A Bun CI job verifies the same build and test scripts.

## Repository map

```text
core/                         Constitution and routing rules
capabilities/                 Orchestration, contracts, and public skills
template/                     Examples and tests
projects/example/             Anonymous example only
outputs/                      Output protocol placeholder
local-runtime/                Runtime interface placeholder
```

## Scope and limitations

This repository provides routing contracts and portable orchestration logic. It does not bundle an LLM, solver, MCP credentials, personal memory, or a specific host runtime.

## License

Original material in this release is MIT licensed. Third-party material must retain its original license; see `NOTICE` and `provenance-and-license-matrix.md`.
