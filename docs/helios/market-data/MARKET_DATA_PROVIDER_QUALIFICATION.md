# Market Data Provider Qualification

## Status ladder

1. **REGISTERED** — Provider appears in certification catalog overlay.
2. **SANDBOX_QUALIFIED** — Conformance, gap recovery, clock validation, and chaos tests pass on fixtures.
3. **READONLY_LIVE_QUALIFIED** — Sandbox checks plus credentials, contract/license, entitlement evidence, data-use policy, and **verified external connectivity**.
4. **PRODUCTION_RESEARCH_QUALIFIED** — Read-only live qualification complete for continuous research ingestion.

This ladder is **not** regulatory approval.

## Evidence fields

| Field | Required for live shadow |
|-------|--------------------------|
| Valid credentials (env secret ref) | Yes |
| Contract / license reference | Yes |
| Entitlement evidence | Yes |
| Data-use policy | Yes |
| Conformance harness | Yes |
| Gap recovery | Yes |
| Clock / timestamp validation | Yes |
| Chaos test | Yes |
| External connectivity verified | Yes |

Implementation: `packages/platform/src/helios/market-data/provider-qualification.ts`.

## Operator commands

- `npm run helios:aaf07:market-data:certify` — AAF07 thirteen-proof harness
- `npm run helios:market-data:qualify` — H07 bounded external qualify (`HELIOS_MARKET_DATA_LIVE_QUALIFY=1` + credential)

Never commit credential values. Reports must set `secretValuePresent: false`.
