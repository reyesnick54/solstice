# Market Data Provider Qualification

**Git SHA:** `pending` · **Evaluated at (UTC):** `2026-11-07T16:53:55.245Z`

## Status ladder

1. **REGISTERED** — Provider appears in certification catalog overlay.
2. **SANDBOX_QUALIFIED** — Conformance, gap recovery, clock validation, and chaos tests pass on fixtures.
3. **READONLY_LIVE_QUALIFIED** — Sandbox checks plus credentials, contract/license, entitlement evidence, data-use policy, and **verified external connectivity**.
4. **PRODUCTION_RESEARCH_QUALIFIED** — Read-only live qualification complete for continuous research ingestion.

Fixture catalog providers remain **SANDBOX_QUALIFIED** only for this MD15 pass (`MARKET_DATA_LIVE_SHADOW_ENABLED=false`).

Implementation: `packages/platform/src/helios/market-data/provider-qualification.ts`.

## Qualification status

- MD14 fabric marker: `HELIOS_PRODUCTION_MARKET_DATA_V1_QUALIFIED`
- Live shadow eligible without connectivity evidence: **blocked**

