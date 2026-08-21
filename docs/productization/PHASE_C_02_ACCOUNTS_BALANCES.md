# Phase C Prompt 2 — Customer accounts, balances, and transaction activity

Status: implemented as a product/orchestration overlay on the canonical
Account + Ledger. Not a second ledger. Not live banking.

Environment remains `simulation`. All `LIVE_*` flags remain `false`.

## Account architecture

```
Ledger                = accounting authority (journals, balances, holds)
Account (domain)      = identity + class + jurisdiction + Kernel-gated open
Account Service       = product/orchestration (lifecycle overlay, restrictions,
                        activity, statements, wealth projection)
BFF /api/v1           = presentation (Lovable Home / Money / Accounts)
```

Canonical implementation remains:

- `packages/domain` — `Account`, `AccountClass`, `AccountId`
- `packages/ledger` — journals, `balanceOf`, holds as reservations
- `services/accounts` — Kernel-gated `openAccount`, `MoneyMovementService`,
  `BankingOperationsService`
- **New product layer** — `services/accounts/src/account-product-service.ts`

Do not create `packages/accounts-v2`, a stored balance column, or a
frontend-writable status.

## Customer financial account model

`CustomerFinancialAccount` is a **view** over a canonical `Account`:

| Field | Source |
| --- | --- |
| `accountId` | domain `Account.id` |
| `owner` | `customerId` |
| `productType` | overlay, defaulted from `AccountClass` |
| `currency` | `Account.currency` (single currency per account) |
| `status` | **derived** lifecycle (never client-supplied) |
| `openedAt` / `closedAt` | domain timestamps |
| `jurisdiction` | `Account.jurisdiction` |
| `providerLink` | overlay, reserved for later rails |
| `ledgerAccountReferences` | `[accountId]` — Ledger uses the same id |
| `restrictions` | overlay store |
| `metadata` | overlay |

Supported **product types** (labels, not licensed products):

- `CASH_ACCOUNT`
- `CHECKING_PAYMENT` (default for `DEMAND_DEPOSIT`)
- `SAVINGS`
- `MULTI_CURRENCY` (a **customer** holding several single-currency accounts)
- `INVESTMENT_CASH`
- `EXCHANGE_CASH`

A frontend cannot POST an account into `ACTIVE`. There is no
`POST /api/v1/accounts` live-banking open in this prompt. Provisioning
remains Kernel-gated `openAccount` inside the service.

## Lifecycle

Domain statuses stay `PENDING_OPEN | OPEN | FROZEN | CLOSED`.

Consumer lifecycle (derived):

| Consumer | When |
| --- | --- |
| `PENDING` | domain `PENDING_OPEN` |
| `ACTIVE` | domain `OPEN`, no restrictions, overlay ≠ `CLOSING` |
| `RESTRICTED` | domain `OPEN` with one or more restrictions |
| `FROZEN` | domain `FROZEN` |
| `CLOSING` | overlay `closing` while still `OPEN` |
| `CLOSED` | domain `CLOSED` |

Transitions are server-controlled via `AccountProductService`. Closing
an account that still has a non-zero posted balance is refused.

## Balance architecture

Balances are **derived**. There is no mutable `balance` field on Account
and no `balance` column in `ledger.account_product`.

`BankingPosition` (per account, one currency):

| Field | Meaning |
| --- | --- |
| `posted` | canonical Ledger `balanceOf` (same as `ledgerBalance`) |
| `pending` | reserved for in-flight consumer activity (0 until rail productization) |
| `held` | sum of active `Hold` reservations |
| `available` | `posted − held` (never negative) |
| `currency` | account currency |

Cached projections, if any, are rebuildable read models. Persistence
restart reloads holds, restrictions, and overlays; balances are
recomputed from the journal.

## Multi-currency

Each account has exactly one currency. A customer may hold USD and SAR
as two accounts. Minor units are never summed across currencies.

`projectCustomerWealth`:

- one currency → `AVAILABLE` (same-currency identity; no FX)
- mixed currencies without a conversion table → `UNAVAILABLE` /
  `MIXED_CURRENCY_WITHOUT_CONVERSION`
- explicit FX table later (Phase C Prompt 4) can convert into a
  requested valuation currency
- missing rate → `UNAVAILABLE` / `FX_RATE_UNAVAILABLE`

Home never fabricates a conversion.

## Activity model

