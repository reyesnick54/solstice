# Chunk 13 resume (Chunk 13R)

Chunk 13 originally stopped because the task’s pre-coding process
gate failed: Chunk 12 wallet / SoftPOS was not yet genuinely
implemented, `docs/build-status.md` still described Chunk 12 as
stopped, and `main` CI was red. That stop is preserved in
[`chunk-13-stop.md`](./chunk-13-stop.md). It is not the current
state.

This document records the resumed implementation.

This is **simulation architecture only**. Solstice does not connect
to a live bank, correspondent, FX source, or payment provider.
Concentration and routing weights are engineering values labeled
`RESEARCH_REQUIRED`. They are not regulatory capital requirements.

## Boundary

| Concern | Owner | Not |
| --- | --- | --- |
| Treasury books, liquidity, prefunding, reservations | `packages/treasury` | A second ledger or customer-balance store |
| Application facade | `services/treasury` | A second treasury model |
| Payment route hard-filter + scoring | `packages/treasury` routing, extending `packages/payments` | A second PaymentOrchestrator |
| Customer funds hold | existing banking / payments holds | Treasury reservation |

Customer balances remain in the canonical banking ledger. Treasury
positions are system / provider / corridor books. Ownership
`CUSTOMER` is rejected on a treasury account.

## What this resume implements

- Currency-separated `TreasuryPosition` (settled, available, reserved,
  pending inbound/outbound, operational buffer). No cross-currency sum
  without an explicit timestamped FX valuation context.
- Route-level destination prefunding. Insufficient SAR liquidity makes
  the route ineligible. No negative position and no silent overdraft.
- `TreasuryLiquidityReservation` distinct from the customer payment
  hold. States: `ACTIVE`, `COMMITTED`, `RELEASED`, `EXPIRED`,
  `CANCELLED`. Idempotent. PostgreSQL `SELECT … FOR UPDATE` for
  concurrent reservation.
- Two-stage routing: existing payments compliance hard filter, then
  treasury hard filter (account, quote, security, kill switches,
  settlement risk, liquidity). Only survivors are scored.
- Deterministic versioned scoring (`treasury-route-v1`). Same
  candidates + facts + version produce the same result. No generative
  AI on the executable path.
- Explainable route decisions: selected route, eligible alternatives,
  rejected routes and reasons, score components, routing version.
- Provider / corridor / currency / legal-entity concentration
  snapshots with `RESEARCH_REQUIRED` engineering thresholds.
- Settlement exposure states `NORMAL` → `ELEVATED` → `RESTRICTED` →
  `HALTED`. `SUBMISSION_UNKNOWN` does not release liquidity.
- Operational kill switches (provider, rail, corridor, settlement
  account, currency route, halt reservations, reconciliation-only).
  They do not rewrite financial history.
- Treasury-side FX inventory (USD, EUR, GBP, SAR, AED), not customer
  deposits.
- `TreasuryRebalanceProposal` is proposal-first. Execution requires
  Kernel `ALLOW` and a verified Execution Authority.
- Deterministic short-horizon cash forecast with recorded horizon,
  facts, assumptions, version, and `generatedAt`.
- Read-only routing scenario simulator. It must not mutate live
  financial state.
- Reconciliation against payment, reservation, ledger, and rail
  report. Outcomes never auto-post a balancing journal.
- PostgreSQL schema `treasury` (customer V010) and canonical
  `VersionedEvent` types under the `treasury` namespace.

## Integration

The existing `PaymentsService` accepts an optional `TreasuryAdvisor`.
`packages/payments` does not depend on `packages/treasury`. When
wired:

eligible payment → compliance hard filter → treasury hard filter →
deterministic score → customer funds reservation → treasury
liquidity reservation → rail adapter → settle/commit or fail/release.
`SUBMISSION_UNKNOWN` leaves the treasury reservation `ACTIVE`.
