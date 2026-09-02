# Wave 9 — Reliability and Chaos Qualification

Wave 9 extends the Wave 6 performance harness with reliability, chaos,
failure-isolation, and disaster-recovery qualification. All results are
`ENGINEERING_MEASUREMENT` values from safe synthetic sandbox environments.

**Do not claim production capacity, RPO, or RTO from these numbers.**

## Structure

| Path | Purpose |
| --- | --- |
| `lib/` | Load profiles, gates, report writer |
| `scenarios/` | Task-aligned qualification scenarios |
| `regression/` | CI regression thresholds |
| `results/` | Machine-readable JSON (gitignored) |
| `inventory.json` | Wave 9 suite inventory |

## Commands

```bash
# Full Wave 9 qualification
npm run qualify:wave9

# CI-fast smoke profile
npm run qualify:wave9:fast

# DR-focused suites
npm run qualify:wave9:dr

# CI regression tests
npm run test:wave9-regression

# Individual chaos scripts (simulation only)
node --experimental-strip-types scripts/chaos/restart-sandbox.mjs
node --experimental-strip-types scripts/chaos/provider-failure.mjs
node --experimental-strip-types scripts/chaos/blockchain-recovery.mjs
```

## Load profiles

`NORMAL`, `HIGH`, `BURST`, `SUSTAINED`, `READ_HEAVY`, `TRANSACTION_HEAVY`,
`PROVIDER_INGESTION_HEAVY`, `EXCHANGE_HEAVY`, `CLAIM_VERIFICATION_HEAVY`.

## Delegation

Wave 9 orchestrates existing owners — it does not create a second range,
recovery system, or benchmark owner:

- `packages/sunrey-range` — adversarial campaigns
- `packages/sunrey-chain/src/sync/chaos.ts` — chain recovery
- `packages/external-data/src/wave7/chaos-harness.ts` — provider chaos
- `packages/persistence/src/production/recovery/` — operational recovery
- `scripts/qualify-backend-db.mjs` — real PostgreSQL qualification

## Documentation

- `docs/security/WAVE9_RELIABILITY_AND_CHAOS_REPORT.md`
- `docs/runbooks/SUNREY_DISASTER_RECOVERY_MASTER_RUNBOOK.md`
