# Market Data Time Integrity Report

## Event time vs knowable-at (MD02)

- **eventTime** maps from provider `sourceEventTime` on the H08 observation envelope.
- **knowableAt** is the earliest research-safe instant; queries and features must filter on knowable-at, not arrival time.

Canonical types: `packages/platform/src/helios/observation/types.ts`, `packages/platform/src/helios/market-observation/types.ts`.

## AAF07 proofs

`knowable_at_correctness` and `timestamp_normalization` are explicit harness proofs (`packages/external-data/src/certification/market-data/harness.ts`, `knowable-at.ts`).

## MD14 gates

- Synthetic E2E pipeline rejects envelopes where `knowableAt < eventTime`.
- Adversarial scenario `md14_clock_skew` locks this behavior.
- AAF feature certification requires `knowableAt >= eventTime` (`aaf-integration.ts`).

## Precision expectations

All timestamps are UTC instants. Simulation qualification uses deterministic fixture clocks; live-shadow mode must still normalize provider clocks before observations enter the fabric.
