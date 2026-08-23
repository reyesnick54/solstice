# Phase E Prompt 3 — Investment, Portfolio, and Performance Engine

This is not production authorization and is not a live securities
brokerage.

`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`
`LIVE_INVESTMENT_EXECUTION=false`
`LIVE_SECURITIES_BROKERAGE=false`
`ENVIRONMENT=simulation`

Phase D closed with `READY_FOR_PHASE_E=true`. This prompt productizes
the investment-domain backend for Grow My Money on the canonical owner
`packages/investments`. `services/investments` remains the application
facade. Do not create `packages/portfolio`, `packages/brokerage`,
`packages/trading`, `packages/wealth`, or `packages/investments-v2`.

Portfolio tables are not an independent financial authority. Cash,
reservations, purchases, sales, fees, settlement, and income journals
remain Kernel-gated Ledger postings through `Ledger.postJournal` with a
verified Execution Authority.

## Canonical implementation

| Concern | Owner | Notes |
| --- | --- | --- |
| Investment accounts, paper orders, lots, FIFO cost | `packages/investments` (`InvestmentsService`) | Chunk 19 paper core |
| Product overlay (portfolio, performance, allocation, risk, eligibility, execution adapter) | `packages/investments/src/product` (`InvestmentPlatform`) | This prompt |
| Application facade | `services/investments` | Re-exports only |
| Growth opportunities | `packages/platform` Growth Orchestrator | `PROPOSAL_ONLY`; cannot execute |
| Strategy Lab / Agentic Capital Mesh | Existing packages | Consume investments; do not own books |
| Market data contract | Phase D `packages/sunrey-exchange/src/market-data` | Bridged; stale quotes identified |
| Custody / Provider Runtime | Phase D owners | Real brokers attach later |
| Consumer BFF / Lovable | `services/api` `/api/v1/grow/portfolio*` | Read-only; no execute APIs |
| Ledger | `packages/ledger` | Sole cash/settlement authority |

A sandbox fill is never a live securities execution.

## Instrument model

Canonical product metadata is `InstrumentProduct` in
`packages/investments/src/product/instrument-catalog.ts`.

Asset classes:

- `CASH`
- `MONEY_MARKET`
- `EQUITY`
- `ETF`
- `FUND`
- `BOND` / `FIXED_INCOME` (taxonomy includes both; the seeded fixture is `FIXED_INCOME`)
- `DIGITAL_ASSET` — catalog row exists, status `UNAVAILABLE`, `digitalAssetAllowed=false`
- `OTHER_APPROVED_PRODUCT` — catalog row exists, status `RESEARCH_REQUIRED`

Unsupported products are not hardcoded as available.

Each instrument carries:

- identifier / instrumentId
- asset class
- currency
- risk category (`LOW` / `MODERATE` / `HIGH` / `UNKNOWN`)
- liquidity (`HIGH` / `MEDIUM` / `LOW` / `UNKNOWN`)
- pricing source
- jurisdiction eligibility
- minimums (quantity and optional amount)
- fees where known
- provider
- status (`AVAILABLE_SIMULATION` / `UNAVAILABLE` / `RESEARCH_REQUIRED` / `HALTED` / `DELISTED`)
- `simulation=true`, `liveListing=false`

## Portfolio model

`InvestmentPortfolio` is an overlay over the existing investment
account profile. Fields:

- `portfolioId`
- `owner`
- linked brokerage cash, securities, and pending-settlement accounts
- base / display currency
- strategy reference
- risk profile reference
- goal links
- restrictions
- status (`PENDING` / `ACTIVE` / `RESTRICTED` / `FROZEN` / `CLOSED`)

There is no stored `balance`. Cash and invested totals are derived from
Ledger-backed valuations. Holdings reconcile to lots and authorized
journals.

## Position / holdings model

Holdings expose:

- quantity (scaled integer units)
- instrument
- average cost / remaining cost basis (`Money.allocate`, floor)
- market price
- market value
- unrealized and realized gain/loss
- income
- currency
- valuation `{ source, timestamp, freshnessMs, quality, stale }`

