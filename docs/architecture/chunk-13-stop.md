# Chunk 13 stop record

This file is the Chunk 13 completion report. It records a
**process-gate stop**, not a treasury implementation.

Task: Treasury, Liquidity, Corridor Funding, Payment Routing
Intelligence, and Settlement Risk Engine.

Instruction on the task: start from latest clean `main`. Before
coding, verify that:

1. Chunk 12 is genuinely `IMPLEMENTED`
2. `docs/build-status.md` no longer says Chunk 12 is stopped
3. current `main` CI is green

If any of those fail, **stop**. Do not begin the treasury bounded
context. Do not begin Personal Economic Graph.

---

## A. Baseline

Inspected HEAD: `f304ef8` —
`Merge pull request #29 from reyesnick54/cursor/mobile-wallet-and-tap-to-pay-15cc`.

Latest `origin/main` is the same commit.

### Gate 1 — Chunk 12 is genuinely IMPLEMENTED

**Failed.**

Chunk 12 is mobile wallet provisioning, network-token lifecycle,
Apple Pay / Google Wallet adapter architecture, and Tap-to-Pay /
SoftPOS. The merged PR for that task (`#29`) is a constitutional
**stop record**, not an implementation.

Workspace inventory on this tip:

- `packages/cards` and `services/cards` exist (Chunk 11, PR `#31`).
- Capability `cards` is `IMPLEMENTED`. Bounded context CARDS is
  `PARTIAL` simulation.
- `packages/cards/src/token.ts` holds `CardNetworkToken` metadata
  explicitly labeled “for future mobile-wallet provisioning
  (Chunk 12). This is not Apple Pay or Google Wallet
  implementation.”
- No `DevicePaymentToken` type.
- No Apple Wallet / Google Wallet adapter.
- No SoftPOS / Tap-to-Pay acceptance module.
- No wallet provisioning ActionType.
- [`chunk-12-stop.md`](./chunk-12-stop.md) still records the stop.
- [`chunks/chunk-12-mobile-wallet-and-tap-to-pay.json`](./chunks/chunk-12-mobile-wallet-and-tap-to-pay.json)
  still describes a stop (its notes were written when `cards` was
  `PLANNED`).

Chunk 11 (cards) being `IMPLEMENTED` is not the same as Chunk 12
being implemented. The task asked for a genuine Chunk 12
implementation.

### Gate 2 — build-status no longer says Chunk 12 is stopped

**Failed.**

`docs/build-status.md` on `main` still contains:

> Chunk 12 (mobile wallet / Tap-to-Pay) is **stopped**.

That sentence is still true as a feature statement (wallet /
SoftPOS were never built). The surrounding paragraph is stale: it
still claims `cards` is `PLANNED` and absent. Cards landed in
PR `#31` before the Chunk 12 stop PR merged.

### Gate 3 — current main CI is green

**Failed.**

GitHub Actions run `31870629641` on `main` at `f304ef8`
(`Merge pull request #29`, 2026-08-15T06:55:10Z):

| Job | Conclusion |
| --- | --- |
| architectural-invariants → … → tests → e2e-demo → typecheck → secrets | **FAILURE** |
| postgres → migrate → persistence-integration | SUCCESS |

The unit-test job failed on one assertion:

```
✖ CHUNK-12 must stop until the protected cards capability is IMPLEMENTED
  AssertionError: Expected values to be strictly equal:
  + 'IMPLEMENTED'
  - 'PLANNED'
```

PR `#29` landed a test that `cards` must remain `PLANNED` so
Chunk 12 `mustStop`s. PR `#31` had already flipped `cards` to
`IMPLEMENTED`. The later merge of `#29` onto that tip left `main`
red.

The immediately previous `main` push (PR `#31`, run
`31870589306`) was green. The red tip is the Chunk 12 stop merge,
not a cards-implementation failure.

### Required-capability evaluation for Chunk 13

Chunk 13’s protected requirements (Money, ledger, banking, FX,
payments, rails, cards, security, identity, Kernel, policy,
compliance screening, persistence, events, evidence) are all
`IMPLEMENTED` on this tip. `evaluateChunkRequirements` therefore
returns `mustStop: false`.

