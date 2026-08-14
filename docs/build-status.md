# Build status

This document describes only what is implemented and tested in this tree.

## Implemented

- Customer domain (prospect through closed, typed status transitions, KYC state modelled not executed).
- Thirteen typed account classes, product catalog, and legal-entity records in `packages/domain`.
- Account entity with no balance field. Opening requires a verified Execution Authority.
- Money primitive (`bigint` minor units) with FLOOR / CEILING / HALF_EVEN rounding in `packages/money`.
- Action intents `OPEN_ACCOUNT`, `POST_DEPOSIT`, `POST_WITHDRAWAL`, `INTERNAL_TRANSFER` on the single `ActionIntent` envelope, plus structural well-formedness checks in `packages/permissions`.
- Compliance Kernel: six proofs, monotonic escalation, signed Execution Authority, evidence sealed on every decision. In-memory simulation policy only. No jurisdiction packs.
- In-memory ledger: balanced journals, append-only, authority-required, named class bridges, no commingling, idempotency keys.
- Simulated funding source `SIMULATION.FUNDING_SOURCE` (named simulation source; not corporate).
- Evidence Vault hash chain; versioned domain events.
- Accounts service: Kernel-gated opening, deposits, withdrawals, same-owner internal transfers.
- Read-only class-segregated balances and customer position (breakdown + grand total in one object).
- Architectural invariant linter (TypeScript + Python), extraction dry-run, deployment-posture check, kernel-gating check, secret scan, and Phase 1 exit-criterion test.
- Architecture constitution and machine-readable manifest (`docs/architecture/constitution.md`, `docs/architecture/manifest.json`) with CI checks for duplicate protected systems, illegal package dependencies, unregistered workspace packages, and authorized mutation paths. Future bounded contexts are reserved as PLANNED only.
- Chunk/capability evaluator so a later task can see whether a required capability is IMPLEMENTED, PARTIAL, PLANNED, or ABSENT. A protected requirement that is not IMPLEMENTED is a stop, not a license to reimplement.
- ADR index at `docs/architecture/adr/README.md`. ADR-0006 / 0007 / 0008 remain PROPOSED. No legal position is CONFIRMED_BY_COUNSEL.
- End-to-end demo at `packages/domain/src/demo.ts`.

## Not implemented (present on other PRs; not in this consolidated tree)

- Persistence / PostgreSQL (ADR-0008 remains PROPOSED).
- Policy engine and jurisdiction packs (ADR-0006 remains PROPOSED). No rule is `CONFIRMED_BY_COUNSEL`.
- Identity stack / real KYC (ADR-0007 remains PROPOSED).
- Phase 2–3 FX router, payment rails, routing engine, `grantExecutionAuthority`, sanctions/AML stubs (`packages/payments`).
- Phase 4–5 Personal Economy Agent, mandate compiler, Compounder, Growth OS, capability tokens (`packages/agent`, `packages/platform`).
- Reserved later bounded contexts (PAYMENTS, FX, CARDS, TREASURY, PERSONAL ECONOMY AGENT, PYRAMID, SOVEREIGN CELLS, and the rest listed in the constitution). They are PLANNED only.
- Real-money rails. Every `LIVE_*` flag is false. `ENVIRONMENT=simulation`.

## Phase 1 exit criterion

The exit criterion is true only when all of the following can be shown in
one place, against running code, with no assertion relaxed:

1. A person can open an account, and that opening happens only with a valid Execution Authority from the Compliance Kernel.
2. A balance can be read and is segregated by class (insured deposits are not mixed with other classes).
3. Every state change in that flow produced an evidence record.
4. The evidence hash chain verifies end to end.
5. Deposit journals balance (debits equal credits).
6. A refused account opening produced evidence and created no account.

Historical note (PR #13, `docs/BUILD-STATUS.md`): on `main` at `de3c633` none of those six points held. This consolidated branch takes PR #12 as the authorization spine so those six points can be demonstrated.

## How to run

```
npm install
npm test
npm run lint:architecture
npm run lint:invariants
npm run check:extraction
npm run check:posture
npm run gate
npm run demo
npm run typecheck
npm run scan:secrets
npm run ci
```
