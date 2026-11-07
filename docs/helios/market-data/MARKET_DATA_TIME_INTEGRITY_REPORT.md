# Market Data Time Integrity Report

**Git SHA:** `ceeba184f759b64d01216dc923d2cc1f6554dd41` · **Evaluated at (UTC):** `2026-11-07T16:54:02.230Z`

## Precision time (MD02)

Canonical owner: `packages/platform/src/helios/market-data/md02/index.ts`

- `buildMarketTimeEnvelope` distinguishes pipeline stages and computes `knowableAt`.
- MD14 E2E invokes MD02 for the time-envelope stage.
- Adversarial scenario `md14_clock_skew` rejects `knowableAt < eventTime`.

AAF feature certification requires `knowableAt >= eventTime` (`aaf-integration.ts`).

