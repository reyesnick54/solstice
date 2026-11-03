# OpenChart server module map (NATIVE08 inspection)

Reference upstream paths (not vendored):

| Module | Role |
|--------|------|
| `server/alert/` | Condition monitoring, alert fire recording |
| `server/events/` | Typed pub/sub, id-only consumers |
| `server/monitoring/` | Non-authoritative health |
| `server/proactive/` | Read-only starter prompts |
| `server/scheduler/` | Cron / one-shot research schedules |
| `server/trigger/` | Alert-fired reactions (notification / agent admit) |
| `server/agent/` | Durable agent run queue |

Native HELIOS implementation: `packages/platform/src/helios/research-monitor/proactive/` and `packages/agentic-capital-mesh/src/proactive-research/`.

Qualification marker: `HELIOS_NATIVE_PROACTIVE_RESEARCH_ENGINE_QUALIFIED`.
