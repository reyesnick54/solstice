# NATIVE11 — Seris AI runtime assimilation

Status: **simulation-only**. Qualification marker: `HELIOS_NATIVE_AGENT_RUNTIME_QUALIFIED`.

Seris (Apache-2.0, [aowang-ai/seris@f73dbbb](https://github.com/aowang-ai/seris/commit/f73dbbb0cd7e3b52601abf905bb871cdb9098550)) contributed runtime **patterns**, not desktop packaging. Native owners:

| Concern | Owner |
| --- | --- |
| Model-neutral gateway, fallback, retry budgets, session usage | `packages/ai-runtime/src/native-agent-runtime/` |
| Persistent sessions, active tools, bounded loops, compaction, permission gating, tool audit | `packages/sunrey-agent/src/native-agent-runtime/` |
| Research-mesh tool permissions | `packages/agentic-capital-mesh/src/native-research-agent/` |

Platform overlay `packages/platform/src/helios/os12-agent-permission-gateway/` remains the HELIOS product composition path; NATIVE11 is the canonical package-level assimilation named in the SunRey agent constitution.

## Research agent permissions

Granted only by explicit capability grants:

- `READ_DATA`, `RUN_ANALYSIS`, `RUN_BACKTEST`, `CREATE_MONITOR`, `PROPOSE_STRATEGY`, `REQUEST_RESEARCH`

Never granted:

- `TRANSFER_FUNDS`, `EXECUTE_ORDER`, `DISABLE_RISK`, `DISABLE_COMPLIANCE`, `ENABLE_LIVE`

## Not ported

Desktop shell, Tauri, local key vault, Seris branding, live brokerage tools.
