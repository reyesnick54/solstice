# NATIVE10 — TradingAgents data + memory assimilation

Upstream reference: `docs/helios/open-source/upstream-lock.json` (`tradingagents`, SHA `c4544913a14ed3df5f1ed7b9e8483270ce20682a`).

| Upstream concept | Canonical owner |
|------------------|-----------------|
| `dataflows/date_window`, `symbols`, `router` | `packages/external-data/src/tradingagents-native/` |
| SEC EDGAR as-filed | `packages/external-data/src/sec-fundamentals/` (existing OS10) |
| Point-in-time features | `packages/platform/src/helios/feature-fabric/` |
| AAF revision ledger binding | `packages/economic-awareness-fabric/src/integrations/sec-filing-revisions.ts` |
| `memory/log`, `portfolio.py` | `packages/agentic-capital-mesh/src/tradingagents-native/` |
| Evidence sealing | `packages/evidence` kinds + mesh `evidence-bridge.ts` |

Qualification marker: `HELIOS_NATIVE_TRADINGAGENTS_DATA_QUALIFIED` (`tests/helios-native10-tradingagents-data-memory.test.ts`).

No Python production dependency. Upstream trees stay outside the committed repository (`vendor/assimilation/tradingagents/README.md`).