`CustomerActivityItem` is a customer-safe feed. It does **not** expose
journal ids, posting lists, or Kernel internals.

| Field | Role |
| --- | --- |
| `activityId` | stable id |
| `type` | TRANSFER, PAYMENT, FX, CARD, FEE, INVESTMENT, EXCHANGE, CUSTODY, DEPOSIT, WITHDRAWAL, HOLD, RELEASE, ADJUSTMENT |
| `direction` | IN / OUT / NEUTRAL |
| `amount` / `currency` | integer minor units |
| `status` | see below |
| `counterpartyDisplay` | safe label |
| `description` | customer copy |
| `occurredAt` / `completedAt` | UTC |
| `fee` | optional |
| `reference` / `category` | optional |
| `relatedActionId` | Kernel/action correlation when present |

Internal `journalId` is retained on the server object and omitted from
the BFF JSON.

Consumer statuses: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`,
`REVERSED`, `CANCELLED`, `ACTION_REQUIRED`. Failed/pending are never
rewritten as completed for a simpler UI.

Safe filters: `from`, `to`, `status`, `type`, `currency`. Unknown keys
and invalid values are rejected (`INVALID_FILTER`). No raw SQL.

## Restrictions

Server-side codes:

- `DEBIT_BLOCKED`
- `CREDIT_BLOCKED`
- `WITHDRAWAL_BLOCKED`
- `TRANSFER_BLOCKED`
- `TRADING_BLOCKED`
- `CARD_BLOCKED`
- `COMPLIANCE_REVIEW`

Enforced in `MoneyMovementService.move` and
`BankingOperationsService.createHold` after Kernel ALLOW and before
`Ledger.postJournal`. A UI cannot lift a restriction.

`COMPLIANCE_REVIEW` blocks every movement class.

## Ownership

Phase B `ResourceOwnershipRegistry` is wired on the BFF runtime.
`GET /api/v1/accounts/:id` and activity/statement routes require
`VIEW_ACCOUNT` **and** an ownership grant (or admin `accounts:read`).

Designed for future joint / business / authorized-user grants. Those
products are not implemented in this prompt.

## API

Lovable BFF (`/api/v1`):

| Method | Path |
| --- | --- |
| GET | `/accounts` |
| GET | `/accounts/:accountId` |
| GET | `/accounts/:accountId/activity` |
| GET | `/accounts/:accountId/statement` |
| GET | `/me/home?valuationCurrency=` |
| GET | `/me/bootstrap` |

Query on activity: `cursor`, `limit`, `from`, `to`, `status`, `type`,
`currency`.

Platform `/v1/consumer/accounts` remains and now includes
`posted`/`available`/`held` plus `lifecycle` / `product_type`.

No public create-account endpoint.

## BFF Home / total wealth

Home `accounts` and `balances` come from `AccountProductService`.
`wealth.valuation` is explicit. Mixed-currency customers without FX
receive `VALUATION_UNAVAILABLE`.

## Statements

`GET /api/v1/accounts/:id/statement?from=&to=` returns authoritative
data: opening, closing, transactions, fees, period, currency, customer-
safe identifiers. No PDF renderer is included.

## Events

- `AccountOpened` — existing; treated as created
- `AccountActivated`
- `AccountRestricted`
- `AccountClosed`
- `CustomerActivityRecorded`

Sealed through the existing outbox. Not a second Evidence Vault.

## Sandbox personas

| Persona | Account state |
| --- | --- |
| `verified_us` | USD + SAR (multi-currency, no fabricated FX) |
| `investment` | USD cash + USD investment (multiple accounts) |
| `restricted` | USD cash + `COMPLIANCE_REVIEW` |
| `pending_activity` | USD cash with an active hold (pending activity) |
| `zero_balance` | USD cash account with posted 0 |
| `kyc_pending` / `suspended` | identity-gated; no account list |

## Frontend integration

Lovable should:

1. Render `lifecycle` and `restrictions`, not invent status.
2. Show `posted` / `pending` / `held` / `available` per currency.
3. Treat `wealth.valuation.state === UNAVAILABLE` as “valuation
   unavailable”, never as zero.
4. Page activity with the opaque `cursor`.
5. Use statement JSON for period views; PDF is out of scope.

## Known provider dependencies

- Bank / rail account numbers — later provider-link overlay
- Live FX conversion — Phase C Prompt 4
- Card / investment / Exchange activity adapters — later products
- PDF statements — not in this prompt

Production remains disabled.
