# Chunk 157 — Production adversarial resilience campaign

This chunk **extends** the existing `sunrey-adversarial-range` owner at
`packages/sunrey-range`. It does not create a second range, red-team,
chaos, or pentest package.

The goal is not merely “did a function return an error?” The goal is:
did every protected authority and economic invariant remain intact
under compound failure?

## Isolation

- Isolated defensive test range only.
- Fixture transports only.
- No live penetration testing.
- No external targets.
- No network scanning.
- No real credentials.
- `ENVIRONMENT` stays `simulation`.
- Every `LIVE_*` flag stays `false`.

## Campaigns

```
sunrey-range -- campaign --production-safety-smoke
sunrey-range -- campaign --production-safety-extended
```

Smoke is the CI-bounded subset. Extended is nightly / workflow_dispatch.

Every scenario has `scenarioId`, `seed`, `fixtureVersion`
(`sunrey.range.fixture.v157`), and a required invariant set. The same
seed is reproducible.

## Severity

| Score | Meaning |
| --- | --- |
| `PROTECTED` | Attack blocked; invariants held; no safety degradation |
| `DEGRADED_BUT_SAFE` | Availability degraded; invariants still held |
| `INVARIANT_BREACH` | A protected invariant failed. The campaign fails. |

Serious violations are not normalized into a passing score.

## Critical invariants

- `LEDGER_APPEND_ONLY`
- `EXECUTION_AUTHORITY_REQUIRED`
- `KERNEL_CANNOT_BE_BYPASSED`
- `ASSET_SUPPLYBOOK_CANONICAL`
- `CHUNK_71_MONETARY_AUTHORITY`
- `AI_CANNOT_EXECUTE`
- `RAW_SECRET_NOT_EXPOSED`
- `PII_NOT_PUBLIC_CHAIN`
- `ORACLE_CONSENSUS_NO_HTTP`
- `REFERENCE_PRICE_NOT_PRODUCTIVE_OUTPUT`
- `CROSS_ASSET_CUSTODY_ISOLATED`
- `UNKNOWN_SUBMISSION_NOT_BLINDLY_RETRIED`
- `COMPLIANCE_UNAVAILABLE_NOT_CLEAR`
- `CONTROL_ROOM_READ_ONLY`
- `PRODUCTION_NOT_ACTIVE`

`FAIL_OPEN_COMPLIANCE` is false. `CONNECTOR_FAILS_CLOSED` is true.
A Travel Rule acknowledgement is not withdrawal authority.

## Fuzz and formal labeling

`packages/sunrey-range/src/property.test.ts` contains executable property tests, not formal verification, and not TLA+ proofs. Formal models remain `packages/sunrey-chain/src/formal`.

## Demo

```
npm run demo:sunrey-production-adversarial-campaign
```
