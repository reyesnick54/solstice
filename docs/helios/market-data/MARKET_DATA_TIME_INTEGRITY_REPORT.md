# Market Data Time Integrity Report

**Git SHA:** `2146aa191d01323d9c2cfff6bd8411e640809802` · **Evaluated at (UTC):** `2026-11-07T16:23:35.673Z`

## Precision time (MD02)

Canonical owner: `packages/platform/src/helios/market-data/md02/index.ts`

- `buildMarketTimeEnvelope` distinguishes pipeline stages and computes `knowableAt`.
- MD14 E2E invokes MD02 for the time-envelope stage.
- Adversarial scenario `md14_clock_skew` rejects `knowableAt < eventTime`.

AAF feature certification requires `knowableAt >= eventTime` (`aaf-integration.ts`).

