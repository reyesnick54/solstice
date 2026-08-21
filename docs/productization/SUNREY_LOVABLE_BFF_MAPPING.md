# SunRey Lovable ↔ Consumer BFF mapping

Phase B Prompt 4. Maps future consumer screens to the canonical
Backend-for-Frontend at `services/api`.

Lovable must not call internal package topology. It talks to `/api/v1`.

This is not production authorization. `ENVIRONMENT` stays `simulation`.
`LIVE_*` stays `false`.

Authentication: `Authorization: Bearer <session>`. Sandbox personas use
`sandbox.<persona_id>` tokens. LOGIN itself is owned by the Phase B
authentication foundation; the BFF only consumes a verified session.

| Screen | Route | Method | Auth | Response resource | Domain dependency | Current status | Provider dependency |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LOGIN | (auth foundation, not this BFF) | — | — | session token | `packages/identity` | Phase B companion | none in simulation |
| HOME | `/api/v1/me/home` | GET | required | `sunrey.consumer.home.v1` | `services/accounts` balances + activity; identity profile | AVAILABLE_SIMULATION | none |
| MONEY | `/api/v1/accounts` | GET | required | account read models | `services/accounts` + Ledger-derived balances | AVAILABLE_SIMULATION | none |
| MONEY detail | `/api/v1/accounts/{id}` | GET | required + owner | account + ledger/available/held | `projectBankingPosition` | AVAILABLE_SIMULATION | none |
| MONEY activity | `/api/v1/accounts/{id}/activity` | GET | required + owner | cursor page | `projectTransactionHistory` | AVAILABLE_SIMULATION | none |
| SEND recipients | `/api/v1/recipients` | GET, POST | required | Recipient list / create | `packages/payments` beneficiaries + PaymentPlatform | AVAILABLE_SIMULATION | frontend cannot mark verified; agents cannot add |
| SEND recipient | `/api/v1/recipients/{id}` | GET | required + owner | Recipient | same | AVAILABLE_SIMULATION | cross-user denied |
| SEND quote | `/api/v1/payments/quote` | POST | required | PaymentQuote | PaymentPlatform quote preview | AVAILABLE_SIMULATION | `settlementTimePromise` is always null until Phase D rails |
| SEND | `/api/v1/payments` | GET, POST | required | Payment list / create | PaymentPlatform + canonical Ledger | AVAILABLE_SIMULATION | live rails = EXTERNAL_PROVIDER_REQUIRED |
| SEND detail | `/api/v1/payments/{id}` | GET | required + owner | Payment | PaymentPlatform | AVAILABLE_SIMULATION | backend owns status |
| SEND approve | `/api/v1/payments/{id}/approve` | POST | required + owner | Payment | PaymentPlatform approval | AVAILABLE_SIMULATION | used when quote requires CUSTOMER_CONFIRMATION |
| HOME | `/api/v1/me/home` | GET | required | `sunrey.consumer.home.v1` | Account Service wealth + accounts; `valuationCurrency` query; mixed FX is `UNAVAILABLE` | AVAILABLE_SIMULATION | FX conversion = Phase C Prompt 4 |
| MONEY | `/api/v1/accounts` | GET | required | account read models | Account Service product overlay + Ledger-derived posted/pending/held/available | AVAILABLE_SIMULATION | none |
| MONEY detail | `/api/v1/accounts/{id}` | GET | required + owner | lifecycle, restrictions, posted/available/held | `AccountProductService` + `projectBankingPosition` | AVAILABLE_SIMULATION | none |
| MONEY activity | `/api/v1/accounts/{id}/activity` | GET | required + owner | cursor page + safe filters | `AccountProductService.activity` | AVAILABLE_SIMULATION | none |
| STATEMENTS | `/api/v1/accounts/{id}/statement` | GET | required + owner | opening/closing/transactions/fees | `AccountProductService.statement` (data only, no PDF) | AVAILABLE_SIMULATION | PDF renderer not productized |
| SEND | `/api/v1/payments` | GET | required | availability stub | `packages/payments` | AVAILABLE_SIMULATION | live rails = EXTERNAL_PROVIDER_REQUIRED |
| FX | `/api/v1/fx` | GET | required | availability stub | `packages/payments` FX engine | AVAILABLE_SIMULATION | live FX = EXTERNAL_PROVIDER_REQUIRED |
| CARDS | `/api/v1/cards` | GET | required | availability stub | `packages/cards` | EXTERNAL_PROVIDER_REQUIRED | card processor |
| GROW | `/api/v1/grow` | GET | required | availability stub | `packages/platform` Growth Orchestrator | AVAILABLE_SIMULATION | none |
| AGENT | `/api/v1/agent` | GET | required | availability stub + Home recommendation count | `packages/sunrey-agent` ProposalGate | AVAILABLE_SIMULATION | none; BFF cannot execute |
| EXCHANGE | `/api/v1/exchange` | GET | required | availability stub | `packages/sunrey-exchange` consumer | AVAILABLE_SIMULATION | none |
| WALLET | `/api/v1/wallets` | GET | required | availability stub | cards wallet / chain mobile-sync | NOT_YET_PRODUCTIZED | wallet providers |
| DATA VAULT | `/api/v1/data` | GET | required | availability stub | `packages/personal-data-vault` | AVAILABLE_SIMULATION | none |
| PROFILE | `/api/v1/me` | GET, PATCH | required | controlled profile | identity + BFF preference store | AVAILABLE_SIMULATION | none |
| SECURITY | `/api/v1/security` | GET | required | availability + Home security alerts | identity sessions/devices | AVAILABLE_SIMULATION | none |

Bootstrap (every authenticated launch):

| Screen need | Route | Method | Auth | Resource |
| --- | --- | --- | --- | --- |
| App start | `/api/v1/me/bootstrap` | GET | required | profile, session, capabilities, pending actions, safe app config |
| Feature flags | `/api/v1/me/capabilities` | GET | required | server-computed `*Enabled` map |
| Enumerations | `/api/v1/catalog/enums` | GET | public catalog | client-safe statuses |
| Resource catalog | `/api/v1/catalog/resources` | GET | public catalog | grouping + availability |
| Sandbox personas | `/api/v1/sandbox/personas` | GET | none | non-production fixture list |

Capability flags (`paymentsEnabled`, `fxEnabled`, `cardsEnabled`,
`growEnabled`, `agentEnabled`, `exchangeEnabled`, `withdrawalsEnabled`,
`dataVaultEnabled`) are computed server-side from environment,
jurisdiction, eligibility, provider state, and product configuration.
Lovable must not decide whether a regulated feature is available.

Unavailable fields use `state` + `availability` + `reason` and a null
`value`. Provider failure is never a zero balance.

Phase C Prompt 2 account notes:

- Account balances are Ledger-derived. There is no client-writable
  `balance` and no `POST /api/v1/accounts` live-banking open.
- Home never sums USD + SAR minor units. Mixed-currency wealth is
  `MIXED_CURRENCY_WITHOUT_CONVERSION` until FX is productized.
- Activity filters: `from`, `to`, `status`, `type`, `currency` only.
- Sandbox personas include `basic_verified` (USD), `multi_currency`
  (USD + SAR), `pending_activity` (hold), `restricted`
  (`COMPLIANCE_REVIEW`), `investment` (multiple accounts), and
  `zero_balance` (posted 0).
