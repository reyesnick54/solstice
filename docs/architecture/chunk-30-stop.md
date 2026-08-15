# Chunk 30 stop record

This file records a **constitutional missing-capability stop**, not a
SunRey Exchange control-plane implementation.

Task: SunRey Exchange Control Plane — Digital-Asset Custody
Architecture, Exchange AML/Sanctions Controls, Wallet Risk
Foundation, Travel Rule Workflow, Withdrawal Controls, Asset Listing
Governance, Market Surveillance, Cases, Kill Switches, and Exchange
Reconciliation.

Instruction on the task: start **only** after Chunk 29 is merged.
Required inventory includes `SUNREY_EXCHANGE`, `SUNREY_COIN`,
`SUNREY_CHAIN`, Identity, Security, Compliance, RDT, the canonical
Ledger, Events, Evidence, and case foundations. If exchange core is
absent: **stop**.

---

## A. Baseline

Inspected HEAD: `6a63434` —
`feat(data): resume privacy clean room (#53)`.

Latest `origin/main` is the same commit.

Workspace inventory on this tip:

| Required context | Status on `main` |
| --- | --- |
| IDENTITY | `IMPLEMENTED` at `packages/identity` |
| SECURITY | `IMPLEMENTED` at `packages/security` |
| COMPLIANCE screening / cases | `IMPLEMENTED` at `packages/kernel/src/compliance` |
| Policy engine | `IMPLEMENTED` at `packages/kernel/src/policy` |
| REGULATORY DIGITAL TWIN | `IMPLEMENTED` at `packages/regulatory-twin` |
| Canonical Ledger | `IMPLEMENTED` at `packages/ledger` |
| EVENTS | `IMPLEMENTED` at `packages/events` |
| EVIDENCE | `IMPLEMENTED` at `packages/evidence` |
| CONSENT / Purpose Firewall | `IMPLEMENTED` at `packages/consent` |
| CLEAN ROOM | `IMPLEMENTED` at `packages/clean-room` (Chunk 25R, PR `#53`) |
| SUNREY_COIN | **absent** (reservation only after this stop) |
| SUNREY_EXCHANGE | **absent** |
| SUNREY_CHAIN | **absent** |
| CUSTODY | **absent** (no prior bounded-context reservation) |
| MARKET_SURVEILLANCE | reserved `PLANNED` at `packages/market-surveillance`; no package |

There is no `packages/sunrey-exchange`, no exchange market/order/trade
core, no asset-listing registry, and no Chunk 27 / 28 / 29 declaration
on `main`.

Open sibling work that is **not** canonical until merged:

- PR `#51` — Chunk 27 information-market **stop** (Clean Room + SunRey
  Coin missing at the time it opened).
- PR `#52` — Chunk 26R SunRey Coin **stop** (opened before Clean Room
  merged; now stale on the Clean Room gate).
- Historical open PR `#18`
  (`feat/phase-9-pyramid-exchange-simulation`) — inspected as idea
  material only. Not copied. It is a stale Pyramid Exchange tree with
  its own matching, travel-rule, surveillance, and custody modules.

GitHub Actions on `main` at `9d850c8` (pre-Clean-Room tip, run
`31894450130`) was **FAILURE** from stacked Chunk 25 / 26 stop merges.
PR `#53` repaired the manifest and implemented Clean Room. This stop
starts from that repaired tip.

### Gate 1 — Chunk 29 is merged

**Failed.**

There is no CHUNK-29 declaration, no SunRey Exchange PR, and no
exchange package on `main`.

### Gate 2 — Exchange core is present

**Failed.**

`packages/sunrey-exchange` does not exist. Historical
`REYN_EXCHANGE` / `PYRAMID_EXCHANGE` reservations were never
implemented.

### Gate 3 — SUNREY_COIN and SUNREY_CHAIN are IMPLEMENTED

**Failed.**

No coin package. No chain adapter. No digital-asset subledger.

### Required-capability evaluation for Chunk 30

This stop PR declares CHUNK-30 with the task's required capabilities,
including protected `sunrey-coin`, `sunrey-exchange`, `sunrey-chain`,
`custody`, and `market-surveillance` recorded as `PLANNED`.

`evaluateChunkRequirements` therefore returns `mustStop: true` and
`missing: ['sunrey-coin', 'sunrey-exchange', 'sunrey-chain',
'custody', 'market-surveillance']`.

The stop is both:

1. the explicit task gate (start only after Chunk 29; stop if
   exchange core is absent), and
2. the constitution rule: a protected requirement that is not
   `IMPLEMENTED` is a stop, not a license to reimplement those
   subsystems or to invent a second exchange / custody ledger /
   travel-rule engine / surveillance system.

Implemented Identity, Compliance, RDT, Ledger, Events, and Evidence
are not permission to stand up a parallel exchange control plane.

---

## B. Custody architecture

**Not built.** No `DigitalAssetCustodyProvider`. No simulation
custody adapter. No production key generation.

Canonical reservation added: `CUSTODY` at `packages/custody`
(`PLANNED`). That is the historical extractable Custody subsystem.
Do not create `packages/custody-ledger` or treat a provider API as
customer-accounting truth.

---

## C. Deposit architecture

**Not built.** No external deposit ingestion, no provider-callback
credit path, no deposit state machine.

---

## D. Withdrawal architecture

**Not built.** No Kernel-gated digital-asset withdrawal. No
`SUBMISSION_UNKNOWN` handling. No blind-retry guard, because there
is no submission path.

---

## E. Wallet screening

**Not built.** No `BlockchainRiskProvider`. Canonical sanctions /
AML screening in `packages/kernel/src/compliance` remains the only
screening fabric. A later resume must extend it, not replace it.

