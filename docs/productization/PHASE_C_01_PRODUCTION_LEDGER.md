# Phase C Prompt 1 — Production Ledger and financial accounting core

This is a productization record for the canonical SunRey Ledger.
It is not production authorization, legal advice, or a claim that
external gates are satisfied.

No production activation occurred.

- `CORE_CODE_COMPLETE_CANDIDATE=true`
- `PRODUCTION_READY=false`
- `PRODUCTION_ACTIVE=false`
- `LIVE_CONNECTIVITY_ENABLED=false`
- `ENVIRONMENT=simulation`
- `production_authorized=false`

Prompt 1 does not start Prompt 2.

---

## 1. Canonical Ledger path

| Concern | Path |
| --- | --- |
| Journal authority | `packages/ledger/src/journal.ts` `Ledger.postJournal` |
| Invariants | `packages/ledger/src/invariants.ts` |
| Ledger accounts | `packages/ledger/src/accounts.ts` |
| Book roles (GL overlay) | `packages/ledger/src/book-role.ts` |
| Reversal planning | `packages/ledger/src/reversal.ts` |
| Read projections | `packages/ledger/src/read-model.ts` |
| Command lifecycle | `packages/ledger/src/lifecycle.ts` |
| Money | `packages/money/src/money.ts` |
| Customer account products | `packages/domain/src/account-class.ts` |
| Holds | `packages/domain/src/hold.ts`, `services/accounts/src/hold-store.ts` |
| Banking operations | `services/accounts/src/banking-operations.ts` |
| Balance projection | `services/accounts/src/balances.ts`, `available-funds.ts` |
| Persistence adapter | `packages/persistence/src/ledger/` |
| Migration | `db/ledger/migrations/V009__production_journal.sql` |

Do not create `packages/ledger-v2`, `packages/financial-ledger`, or a
parallel balance store. Persistence stores journals the Ledger already
accepted. It is not a second journal authority.

---

## 2. Accounting model

Strict double-entry. Every committed journal has at least two postings
and `sum(DEBIT) == sum(CREDIT)` per asset. A journal is single-asset
and single-kind: Money and AssetQuantity never share a journal.

Customer-facing account products remain the thirteen canonical
`AccountClass` values. Internal GL book roles (`CUSTOMER_LIABILITY`,
`TREASURY`, `SETTLEMENT`, `FEES`, `REVENUE`, `EXPENSE`, `SUSPENSE`,
`FX`, `CARD`, `INVESTMENT`, `CUSTODY_BRIDGE`, …) are an overlay in
`book-role.ts`. They do not replace the account-class taxonomy.

Posted journals are append-only. Corrections are compensating journals.

---

## 3. Money representation

- Integer minor units (`bigint`)
- Explicit uppercase currency / book code (`^[A-Z]{3,16}$`): ISO 4217
  three-letter codes and longer simulation book codes such as `SUNREY`
- No binary floating-point authoritative arithmetic
- Safe JSON serialization (`minorUnits` as a decimal-free string)
- Overflow bound `MAX_ABS_MINOR_UNITS = 10^28` (fits `NUMERIC(38, 0)`)
- Deterministic `FLOOR` / `CEILING` / `HALF_EVEN` rounding
- FX conversion uses bigint rational rates only

Simulation books are seeded for USD, EUR, GBP, SAR, and AED.
Additional ISO codes are recognized as reserved. Live settlement
stays disabled.

---

## 4. Holds

A hold is a reservation, not a posting.

Lifecycle:

1. `CREATE_HOLD` — Kernel-gated reserve against available funds
2. `ADJUST_HOLD` — amount change while `ACTIVE`; still not a posting
3. `CAPTURE_HOLD` — posting that consumes the reservation
4. `RELEASE_HOLD` / `CANCEL_HOLD` — reservation ends without a capture
5. Expire — clock sweep (`expireHolds`) emits `HoldExpired`

Available = posted settled balance − ACTIVE holds.
Pending settlement stays in `PENDING_SETTLEMENT` and is not mixed into
settled deposit available-to-spend.

---

## 5. Transaction lifecycle

