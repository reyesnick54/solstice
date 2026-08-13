# Build status

Last local verification for Phase 2 (Kernel hardening) and Phase 3
(Global Money Fabric simulation).

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
