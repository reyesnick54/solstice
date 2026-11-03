# TradingAgents assimilation reference (NATIVE09)

HELIOS does **not** run LangGraph or Python as a production runtime for capital research.

This directory records the upstream reference used to reimplement behavior in native TypeScript:

| Field | Value |
| --- | --- |
| Repository | [TauricResearch/TradingAgents](https://github.com/TauricResearch/TradingAgents) |
| License | Apache-2.0 |
| Reference SHA | `c4544913a14ed3df5f1ed7b9e8483270ce20682a` |

## Canonical HELIOS owners

| Upstream concern | HELIOS owner |
| --- | --- |
| Multi-agent graph orchestration | `packages/agentic-capital-mesh/src/trading-agents-research-mesh/` |
| Role prompts and structured research schemas | `packages/ai-runtime/src/trading-agents-research/` |
| Institutional specialist mesh (OS09) | `packages/agentic-capital-mesh/src/institutional-research-mesh/` |

Trader and Portfolio Manager roles produce **research proposals and evidence only**. They never receive Execution Authority or submit orders.