Money stays in integer minor units. There is no floating-point path and
no blended yield / APY / APR field on positions.

## Market data

Phase D `MarketQuoteSource` is bridged in
`packages/investments/src/product/market-bridge.ts`. Every valuation
carries source, timestamp, and freshness. Stale quotes are
`quality=STALE` and block amount-based order sizing.

## Performance methodology

Authoritative calculator:
`packages/investments/src/product/performance.ts`.

`authoritativeCalculator = INVESTMENT_PERFORMANCE_ENGINE`
`llmAuthoritative = false`

Frontend and LLM output are not books.

Money stays in integer minor units. Period return is integer basis
points (1 bp = 0.01 percentage point). There is no percentage-return
field on positions, balances, or growth paths. The BFF field is
`periodReturnBps`.

### Time-weighted return (`TWR_LINKED_SUBPERIODS`, default)

External cash flows (deposits / withdrawals) sit at sub-period
boundaries. Income earned by holdings is part of ending market value
and is not an external cash flow.

For sub-period i:

```
1 + r_i = EMV_i / BMV_i
```

`BMV_i` is market value immediately after any opening cash flow of that
sub-period. `EMV_i` is market value at the next boundary before the
next external cash flow.

Linked TWR:

```
1 + TWR = Π_i (1 + r_i)
periodReturnBps = floor((Π num_i / Π den_i) * 10000) - 10000
```

A zero-BMV sub-period is skipped (undefined; not invented).

### Modified Dietz (`MODIFIED_DIETZ`)

Money-weighted approximation for the whole period:

```
r = (EMV - BMV - CF) / (BMV + Σ_j w_j * CF_j)
w_j = (T - t_j) / T
```

`T` is the UTC civil-day span. Same-day periods use `T = 1`. Cash flows
are signed: deposits positive, withdrawals negative.

Absolute return = `EMV - BMV - CF` (Money). This is not a percentage.

Benchmark comparison, when supplied, is `periodReturnBps - benchmarkBps`.

## Allocation

Actual allocation views:

- asset class
- instrument
- currency
- risk class

Weights are integer basis points. Target allocation is a separate
object; target weights plus cash must sum to 10_000 bps. Default
balanced target is a fixture, not advice.

## Rebalancing

`analyzeRebalance` compares actual vs target under constraints
(minimum trade size, fee/tax assumptions, drift threshold) and emits
candidate `BUY` / `SELL` amount-based trades.

Output status is always `PROPOSED`. `executes=false`.
`liveExecution=false`. Growth Orchestrator may surface the proposal; it
cannot submit it.

## Risk metrics

Computed from available allocation, holdings, and valuation history:

- concentration (largest instrument weight)
- currency exposure
- liquidity exposure
- asset-class exposure
- drawdown when history exists
- volatility only when at least three observations exist; otherwise
  `INSUFFICIENT_DATA` and `stdevBps=null`

`fabricatedStatistics=false`. Sophisticated statistics are not invented.

## Eligibility / suitability

`evaluateProductSuitability` checks, before a product is available:

- KYC (`identityVerified` / `identityUsable`)
- customer ACTIVE
- jurisdiction (unknown corridors are `RESEARCH_REQUIRED`)
- instrument jurisdiction eligibility
- instrument status (unsupported / research-required stay closed)
- digital-asset allow flag
- provider availability
- product restrictions
- investor classification when required
- experience vs instrument risk
- liquidity need vs instrument liquidity
- live flags remain false

Unknown corridors are never `CONFIRMED_BY_COUNSEL`.

## Order / proposal object

`InvestmentOrderProposal` supports `BUY` / `SELL` and `QUANTITY` /
`AMOUNT` sizing.

States:

`PROPOSED` → `AWAITING_APPROVAL` → `AUTHORIZED` → `SUBMITTED` →
`PARTIALLY_FILLED` / `FILLED`

Terminal: `CANCELLED`, `REJECTED`, `FAILED`.

A sandbox fill sets `fillIsLiveSecuritiesExecution=false`.
`liveExecution=false`.

