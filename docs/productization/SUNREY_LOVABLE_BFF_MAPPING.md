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
| SEND | `/api/v1/payments` | GET | required | availability stub | `packages/payments` | AVAILABLE_SIMULATION | live rails = EXTERNAL_PROVIDER_REQUIRED |
| FX | `/api/v1/fx` | GET | required | availability catalog | `packages/payments` FX engine | AVAILABLE_SIMULATION | live FX = EXTERNAL_PROVIDER_REQUIRED |
| FX currencies | `/api/v1/fx/currencies` | GET | required | supported-currency metadata | `packages/domain` currency registry | AVAILABLE_SIMULATION | metadata ≠ live |
| FX quote | `/api/v1/fx/quotes` | POST | required | server-priced quote | `CREATE_FX_QUOTE` | AVAILABLE_SIMULATION | client must not compute the rate |
| FX quote read | `/api/v1/fx/quotes/{id}` | GET | required | immutable quote | `packages/payments` | AVAILABLE_SIMULATION | none |
| FX approve | `/api/v1/fx/quotes/{id}/accept` | POST | required | approved quote | `ACCEPT_FX_QUOTE` | AVAILABLE_SIMULATION | required approval |
| FX execute | `/api/v1/fx/quotes/{id}/execute` | POST | required | conversion result | `EXECUTE_FX_QUOTE` + Ledger | AVAILABLE_SIMULATION | expired quotes cannot execute |
| FX valuation | `/api/v1/fx/valuation` | GET | required | presentation total | reference rates | AVAILABLE_SIMULATION | not Ledger authority |
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
