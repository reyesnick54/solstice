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
