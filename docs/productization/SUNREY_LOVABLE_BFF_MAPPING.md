# SunRey Lovable ↔ Consumer BFF mapping

Phase B mapped screens to `services/api`. Phase C productizes the
Lovable-facing money surface on the consumer platform
(`services/consumer-platform`, `/v1/consumer/*`) and the browser-safe
SDK `@solstice/sunrey-sdk/consumer`.

Lovable must not call internal package topology. Prefer the consumer
platform contract in `api/sunrey-consumer-platform-v1.openapi.yaml`.
`services/api` `/api/v1` stubs are not a second ledger or money plane.

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
| SEND | `/v1/consumer/transfers` and `/v1/consumer/payments` | POST | required | transfer / payment DTOs | `services/accounts` + `packages/payments` | SANDBOX_FUNCTIONAL | live rails = PROVIDER_ADAPTER_REQUIRED |
| RECIPIENTS | `/v1/consumer/recipients` | GET, POST | required | recipient DTOs | `packages/payments` beneficiaries | SANDBOX_FUNCTIONAL | none in simulation |
| FX | `/v1/consumer/fx/quotes` | POST | required | server-owned quote | `packages/payments` FX engine | SANDBOX_FUNCTIONAL | live FX = PROVIDER_ADAPTER_REQUIRED |
| CARDS | `/v1/consumer/cards` | GET, POST | required | simulated card DTOs | `packages/cards` | SANDBOX_FUNCTIONAL | live processor = PROVIDER_ADAPTER_REQUIRED |
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
| CARDS | `/api/v1/cards` | GET, POST | required + step-up on POST | PCI-minimized card list / issue | `packages/cards` + `services/cards` | AVAILABLE_SIMULATION | simulated processor; live issuer is Phase D |
| CARD detail | `/api/v1/cards/{id}` | GET | required + owner | status, last4, funding available, controls, activity, wallet | `packages/cards` | AVAILABLE_SIMULATION | none in simulation |
| CARD freeze | `/api/v1/cards/{id}/freeze` | POST | required + step-up | updated card | Kernel-gated `FREEZE_CARD` | AVAILABLE_SIMULATION | none in simulation |
| CARD unfreeze | `/api/v1/cards/{id}/unfreeze` | POST | required + step-up | updated card | Kernel-gated `UNFREEZE_CARD` | AVAILABLE_SIMULATION | none in simulation |
| CARD controls | `/api/v1/cards/{id}/controls` | PATCH | required + step-up | server-enforced controls | Kernel-gated `UPDATE_CARD_CONTROLS` | AVAILABLE_SIMULATION | none in simulation |
| CARD wallet | `/api/v1/cards/{id}/wallet` | GET | required + owner | eligibility/status | cards wallet module | AVAILABLE_SIMULATION | Apple/Google certification is Phase D |
| FX | `/api/v1/fx` | GET | required | availability catalog | `packages/payments` FX engine | AVAILABLE_SIMULATION | live FX = EXTERNAL_PROVIDER_REQUIRED |
| FX currencies | `/api/v1/fx/currencies` | GET | required | supported-currency metadata | `packages/domain` currency registry | AVAILABLE_SIMULATION | metadata ≠ live |
| FX quote | `/api/v1/fx/quotes` | POST | required | server-priced quote | `CREATE_FX_QUOTE` | AVAILABLE_SIMULATION | client must not compute the rate |
| FX quote read | `/api/v1/fx/quotes/{id}` | GET | required | immutable quote | `packages/payments` | AVAILABLE_SIMULATION | none |
| FX approve | `/api/v1/fx/quotes/{id}/accept` | POST | required | approved quote | `ACCEPT_FX_QUOTE` | AVAILABLE_SIMULATION | required approval |
| FX execute | `/api/v1/fx/quotes/{id}/execute` | POST | required | conversion result | `EXECUTE_FX_QUOTE` + Ledger | AVAILABLE_SIMULATION | expired quotes cannot execute |
| FX valuation | `/api/v1/fx/valuation` | GET | required | presentation total | reference rates | AVAILABLE_SIMULATION | not Ledger authority |
| CARDS | `/api/v1/cards` | GET | required | availability stub | `packages/cards` | EXTERNAL_PROVIDER_REQUIRED | card processor |
| GROW | `/api/v1/grow` | GET | required | availability catalog | `packages/personal-economic-graph` + Growth Orchestrator | AVAILABLE_SIMULATION | none |
| FINANCIAL PROFILE | `/api/v1/grow/profile` | GET | required + owner | `sunrey.grow.profile.v1` | PEG snapshot + suitability + insights | AVAILABLE_SIMULATION | not Ledger authority; no guaranteed return |
| FINANCIAL SNAPSHOT | `/api/v1/grow/snapshot` | GET | required + owner | `FinancialIntelligenceSnapshot` | PEG + Phase C presentation valuation | AVAILABLE_SIMULATION | `crossCurrencyTotal` is always null |
| GOALS | `/api/v1/grow/goals` | GET, POST, PATCH | required + owner | goal resources | PEG user-declared goals | AVAILABLE_SIMULATION | cannot override Ledger balances |
| INSIGHTS | `/api/v1/grow/insights` | GET | required + owner | derived insights | deterministic PEG insights | AVAILABLE_SIMULATION | Prompt 2 owns recommendations |
| RISK PROFILE | `/api/v1/grow/suitability` | GET, POST | required + owner | suitability profile | deterministic questionnaire | AVAILABLE_SIMULATION | LLM must not fabricate scores |
| AGENT | `/api/v1/agent` | GET | required | availability stub + Home recommendation count | `packages/sunrey-agent` ProposalGate | AVAILABLE_SIMULATION | none; BFF cannot execute |
| EXCHANGE | `/api/v1/exchange` | GET | required | availability stub | `packages/sunrey-exchange` consumer | AVAILABLE_SIMULATION | none |
| WALLET | `/api/v1/wallets` | GET | required | availability stub | cards wallet / chain mobile-sync | NOT_YET_PRODUCTIZED | wallet providers |
| DATA VAULT | `/api/v1/data` | GET | required | availability stub | `packages/personal-data-vault` | AVAILABLE_SIMULATION | none |
| PROFILE | `/api/v1/me` | GET, PATCH | required | controlled profile + `identityVerification` | identity + BFF preference store | AVAILABLE_SIMULATION | none; client-safe KYC only |
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

USD 1,000 → SAR Lovable flow (no client FX math):

1. `POST /api/v1/fx/quotes` with `sourceAccountId`, `sourceCurrency=USD`,
   `destinationCurrency=SAR`, `sourceAmountMinorUnits="100000"`.
2. Review the returned quote (`destinationAmountMinorUnits`, `feeMinorUnits`,
   `expiresAt`, `requiredApproval`).
3. `POST /api/v1/fx/quotes/{id}/accept` with the source `accountId`.
4. `POST /api/v1/fx/quotes/{id}/execute` with source and SAR destination
   account ids.
5. Home `valuation` is presentation-only and includes `rateTimestamp`.
   Mixed-currency `wealth` remains `MIXED_CURRENCY_WITHOUT_CONVERSION`.
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