Command states (`INITIATED`, `PENDING`, `AUTHORIZED`, `POSTED`,
`SETTLED`, `REVERSED`, `FAILED`, `CANCELLED`) live on the domain
command. A committed journal is always `POSTED`. Historical posted
rows are never rewritten to `REVERSED`; that status is derived from a
later compensating journal.

---

## 6. Reversals

- Original journal is immutable
- Compensating journal links via `reversesJournalId`
- Full reversal of the same original cannot run twice
- Partial reversal requires an explicit amount strictly less than the
  original single-sided total
- `ledger.reversal_record` stores the audit link; unique full-original
  index fails closed at the database

---

## 7. Atomicity

`persistLedgerUnit` writes accounts, intents, authority audit,
journals, postings, holds, reversals, fees, and outbox events in one
PostgreSQL transaction. Deferred balance and no-commingling triggers
reject a partial debit/credit set at commit.

Evidence is a separate database and is committed after the ledger
unit, as before.

---

## 8. Concurrency

- Per-account mutex on in-memory hold reservation
- Account epoch compare-and-swap
- `SELECT … FOR UPDATE` on `ledger.account` inside the persist unit
- Unique journal idempotency key
- Unique full-reversal index

Application memory locks are not the only control.

---

## 9. Idempotency

Phase B idempotency is reused at the journal layer:

- `idempotencyKey` (unique)
- `requestFingerprint` (posting fingerprint)
- Replay of the same key + fingerprint returns the existing journal
- Different fingerprint on the same key is `IDEMPOTENCY` conflict
- Durable `ledger.journal_idempotency` row stores the binding

---

## 10. Persistence

Canonical store: PostgreSQL `solstice_ledger`.

V008 adds journal metadata, reversal uniqueness, hold amount updates,
and the idempotency fingerprint table. Empty-database apply still
starts at `V001`.

Holds, reversals, and fees hydrate through
`createPostgresSimulationRuntime` after process restart.

---

## 11. Events

Events emit only after a valid financial commit (or a reservation
state change that does not post):

| Event | Schema ref |
| --- | --- |
| `JournalPosted` | `solstice.ledger.transaction_posted/1` |
| `HoldCreated` | `solstice.banking.hold.created/1` |
| `HoldAdjusted` | `solstice.banking.hold.adjusted/1` |
| `HoldReleased` | `solstice.banking.hold.released/1` |
| `HoldExpired` | `solstice.banking.hold.expired/1` |
| `ReversalPosted` | `solstice.banking.reversal.posted/1` |

Events are not authority for reconstructing missing postings.

---

## 12. Evidence

Kernel decisions, hold/fee/reversal outcomes, and journal posts seal
evidence with intent id, authority id, and journal/hold ids. Secrets
and PAN/IBAN are not stored.

---

## 13. Security boundaries

Privileged posting is not a frontend API.

`REQUEST → AUTH → AUTHORIZATION → KERNEL → COMPLIANCE/RISK →
EXECUTION AUTHORITY → DOMAIN SERVICE → LEDGER`

`Ledger.postJournal` rejects a missing or unbound Execution Authority.
The consumer SDK and Consumer BFF do not import `postJournal` or
construct a Ledger.

---

## 14. Performance baseline

See `docs/productization/SUNREY_LEDGER_PERFORMANCE_BASELINE.md`.
Local in-process posting and lookup are measured to catch severe
regressions. No SLA is claimed.

Representative samples on this host (Node v22.14.0, n=80, in-process):
posting 0.016 ms median, lookup 0.002 ms, history 0.001 ms,
balance projection 0.195 ms.

---

## 15. Remaining gaps

1. Exchange settlement still uses in-memory coin/fiat ports on some
   paths. Later Phase C prompts must post those books through
   `Ledger.postJournal`.
2. Custody still does not call `postJournal`.
3. Consumer HTTP still exposes `OPEN_ACCOUNT` as the primary mutating
   action. Deposit/withdraw/transfer/hold remain library operations
   until a later Phase C prompt.
4. Staging / preproduction / production environments do not exist.
5. No live bank, rail, FX, card, or payment provider is connected.

---

## 16. Production flags

Preserved:

- `CORE_CODE_COMPLETE_CANDIDATE=true`
- `PRODUCTION_READY=false`
- `PRODUCTION_ACTIVE=false`
- `LIVE_CONNECTIVITY_ENABLED=false`
- `production_authorized=false`
