# Seris — HELIOS native assimilation (NATIVE11)

Upstream: [aowang-ai/seris](https://github.com/aowang-ai/seris)  
Reference commit: `f73dbbb0cd7e3b52601abf905bb871cdb9098550`  
License: Apache-2.0

## Adapted surfaces (runtime ideas only)

| Seris path | Native HELIOS owner |
| --- | --- |
| `apps/core/src/runtime/sessionStore.ts`, `activeTools.ts` | `packages/sunrey-agent/src/native-agent-runtime/` |
| `apps/core/src/loop/modelFactory.ts`, gateway routing | `packages/ai-runtime/src/native-agent-runtime/` |
| `apps/core/src/tools/registry.ts` | `packages/sunrey-agent/src/tools/` (existing canonical registry) |
| `apps/core/src/compaction/compactor.ts` | `packages/sunrey-agent/src/native-agent-runtime/compaction.ts` |
| Research tool allow-lists | `packages/agentic-capital-mesh/src/native-research-agent/` |

## Intentionally not imported

- Desktop shell, Tauri packaging, local key vault, Seris branding
- Brokerage / live execution tools from Seris `tools/brokerage.ts` and related paths

Full vendor tree is not vendored in this repository; inspect upstream at the reference SHA when extending assimilation.
