# Solstice agent notes

Solstice is a simulated digital bank. Phase 2: nothing that changes
financial or regulated customer state executes outside the Compliance
Kernel, including internal tools, seed scripts, tests, and admin paths.
Phase 3: a cross-border transfer completes with a scored route and
sealed evidence. All rails are simulated.

## Hard rules

- Do not make real network calls. Do not contact real banks, FX sources,
  or payment providers.
- Do not change any `LIVE_*` flag or `ENVIRONMENT`. They stay
  `false` / `simulation`.
- Do not mark any policy rule `CONFIRMED_BY_COUNSEL`. Unknown corridors
  are `RESEARCH_REQUIRED` and disabled.
- Do not select a non-permitted payment route under any scoring weight.
  Regulatory compatibility is a filter, not a score.
- Do not edit a posted journal. Reverse with compensating entries.
- Do not use floating-point for rates, fees, or amounts. Use `bigint`
  minor units and `Rational`.
- Do not give agents a capability to add or modify a beneficiary.
- Do not weaken CI, Kernel gating, or ledger balance invariants.

## How to change financial state

Submit an `ActionIntent` to `ComplianceKernel.evaluate`. HOLD and BLOCK
post nothing and still seal evidence. Payments take a second gate,
`grantExecutionAuthority`, after FX quote and route selection.

Registered mutators live in `packages/kernel/src/state-changing-paths.ts`.
`scripts/check-kernel-gating.mjs` fails CI if a new mutator is added
without Kernel authorization (reports file and line).

## Layout

- `packages/domain` — Money, Customer, Account, Beneficiary
- `packages/kernel` — proofs, posture, packs, sanctions/AML stubs, evidence
- `packages/ledger` — append-only journals, Kernel-gated stores
- `packages/payments` — FX router, rails, routing engine, execution
- `apps/demo` — domestic, USD→EUR, sanctions block, failed settlement

## Commands

```
npm install
npm run ci
```
