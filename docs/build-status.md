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
- Simulated funding source `SIMULATION.FUNDING_SOURCE` (not corporate, not an unlabelled plug).
- Evidence Vault hash chain; versioned domain events.
- Accounts service: Kernel-gated opening, deposits, withdrawals, same-owner internal transfers.
- Read-only class-segregated balances and customer position (breakdown + grand total in one object).
- Architectural invariant linter and Phase 1 exit-criterion test.
- End-to-end demo at `packages/domain/src/demo.ts`.

## Not implemented

- Persistence / PostgreSQL (ADR-0008 remains PROPOSED).
- Policy engine and jurisdiction packs (ADR-0006 remains PROPOSED).
- Identity stack / real KYC (ADR-0007 remains PROPOSED).
- Real-money rails. Every `LIVE_*` flag is false. `ENVIRONMENT=simulation`.

## How to run

```
npm test
npm run lint:architecture
npm run demo
npm run ci
```
