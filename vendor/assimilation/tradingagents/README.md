# TradingAgents assimilation reference

| Field | Value |
| --- | --- |
| Repository | [TauricResearch/TradingAgents](https://github.com/TauricResearch/TradingAgents) |
| License | Apache-2.0 |
| Reference SHA | `c4544913a14ed3df5f1ed7b9e8483270ce20682a` |

Inspect locally (reference clone only — do not commit the upstream tree into Solstice):

```bash
git clone --depth 1 https://github.com/TauricResearch/TradingAgents.git /tmp/tradingagents-ref
cd /tmp/tradingagents-ref && git fetch --depth 1 origin c4544913a14ed3df5f1ed7b9e8483270ce20682a
git checkout c4544913a14ed3df5f1ed7b9e8483270ce20682a
```

## Canonical HELIOS owners

| Upstream concern | HELIOS owner |
| --- | --- |
| Multi-agent graph orchestration (NATIVE09) | `packages/agentic-capital-mesh/src/trading-agents-research-mesh/` |
| Role prompts and structured research schemas | `packages/ai-runtime/src/trading-agents-research/` |
| Institutional specialist mesh (OS09) | `packages/agentic-capital-mesh/src/institutional-research-mesh/` |
| Dataflows / date-window / router (NATIVE10) | `packages/external-data/src/tradingagents-native/` |
| Memory / portfolio context (NATIVE10) | `packages/agentic-capital-mesh/src/tradingagents-native/` |
| Point-in-time fundamentals (OS10) | `packages/external-data/src/sec-fundamentals/` + `packages/platform/src/helios/feature-fabric/` |

Trader and Portfolio Manager roles produce **research proposals and evidence only**. They never receive Execution Authority or submit orders.

Canonical lock: `docs/helios/open-source/upstream-lock.json` (`id: tradingagents`).
