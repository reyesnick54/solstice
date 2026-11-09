# Shadow Lab Resilience Report

**Qualification marker:** `HELIOS_AUTONOMOUS_SHADOW_LAB_V1_BLOCKED` (**shadow lab architecture qualified** — not investment-performance proof)

**Git SHA:** `596f47eb0e8d1379520c48f70857616100e6c61a`

**Qualification timestamp (UTC):** `2026-11-09T07:20:18.637Z`

**AlphaRealityGate status:** `FORWARD_CAMPAIGN_READY`

**Subprocess gates:** BLOCKED (see gate table)

**Posture:** `ENVIRONMENT=simulation`; `LIVE_TRADING_ENABLED=false`; `LIVE_INVESTMENT_EXECUTION=false`; `LIVE_CUSTODY_ENABLED=false`; `production_authorized=false`



Chaos scenarios in `chaos/resilience-harness.ts` (synthetic, in-memory).

| Scenario | Recovered | History rewrite |
|----------|-----------|-----------------|
| PROCESS_RESTART | true | false |
| DATABASE_RESTART | true | false |
| MARKET_DATA_DISCONNECT | true | false |
| MARKET_DATA_SEQUENCE_GAP | true | false |
| DUPLICATE_EVENT | true | false |
| OUT_OF_ORDER_EVENT | true | false |
| OUTCOME_QUEUE_BACKLOG | true | false |
| LEASE_COLLISION | true | false |
| CLOCK_ISSUE | true | false |
| STRATEGY_EXCEPTION | true | false |
| REPORT_GENERATION_FAILURE | true | false |
| EVIDENCE_PERSISTENCE_FAILURE | true | false |

**Catalog size:** 12 scenarios.

| Aggregate | Value |
|-----------|-------|
| allRecovered | true |
| anyHistoryRewritten | false |
