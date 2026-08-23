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
| GROW | `/api/v1/grow` | GET | required | availability stub | `packages/platform` Growth Orchestrator | AVAILABLE_SIMULATION | none |
| AGENT | `/api/v1/agents` | GET, POST | required | Agent Home, conversations, streaming messages, settings, memory, pause/revoke | `packages/sunrey-agent` runtime + ProposalGate | AVAILABLE_SIMULATION | none; BFF cannot execute; Agent text is not authorization |
| GROW | `/api/v1/grow` | GET | required | `sunrey.consumer.grow.home.v1` | PEG + Growth Orchestrator + Grow lifecycle | SANDBOX_FUNCTIONAL | live brokerage = PROVIDER_ADAPTER_REQUIRED |
| GROW snapshot | `/api/v1/grow/snapshot` | GET | required | financial snapshot | `packages/personal-economic-graph` | SANDBOX_FUNCTIONAL | Ledger wins; PEG is not balances |
| GROW goals | `/api/v1/grow/goals` | GET, POST | required | goal list / create | PEG `declareGoal` | SANDBOX_FUNCTIONAL | none |
| GROW opportunities | `/api/v1/grow/opportunities` | GET | required | opportunity list | PEG + orchestrator detectors | SANDBOX_FUNCTIONAL | not executable |
| GROW dismiss | `/api/v1/grow/opportunities/{id}/dismiss` | POST | required | dismissed flag | Grow BFF | SANDBOX_FUNCTIONAL | none |
| GROW plan | `/api/v1/grow/plan` | GET | required | Growth Plan | `packages/platform` orchestrator | SANDBOX_FUNCTIONAL | `achievementPromised: false` |
| GROW plan request | `/api/v1/grow/plan/request` | POST | required | new plan | orchestrator invalidation | SANDBOX_FUNCTIONAL | none |
| GROW plan pause/resume | `/api/v1/grow/plan/pause` `/resume` | POST | required | lifecycle | activated plan | SANDBOX_FUNCTIONAL | not perpetual authority |
| GROW plan progress | `/api/v1/grow/plan/progress` | GET | required | component states | Grow lifecycle | SANDBOX_FUNCTIONAL | none |
| GROW scenarios | `/api/v1/grow/scenarios` | GET | required | projection/estimate bands | Grow scenario engine | SANDBOX_FUNCTIONAL | never a promised outcome |
| GROW proposal create | `/api/v1/grow/proposals` | POST | required | server-owned proposal | Grow proposal engine | SANDBOX_FUNCTIONAL | client instructions untrusted |
| GROW proposal detail | `/api/v1/grow/proposals/{id}` | GET | required + owner | explainability | Grow store | SANDBOX_FUNCTIONAL | none |
| GROW proposal modify | `/api/v1/grow/proposals/{id}/modify` | POST | required + owner | new version | supersedes prior | SANDBOX_FUNCTIONAL | forged hash refused |
| GROW approval | `/api/v1/grow/proposals/{id}/approve` | POST | required + owner + step-up | approval id | human only | SANDBOX_FUNCTIONAL | Agent cannot self-approve |
| GROW execute | `/api/v1/grow/proposals/{id}/execute` | POST | required + owner | execution state | Kernel + investments + Provider Runtime | SANDBOX_FUNCTIONAL | live investment disabled |
| GROW execution | `/api/v1/grow/executions/{id}` | GET | required + owner | normalized state | Grow execution record | SANDBOX_FUNCTIONAL | submitted ≠ completed |
| GROW portfolio | `/api/v1/grow/portfolio` | GET | required | holdings/allocation/risk | `packages/investments` | SANDBOX_FUNCTIONAL | PROVIDER_ADAPTER_REQUIRED for live |
| GROW performance | `/api/v1/grow/performance` | GET | required | planned/executed/current | Grow performance read model | SANDBOX_FUNCTIONAL | deposits are not performance |
| GROW recurring | `/api/v1/grow/recurring` | POST | required | mandate | each occurrence revalidated | SANDBOX_FUNCTIONAL | Agent cannot increase amount |
| GROW recurring cancel | `/api/v1/grow/recurring/{id}/cancel` | POST | required | REVOKED | Grow lifecycle | SANDBOX_FUNCTIONAL | none |
| GROW monitor | `/api/v1/grow/monitor` | POST | required | findings | monitoring cycle | SANDBOX_FUNCTIONAL | no silent trade |
| GROW | `/api/v1/grow` | GET | required | catalog + latest Grow My Money experience | `packages/platform` product Growth Plan | AVAILABLE_SIMULATION | illustrations only; not guaranteed |
| GROW plan create | `/api/v1/grow/plans` | POST | required | server-issued plan + primary proposal | `ProductGrowthService` | AVAILABLE_SIMULATION | client cannot issue proposal JSON |
| GROW plan read | `/api/v1/grow/plans/{id}` | GET | required + owner | Growth Plan | `packages/platform` | AVAILABLE_SIMULATION | cross-user denied |
| GROW proposals | `/api/v1/grow/proposals` | GET | required + owner | structured Financial Proposals | `packages/platform` | AVAILABLE_SIMULATION | unknown ids are not executable |
| GROW proposal read | `/api/v1/grow/proposals/{id}` | GET | required + owner | immutable proposal | `packages/platform` | AVAILABLE_SIMULATION | fabricated ids fail closed |
| GROW modify | `/api/v1/grow/proposals/{id}/modify` | POST | required + owner | new proposal version | `ProductGrowthService` | AVAILABLE_SIMULATION | supersedes prior terms |
| GROW approve | `/api/v1/grow/proposals/{id}/approve` | POST | required + owner + step-up when required | Phase B approval | `transitionApproval` | AVAILABLE_SIMULATION | no Execution Authority, no journal |
| GROW reject | `/api/v1/grow/proposals/{id}/reject` | POST | required + owner | rejected proposal | Phase B approval | AVAILABLE_SIMULATION | none |
| GROW | `/api/v1/grow` | GET | required | availability stub | `packages/platform` Growth Orchestrator | AVAILABLE_SIMULATION | not a live broker |
| GROW portfolio | `/api/v1/grow/portfolio` | GET | required + owner | `sunrey.grow.portfolio.v1` | `packages/investments` InvestmentPlatform | AVAILABLE_SIMULATION | licensed broker + custody required for live |
| GROW holdings | `/api/v1/grow/portfolio/holdings` | GET | required + owner | `sunrey.grow.holdings.v1` | lots + Phase D market-data freshness | AVAILABLE_SIMULATION | stale prices identified; no frontend math |
| GROW performance | `/api/v1/grow/portfolio/performance` | GET | required + owner | `sunrey.grow.performance.v1` | TWR / Modified Dietz engine | AVAILABLE_SIMULATION | LLMs are not authoritative |
| GROW allocation | `/api/v1/grow/portfolio/allocation` | GET | required + owner | `sunrey.grow.allocation.v1` | actual vs target weights in bps | AVAILABLE_SIMULATION | none |
| GROW risk | `/api/v1/grow/portfolio/risk` | GET | required + owner | `sunrey.grow.risk.v1` | concentration / exposure / fail-closed volatility | AVAILABLE_SIMULATION | no fabricated statistics |
| GROW | `/api/v1/grow` | GET | required | opportunity feed | `packages/platform` Growth Orchestrator | AVAILABLE_SIMULATION | none |
| GROW feed | `/api/v1/grow/opportunities` | GET | required | ranked cards | Growth Orchestrator detectors + eligibility | AVAILABLE_SIMULATION | none |
| GROW detail | `/api/v1/grow/opportunities/{id}` | GET | required + owner | Opportunity | same | AVAILABLE_SIMULATION | cross-user denied |
| GROW dismiss | `/api/v1/grow/opportunities/{id}/dismiss` | POST | required + owner | Opportunity | lifecycle; fingerprint suppressed | AVAILABLE_SIMULATION | none |
| GROW start | `/api/v1/grow/opportunities/{id}/start-proposal` | POST | required + owner | proposal receipt | does not execute money | AVAILABLE_SIMULATION | none |
| GROW | `/api/v1/grow` | GET | required | availability catalog | `packages/personal-economic-graph` + Growth Orchestrator | AVAILABLE_SIMULATION | none |
| FINANCIAL PROFILE | `/api/v1/grow/profile` | GET | required + owner | `sunrey.grow.profile.v1` | PEG snapshot + suitability + insights | AVAILABLE_SIMULATION | not Ledger authority; no guaranteed return |
| FINANCIAL SNAPSHOT | `/api/v1/grow/snapshot` | GET | required + owner | `FinancialIntelligenceSnapshot` | PEG + Phase C presentation valuation | AVAILABLE_SIMULATION | `crossCurrencyTotal` is always null |
| GOALS | `/api/v1/grow/goals` | GET, POST, PATCH | required + owner | goal resources | PEG user-declared goals | AVAILABLE_SIMULATION | cannot override Ledger balances |
| INSIGHTS | `/api/v1/grow/insights` | GET | required + owner | derived insights | deterministic PEG insights | AVAILABLE_SIMULATION | Prompt 2 owns recommendations |
| RISK PROFILE | `/api/v1/grow/suitability` | GET, POST | required + owner | suitability profile | deterministic questionnaire | AVAILABLE_SIMULATION | LLM must not fabricate scores |
| AGENT | `/api/v1/agent` | GET | required | availability stub + Home recommendation count | `packages/sunrey-agent` ProposalGate | AVAILABLE_SIMULATION | none; BFF cannot execute |
| AGENT conversation | `/api/v1/agent/conversations` | POST | required | conversation + Action Card turns | `packages/sunrey-agent` conversation runtime | AVAILABLE_SIMULATION | Agent cannot approve; step-up is Phase B MFA |
| AGENT Action Center | `/api/v1/agent/actions` | GET, POST | required + owner | Action Cards, history, availableActions | conversation Action Center | AVAILABLE_SIMULATION | frontend cannot invent transitions |
| EXCHANGE | `/api/v1/exchange` | GET | required | availability stub | `packages/sunrey-exchange` consumer | AVAILABLE_SIMULATION | none |
| WALLET | `/api/v1/wallets` | GET | required | `sunrey.consumer.wallet.v1` list | `packages/custody` product | AVAILABLE_SIMULATION | no signing material; production signing disabled |
| WALLET detail | `/api/v1/wallets/{id}` | GET | required + owner | wallet + balances | same | AVAILABLE_SIMULATION | cross-user denied |
| WALLET receive | `/api/v1/wallets/{id}/deposit-address` | GET | required + owner | address + QR payload | same | AVAILABLE_SIMULATION | network/asset bound |
| WALLET history | `/api/v1/wallets/{id}/transactions` | GET | required + owner | client-safe finality | same | AVAILABLE_SIMULATION | none |
| WALLET quote | `/api/v1/wallets/{id}/withdrawal-quote` | POST | required + owner | fee estimate + Travel Rule | same | AVAILABLE_SIMULATION | estimates only |
| WALLET withdraw | `/api/v1/wallets/{id}/withdrawals` | POST | required + owner + step-up | withdrawal or Agent proposal | Kernel-gated custody | AVAILABLE_SIMULATION | Agent cannot execute |
| ASSET detail | `/api/v1/assets/{assetId}` | GET | required | SunRey / MoonRey aggregate | custody + market fixture | AVAILABLE_SIMULATION | supply is not a mint |
| ECONOMY | `/api/v1/economy` | GET | required | `sunrey.consumer.native-economy.v1` | `packages/sunrey-chain` native-assets + AssetSupplyBook | AVAILABLE_SIMULATION | read-only; no mint/burn; valuation is not market price |
| ECONOMY supply | `/api/v1/economy/supply` | GET | required | total/issued/circulating supply | singular protocol supply authority | AVAILABLE_SIMULATION | not market cap; tickers NOT_ASSIGNED |
| ECONOMY asset | `/api/v1/economy/assets/{id}` | GET | required | SUNREY_COIN or MOONREY_COIN metadata | native asset registry | AVAILABLE_SIMULATION | invented assets 404 |
| EXCHANGE | `/api/v1/exchange` | GET | required | catalog + screens | `packages/sunrey-exchange` product API | AVAILABLE_SIMULATION | production trading disabled |
| EXCHANGE Home / Markets | `/api/v1/exchange/markets` | GET | required | market list | same | AVAILABLE_SIMULATION | none |
| EXCHANGE Asset Detail / Chart / Book / History | `/api/v1/exchange/markets/{instrument}` plus `/ticker` `/orderbook` `/trades` `/candles` | GET | required | ticker, book, trades, OHLC | same | AVAILABLE_SIMULATION | freshness is explicit; last trade is not a guaranteed price |
| EXCHANGE Buy / Sell preview | `/api/v1/exchange/preview` | POST | required | order preview | same | AVAILABLE_SIMULATION | no frontend math; no guaranteed execution price |
| EXCHANGE orders | `/api/v1/exchange/orders` | GET, POST, DELETE | required + owner | orders | Kernel / approved proposal | AVAILABLE_SIMULATION | agent orders require `proposalId` |
| EXCHANGE fills / holdings / status | `/api/v1/exchange/fills` `/holdings` | GET | required + owner | fills with clearing state | same | AVAILABLE_SIMULATION | FILLED is not SETTLED |
| EXCHANGE stream | `/api/v1/exchange/stream` | GET | required | SSE ticker/trade/book/order-status | same | AVAILABLE_SIMULATION | privileged topics are not exposed |
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
