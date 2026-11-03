# OpenChart assimilation reference (NATIVE08)

**Upstream:** [longsurf-ai/openchart](https://github.com/longsurf-ai/openchart)  
**Pinned SHA (architecture audit):** `8109466bfb5d44c32e0e03e9337eaca48b837ab4`  
**License:** MIT  

This directory records **native assimilation provenance only**. OpenChart source is not vendored into Solstice.

## Inspected server modules (behavioral reference)

| Path | Native HELIOS owner |
|------|---------------------|
| `server/alert/` | `packages/platform/src/helios/research-monitor` (OS07 DSL + NATIVE08 lifecycle) |
| `server/events/` | `packages/platform/src/helios/research-monitor/proactive/event-subscriptions.ts` |
| `server/monitoring/` | Non-authoritative health on proactive engine tick outcomes |
| `server/proactive/` | Research-only starter semantics (no trade path) |
| `server/scheduler/` | `packages/platform/src/helios/research-monitor/proactive/scheduler.ts` |
| `server/trigger/` | `packages/platform/src/helios/open-source-integration/os08` |
| `server/agent/` | `packages/agentic-capital-mesh` research mesh invocation |

Canonical architecture map: `docs/helios/open-source/OPENCHART_HELIOS_MONITOR_MAP.md`.

Flow enforced on `main`:

`Market Event → Feature Fabric → Research Monitor → Trigger → Economic Work Order → Agent Research`

Triggers **never** move capital or post journals.