## Provider execution adapter

`InvestmentExecutionAdapter` is provider-independent:

- `submitOrder`
- `cancelOrder`
- `getOrder`
- `getFills`
- `getPositions`
- `getCash`
- `getStatement` (provider view; `PROVIDER_VIEW_NOT_LEDGER_AUTHORITY`)

`productionAuthorized=false`. `liveProviderConnected=false`.
The adapter cannot issue Execution Authority. Licensed brokers attach
later through Phase D Provider Runtime.

## Sandbox investment provider

`SandboxInvestmentExecutionProvider` is deterministic and
simulation-only. Scenarios:

- `FILLED`
- `PARTIAL_FILL`
- `REJECTED`
- `PENDING`
- `CANCELLED`
- `MARKET_UNAVAILABLE`

## Ledger / custody integration

| Event | Accounting |
| --- | --- |
| Cash reserved | Overlay hold; optional `BROKERAGE_CASH → PENDING_SETTLEMENT` journal |
| Purchase | Existing paper-order journals via `InvestmentsService` + Kernel |
| Sale | Compensating journals; FIFO lot close |
| Fees | Journal when known; otherwise fee schedule `known=false` |
| Settlement | Pending-settlement release / capture |
| Income | Cash-flow overlay plus authorized journal when posted |

Reservations are not a second ledger. Custody remains
`packages/custody`. Provider statements reconcile to Ledger; they do
not replace it.

## Growth integration

Growth Orchestrator consumes portfolio, allocation, risk, and
performance through `planning.investmentReview` and emits:

- `REBALANCE_PORTFOLIO_PROPOSAL`
- `DIVERSIFY_CONCENTRATION_PROPOSAL`
- `DEPLOY_INVESTMENT_CASH_PROPOSAL`

Each is `PROPOSAL_ONLY`. `canExecuteToday=false`.
`investmentExecutionImplemented` remains `false`. Materialization does
not create an ActionIntent for these kinds.

## BFF / API

Client-safe read routes (no privileged execution):

- `GET /api/v1/grow` — availability
- `GET /api/v1/grow/portfolio`
- `GET /api/v1/grow/portfolio/holdings`
- `GET /api/v1/grow/portfolio/performance`
- `GET /api/v1/grow/portfolio/allocation`
- `GET /api/v1/grow/portfolio/risk`

Cross-user reads return `403` / `RESOURCE_NOT_OWNED`. Missing
portfolios return `404`. `POST /api/v1/grow/portfolio/execute` is not
registered.

OpenAPI: `api/sunrey-consumer-bff-v1.openapi.yaml`.
SDK: `SunReyConsumerBffClient.getGrowPortfolio` and siblings.

## Lovable UX contract

Lovable may render:

- Portfolio Value
- Holdings
- Allocation
- Performance
- Profit/Loss
- Income
- Risk
- Goals (link ids only on this prompt)
- Recommendations (Growth proposals)

Authoritative values come from `INVESTMENT_PLATFORM`.
`frontendMathAuthoritative=false`. `llmAuthoritative=false`.
`securitiesBrokerageLive=false`.

## External licensing / provider dependencies

Live Grow My Money securities brokerage requires, at minimum:

- a licensed introducing / carrying broker or equivalent
- a regulated custody arrangement
- jurisdiction-specific product authorization and investor classification
- counsel-confirmed corridor policy (currently `RESEARCH_REQUIRED`)
- Phase D Provider Runtime binding for the selected broker
- Kernel + Execution Authority for every cash or position mutation
- production flags that remain off in this repository

None of those are connected. `ENVIRONMENT` stays `simulation`.

## Tests

Covered in `packages/investments/src/product.test.ts` and
`services/api/src/consumer-grow.test.ts`:

- catalog / unsupported products
- portfolio persist and valuation
- stale price
- performance with deposits / withdrawals
- allocation, concentration, rebalance
- suitability
- order proposal
- sandbox fill / partial fill / rejection / market unavailable
- Ledger reservation
- cross-user denial
- BFF read routes and missing execute API