The stop is **not** a missing protected capability. It is the
explicit three-part process gate on the task. Capability clearance
is not permission to ignore that gate.

Required-capability evaluation for Chunk 12 now also returns
`mustStop: false` because `cards` is `IMPLEMENTED`. The original
Chunk 12 constitutional stop reason is obsolete. The wallet /
SoftPOS **features** were still never built.

---

## B. What was not built

Nothing under the reserved TREASURY bounded context:

- no `packages/treasury`
- no `services/treasury`
- no treasury account registry, liquidity position, prefunding,
  reservations, concentration, settlement-risk engine, kill
  switches, FX inventory, rebalance proposals, cash forecast, or
  routing simulator
- no new ActionType
- no new `LIVE_*` flag
- no new ledger mutator
- no Personal Economic Graph work

Existing simulation settlement books in
`packages/payments/src/treasury.ts` and
`packages/cards/src/treasury.ts` were left untouched. Those are
payment/card system books, not the reserved TREASURY context.

Existing route selection in `packages/payments/src/route.ts`
already applies compliance as a hard filter. It was not extended
with liquidity, concentration, or versioned scoring.

---

## C. Stale-document repair (this branch only)

The stop PR repairs merge-artifact contradictions so the tree
matches what `main` actually contains. It does **not** implement
treasury and does **not** implement Chunk 12.

Repairs:

1. Constitution test no longer asserts `cards === PLANNED`.
   Cards is `IMPLEMENTED`. Chunk 12’s capability-evaluator
   `mustStop` is now `false`.
2. Chunk 12 declaration notes no longer claim `cards` is
   `PLANNED`.
3. `chunk-dependencies.md` no longer lists `cards` as both
   `PLANNED` and `IMPLEMENTED`.
4. `docs/build-status.md` no longer claims the cards owner is
   absent. It still records that wallet / SoftPOS were not built,
   and that Chunk 13 stopped on the process gate.
5. A Chunk 13 declaration is recorded so later agents can see the
   reserved TREASURY owner and the process-gate stop.

These repairs are documentation and one inverted test. They are
not a treasury bounded context.

---

## D. Exact CI on this stop branch

Recorded after the documentation/test repairs. See the PR checks.

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains
`false`.

---

## E. Whether the exit criterion passed

**No.** The Chunk 13 exit criterion requires a canonical Treasury
context, currency/provider/corridor-separated liquidity,
prefunding, concurrency-safe reservations, explainable
deterministic routing, concentration and settlement-risk models,
kill switches, Kernel-gated rebalance proposals, reconciliation,
PostgreSQL/events/evidence integration, a US→Saudi routing demo,
and full CI of those features.

Those features were not built because the task’s pre-coding gate
failed.

The **stop rule** passed: this agent did not reimplement Money,
ActionIntent, the Kernel, Execution Authority, the Evidence Vault,
the ledger, the account-class taxonomy, or Cards, and did not
create `packages/treasury` / `services/treasury`.

---

## F. Recommendation

Do not start treasury, routing optimization, or Personal Economy
Agent work until all three gates are true on clean `main`:

1. Implement Chunk 12 **inside** the existing Cards boundary
   (`packages/cards` / `services/cards`): wallet/tokenization as a
   Cards module; Tap-to-Pay / SoftPOS as a separate acceptance
   module. Reuse Identity, Kernel, ledger, payments settlement,
   events, and evidence. Do not create a second cards domain.
2. Update `docs/build-status.md` so it no longer describes
   Chunk 12 as stopped. List the implemented wallet / SoftPOS
   inventory instead.
3. Confirm the latest `main` CI run is green (both the unit-test
   pipeline and the persistence job).
4. Only then implement Chunk 13 at the reserved owners
   `packages/treasury` and `services/treasury`.
5. Keep compliance as a hard routing filter. Treasury scoring
   must not override policy.
6. Keep `ENVIRONMENT=simulation` and every `LIVE_*` flag `false`.
7. Rebalancing remains proposal-first and Kernel-gated. No
   autonomous external money movement.
