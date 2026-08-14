# Build status

Last local verification for Phase 2 (Kernel hardening) and Phase 3
(Global Money Fabric simulation).
Last updated: 2026-08-14 (Phase 8 Pyramid Economy simulation)

## Test counts

| When | Command | Result |
| --- | --- | --- |
| Before this change (main @ de3c633) | `node --test packages/domain/src/**/*.test.ts` | **30 passed** / 0 failed (Customer domain) |
| After this change | `npm test` at repo root | **71 passed** / 0 failed |

Domain tests are still invoked by the root `npm test` script. The passing count increased from 30 to 71 and did not decrease.

Demo: `npm run demo` exits 0 (`demo: ok`). Journals posted: 0. Execution authorities issued: 0.

## Commands

```
npm install
npm run gate
npm test
npm run demo
npm run typecheck
```

`npm run ci` runs all of the above.

## Invariants the build must keep

- Every state-changing path listed in
  `packages/kernel/src/state-changing-paths.ts` requires
  `KernelAuthorization`.
- `scripts/check-kernel-gating.mjs` fails the build on a new ungated
  mutator and prints `file:line`.
- Posture is monotonic: CLEAR < REVIEW < HOLD < BLOCK. Escalation
  cannot be relaxed.
- Journals balance per currency. FX journals carry rate + timestamp.
- `LIVE_*` flags are `false`. `ENVIRONMENT` is `simulation`.
- No policy rule is `CONFIRMED_BY_COUNSEL`.
- Test count must not decrease relative to the previous passing suite.

## Demo scenarios (apps/demo)

1. Domestic USD payment
2. Cross-border USD→EUR to Ahmed with ranked route table
3. Sanctions BLOCK (evidence, no postings)
4. Failed settlement reversed by compensating entries
npm test
npm run demo
npm run ci
```

CI: `.github/workflows/ci.yml` (Node 22).

## LIVE_* flags

All remain `false`:

- `LIVE_MONEY_MOVEMENT`
- `LIVE_EXTERNAL_EXECUTION`
- `LIVE_SUBSCRIPTION_MUTATION`
- `LIVE_LLM_ENFORCEMENT`
- `LIVE_MERCHANT_NETWORK`
- `REAL_MONEY_ENABLED`

## Phase exit

- Phase 4: agent can propose, be refused, and explain, and cannot execute.
- Phase 5: weekly economic delta is real, sourced, and honest about realization class. No percentage-return path.
- Phase 8: a data contribution flows request → consent → clean room → PYR
  compensation → Proof of Contribution, entirely in simulation. ADR-0009
  is PROPOSED. No chain is selected. `LIVE_CRYPTO_ENABLED` and
  `LIVE_DATA_MARKET_ENABLED` stay false. PYR capabilities stay
  registry-gated and default-disabled.
