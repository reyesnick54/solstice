# TradingAgents — assimilation reference (not committed upstream tree)

Pinned upstream for HELIOS NATIVE10 assimilation:

| Field | Value |
|-------|--------|
| Repository | https://github.com/TauricResearch/TradingAgents |
| SHA | `c4544913a14ed3df5f1ed7b9e8483270ce20682a` |
| License | Apache-2.0 |

Inspect locally (reference clone only — do not commit the upstream tree into Solstice):

```bash
git clone --depth 1 https://github.com/TauricResearch/TradingAgents.git /tmp/tradingagents-ref
cd /tmp/tradingagents-ref && git fetch --depth 1 origin c4544913a14ed3df5f1ed7b9e8483270ce20682a
git checkout c4544913a14ed3df5f1ed7b9e8483270ce20682a
```

Relevant upstream paths nativeized in TypeScript:

- `tradingagents/dataflows/` → `packages/external-data/src/tradingagents-native/`
- `tradingagents/memory/`, `tradingagents/portfolio.py`, `tradingagents/backtest.py` → `packages/agentic-capital-mesh/src/tradingagents-native/`
- Point-in-time fundamentals → `packages/external-data/src/sec-fundamentals/` + `packages/platform/src/helios/feature-fabric/`

Canonical lock: `docs/helios/open-source/upstream-lock.json` (`id: tradingagents`).
