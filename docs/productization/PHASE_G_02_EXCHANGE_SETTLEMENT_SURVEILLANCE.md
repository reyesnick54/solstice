# Phase G Prompt 2 — Exchange settlement, surveillance, and market APIs

This is not production authorization and is not live trading.

`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`
`LIVE_EXCHANGE_ENABLED=false`
`ENVIRONMENT=simulation`

Phase G Prompt 1 matching remains the canonical owner
`packages/sunrey-exchange/src/matching.ts`. This prompt productizes
clearing, settlement, eligibility, surveillance, market data, and the
application-facing Exchange API on that same owner. Do not create
`packages/settlement`, `packages/clearing`, `packages/exchange-v2`,
or `packages/market-data`.

`SAFE_TO_PROCEED_TO_PHASE_G_PROMPT_3` is recorded at the end of this
document after validation.

## Owner

| Concern | Owner | Notes |
| --- | --- | --- |
| Matching | `packages/sunrey-exchange/src/matching.ts` | Unchanged authority |
| Fill obligations + clearing | `packages/sunrey-exchange/src/product` | New product overlay |
| Ledger fiat settlement | `Ledger.postJournal` via product ledger rail | Exchange does not invent fiat balances |
| Custody settlement | Canonical `ExchangeCustodyPort` shape | Webhook alone cannot credit |
| Native chain DVP | Existing `NativeAssetSettlementPort` + finality | `BFT_FINALIZED` required |
| Surveillance detectors | `packages/market-surveillance` | Alerts are candidates, not legal conclusions |
| Travel Rule | `packages/custody` travel-rule port | Hooked at `CAN_WITHDRAW` |
| Consumer BFF | `services/api` `/api/v1/exchange/*` | Orchestration only |
| Agent | `packages/sunrey-agent` tools | Proposal-only mutation |

## Clearing

Every fill creates a `FillObligation`. Clearing states:

`PENDING` → `VALIDATED` → `READY_TO_SETTLE` → `SETTLING` → `SETTLED`

Failure paths: `FAILED`, `REQUIRES_REVIEW`.

Order `FILLED` is independent of clearing `SETTLED`. The UI must show
clearing state next to order status. A fill is final settlement only
when atomic DVP succeeded in the same call and both rails reported
success (`fillIsFinalSettlement`).

## Settlement model

A fill records buyer, seller, base, quote, quantity, price, fees, and
settlement / custody / Ledger references. Settlement is rail-specific:

| Rail | Use | Coordination |
| --- | --- | --- |
| `LEDGER_FIAT` | Fiat / accounting quote legs | One balanced `Ledger.postJournal` with verified Execution Authority |
| `CUSTODY_ASSET` | Custodied third-party assets | Reserve + debit + `queryFinality`; webhook-only stays unverified |
| `NATIVE_CHAIN` | SunRey / MoonRey native assets | Atomic DVP; do not claim finality before `BFT_FINALIZED` |
| `APPLICATION_PORT` | Existing CoinPort / FiatPort simulation | Used by the current USD market path |

DVP objective: SunRey cannot permanently deliver one side without
accounting for the other. One-sided delivery is `REQUIRES_REVIEW` with
`DVP_PARTIAL`, not a silent success.

## Ledger integration

Fiat legs post through `Ledger.postJournal` with
`ACTION_TYPES.SETTLE_EXCHANGE_TRADE`. Reservation release/capture,
principal movement, and fees are journalled. Exchange does not keep
an independent fiat balance book.

## Custody integration

Custody rails track provider transaction reference, vault/account,
reservation, and confirmation. `CONFIRMED` is required before
`SETTLED`. An unverified webhook is `WEBHOOK_UNVERIFIED`.

## Native-chain settlement

Exchange order state is not protocol finality. Native settlement
records `txId`, height, and `PENDING_PROPOSAL` / `BFT_FINALIZED`.
Chain unavailability and reorg-class failures become review, not
claimed settlement.

## Settlement failure

Handled codes: custody unavailable, chain unavailable, Ledger failure,
provider pending/unknown, insufficient reserved asset, reorg, timeout,
one-sided DVP, unverified webhook.

Retry and repair reuse idempotency keys. Duplicate transfers are
blocked. Manual review does not silently mutate books.

## Reconciliation

Phase C-style persistent breaks compare Exchange positions to Ledger,
custody, and SunRey Chain views. Breaks are stored with
`autoCorrected: false` and `mutatedBooks: false`.

## Eligibility

Server-controlled capabilities:

- `CAN_TRADE` — identity, KYC, jurisdiction, listing, investor class, sanctions, risk, account, market, rail availability
- `CAN_DEPOSIT` — account + provider/custody/chain availability
- `CAN_WITHDRAW` — same plus Travel Rule when the pack requires it

These may diverge. Eligibility is not a client-side checkbox.

## Surveillance

Canonical detectors in `packages/market-surveillance`:

- wash trading / coordinated accounts
- self-trading
- spoofing / layering indicators
- cancel bursts
- abnormal volume
- price dislocation

Outputs are `CANDIDATE_ALERT` with `legalConclusion: false`. Review
cases record instrument, accounts, orders/fills, detector, severity,
and evidence. They are not automatic criminal conclusions.

## Self-trade prevention

Configurable policies (documented in `productizeSelfTradePolicy`):

| Policy | Behavior |
| --- | --- |
| `CANCEL_INCOMING` / `CANCEL_NEWEST` | Cancel the incoming order |
| `CANCEL_OLDEST` | Cancel the resting self-trade and continue matching |
| `PREVENT` / `REJECT` | Reject the incoming order |

## Market data and streaming

Product outputs: ticker, last trade, best bid/ask, order book, trades,
volume, OHLC/candles, market status. Every derived view carries
`asOf` and `freshnessMs`.

Streaming abstraction: in-process sequenced events encoded as SSE
topics `ticker`, `trade`, `order-book`, `order-status`. Privileged
internal topics are not exposed.

## API / BFF / SDK

Consumer BFF `/api/v1/exchange/*` (see Lovable mapping):

- markets, instrument, ticker, orderbook, trades, candles
- eligibility, preview
- orders GET/POST/DELETE
- fills, holdings
- stream

Canonical approval: Execution Authority or an approved Agent proposal.
`SunReyConsumerBffClient` exposes the same surface. Developer
OpenAPI `api/sunrey-exchange-v1.openapi.yaml` adds fills, holdings,
and stream.

## Lovable contract

Lovable can build Exchange Home, Markets, Asset Detail, Chart, Order
Book, Trade History, Buy, Sell, Order Preview, Open Orders, Order
History, Fills, Holdings, and Transaction Status without implementing
Exchange mathematics. Preview never guarantees execution price.

## Agent contract

Phase F tools consume market data, eligibility, holdings, preview,
proposal, and order status. The only mutation tool remains
`createExchangeOrderProposal`. Agents cannot submit raw orders.

## Production posture

Production trading remains disabled. `LIVE_EXCHANGE_ENABLED` stays
`false`. `ENVIRONMENT` stays `simulation`.

## Validation

Recorded after the Prompt 2 test run. Production trading remains
disabled regardless of the gate.

`SAFE_TO_PROCEED_TO_PHASE_G_PROMPT_3=false`
