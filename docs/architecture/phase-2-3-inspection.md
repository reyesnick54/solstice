# Phase 2 / Phase 3 inspection (before implementation)

Inspected commit: `de3c633` on `main` (Customer domain + ADRs).

## Compliance Kernel proof evaluation

**Did not exist.** No `ActionIntent`, no proof types, no posture lattice,
no Execution Authority, no callers.

## Paths that changed financial state

On `main` there was no ledger and no persistence. The only domain
mutations were pure functions in `packages/domain/src/customer.ts`:

| Path | File | Before | After |
| --- | --- | --- | --- |
| `createProspect` | `packages/domain/src/customer.ts` | Pure (no store) | Store write `putCustomer` is Kernel-gated. Pure function remains a calculation. |
| `transitionCustomerStatus` | `packages/domain/src/customer.ts` | Pure (no store) | Store write `commitCustomerStatus` is Kernel-gated. |
| Ledger posting | none on `main` | n/a | `commitJournal` Kernel-gated |
| Sibling PR `InMemoryPostingStore.record` (`cursor/balance-read-model-81dd`, not merged) | `src/ledger.ts` | NOT Kernel-gated | Not merged; this branch’s journal store is gated |

No admin tools, seed scripts, or payment APIs existed on `main`.

## Ledger multi-currency

**Did not exist on `main`.** A sibling open PR introduced `Money` (bigint)
and refused mixed-currency sums without an explicit rate+timestamp.
This branch implements per-currency ledger positions and the same refusal.

## Money rate and rounding

**Did not exist on `main`.** This branch: exact `Rational` bigint rates,
round half away from zero, `Money.fromDecimalString` (no floats).

## Jurisdiction packs

**Did not exist.** ADR-0006 proposed data packs + `legalReviewState`.
This branch adds US/GB/EU/SA/AE packs. No rule is
`CONFIRMED_BY_COUNSEL`. `RESEARCH_REQUIRED` rules are disabled.

## Sanctions / AML stubs

**Did not exist.** In-process stubs added. `LIVE_SANCTIONS` / `LIVE_AML`
stay false. No network.

## Evidence sealing API

**Did not exist.** `EvidenceVault.seal` appends a SHA-256 hash chain.

## Posture relaxation

**Critical finding:** there was no posture system, so no runtime path
could silently relax posture — because posture was not evaluated at all.
That is a Phase 2 gap, not a relaxation bug. The Kernel now combines
proofs only via `escalate` (max severity). Tests cover BLOCK then CLEAR
staying BLOCK. No assignment-style combiner exists.