---

## F. AML / sanctions integration

**Not built** for digital-asset facts. Existing simulation
sanctions, AML, fraud, velocity, and cases stay unchanged.

---

## G. Travel Rule decision engine

**Not built.** No jurisdiction-pack Travel Rule applicability
decision. No hard-coded global legal threshold was added.

---

## H. Travel Rule messaging

**Not built.** No Travel Rule provider port, no encrypted message
store, no PII event payload.

---

## I. VASP registry

**Not built.** No simulated VASP records or licensing claims.

---

## J. Listing governance

**Not built.** No listing review, no `LIVE_APPROVED` state, no
silent legal-classification mutation.

---

## K. Surveillance architecture

**Not built.** Reserved `MARKET_SURVEILLANCE` remains `PLANNED` at
`packages/market-surveillance`. Do not create `surveillance-v2`.
AI is not an enforcement authority.

---

## L. Self-trade

**Not built.** Chunk 29 participant-linkage does not exist on
`main` to extend.

---

## M. Wash trading

**Not built.**

---

## N. Spoofing / layering

**Not built.**

---

## O. Abnormal activity

**Not built.**

---

## P. Coordinated accounts

**Not built.**

---

## Q. Cases / human oversight

**Not built** as an exchange case system. Canonical cases remain
`packages/kernel/src/compliance/cases.ts`. A later resume must open
those cases from surveillance alerts. Do not create a second case
system.

---

## R. Kill switches

**Not built.** Existing treasury / Strategy Lab kill switches were
not reused as an exchange halt plane.

---

## S. Custody reconciliation

**Not built.** No auto-balance adjustment path was added.

---

## T. Exchange reconciliation

**Not built.** No plug accounts.

---

## U. Security

Unchanged. Canonical `KeyProvider`, `SecretReference`, envelope
encryption, and `PYRAMID_CUSTODY_FUTURE` remain. No wallet private
keys, seed phrases, or production custody keys were introduced.

---

## V. Persistence

**Not built** for custody, Travel Rule, listings, or surveillance.
Next customer migration after Clean Room is `V022` or later.

---

## W. Events / evidence

**Not built.** No `custody.*`, `travel_rule.*`, `exchange.listing.*`,
or `surveillance.*` events. No Travel Rule PII was written to
public events.

---

## X. Demos

**Not built.** External-withdrawal, surveillance, and listing demos
require the missing exchange core.

---

## Y. Tests

Constitution test
`CHUNK-30 stops because SunRey Exchange core is not IMPLEMENTED`
asserts `mustStop: true`, the reservation migration, and the
absence of competing exchange / custody / travel-rule /
surveillance packages.

---

## Z. Exact CI

Recorded after this stop lands locally. See the PR body.

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains
`false`.

---

## AA. Legal limitations

Nothing here is a VASP registration, broker-dealer or ATS license,
money-transmitter license, custody license, Travel Rule
compliance, AML compliance, or market-surveillance regulatory
approval. Software reservations are not licenses. No rule is
`CONFIRMED_BY_COUNSEL`.

---

## AB. Intentionally unimplemented

SunRey Exchange matching, custody adapters, deposits, withdrawals,
wallet screening, Travel Rule, VASP registry, listing governance,
surveillance detectors, restriction execution, kill switches,
custody/exchange reconciliation, live chain adapters, live
analytics, live Travel Rule networks, and any `LIVE_APPROVED`
listing state.

Historical PR `#18` was not revived.

---

## AC. Exit criterion

Chunk 30 implementation exit criteria are **not met**. That is the
correct outcome.

Reservation-only items completed by this stop:

1. `REYN_COIN` migrated to `SUNREY_COIN` at `packages/sunrey-coin`.
2. `REYN_EXCHANGE` migrated to `SUNREY_EXCHANGE` at
   `packages/sunrey-exchange`.
3. `SUNREY_CHAIN` reserved at `packages/sunrey-chain`.
4. `CUSTODY` reserved at `packages/custody` (historical extractable
   subsystem; no prior context existed).
5. `MARKET_SURVEILLANCE` remains reserved at
   `packages/market-surveillance` and now has a protected
   capability.
6. Competing roots `exchange-compliance-v2`, `travel-rule-v2`,
   `crypto-aml`, `surveillance-v2`, and `custody-ledger` are
   forbidden.

Implementation items remain for Chunk 30R after Chunks 26R–29 mark
`sunrey-coin`, `sunrey-chain`, and `sunrey-exchange` `IMPLEMENTED`
on a green `main`.

---

## AD. Recommendation for next chunk

Do **not** start the exchange control plane next.

1. **Chunk 26R** — implement SunRey Coin at `packages/sunrey-coin`
   now that Clean Room is `IMPLEMENTED`. Extend the canonical
   Ledger; do not create a second ledger. Keep the public ticker
   UNDECIDED.
2. **Chunk 27 / 28** — information-market and SunRey Chain only
   after the coin reservation is real. Do not invent a chain or
   marketplace from this stop.
3. **Chunk 29** — implement SunRey Exchange core at
   `packages/sunrey-exchange` (markets, orders, trades,
   participant linkage). Simulation only. No live exchange.
4. **Chunk 30R** — resume this control plane by **extending**
   `SUNREY_EXCHANGE`, `CUSTODY`, `MARKET_SURVEILLANCE`, and
   `packages/kernel/src/compliance`. Required flow remains
   Participant → Identity → eligibility → AML/sanctions/risk →
   Kernel → Exchange. Custody provider state is never ledger
   truth. AI cannot approve listings, restrict users, or bypass
   Kernel.

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains
false.
