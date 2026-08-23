# Phase G Prompt 1 — SunRey Exchange production core

This is a productization record for the canonical SunRey Exchange.
It is not production authorization, a live venue, or a claim that
external legal / custody / licensing gates are satisfied.

Do not begin Prompt 2 in this document.

`CORE_CODE_COMPLETE_CANDIDATE=true`
`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`
`production_authorized=false`
`ENVIRONMENT=simulation`
`LIVE_EXCHANGE_ENABLED=false`
`LIVE_TRADING_ENABLED=false`

---

## 1. Canonical Exchange path

| Concern | Path |
| --- | --- |
| Service | `packages/sunrey-exchange/src/service.ts` `SunReyExchangeService` |
| Matching | `packages/sunrey-exchange/src/matching.ts` |
| Production core | `packages/sunrey-exchange/src/production-core/` |
| Instrument registry | `packages/sunrey-exchange/src/production-core/instrument.ts` |
| Order lifecycle | `packages/sunrey-exchange/src/production-core/order-lifecycle.ts` |
| Pre-trade validation | `packages/sunrey-exchange/src/production-core/validation.ts` |
| Fees | `packages/sunrey-exchange/src/production-core/fees.ts` |
| Reservations | `packages/sunrey-exchange/src/production-core/reservation.ts` |
| Market controls | `packages/sunrey-exchange/src/production-core/controls.ts` |
| Cancel/fill race | `packages/sunrey-exchange/src/production-core/sequencer.ts` |
| Snapshot / restore | `packages/sunrey-exchange/src/production-core/snapshot.ts` |
| Replay | `packages/sunrey-exchange/src/production-core/replay.ts` |
| Persistence port | `packages/sunrey-exchange/src/production-core/persistence-port.ts` |
| Durable adapter | `packages/persistence/src/exchange/durable-core-store.ts` |
| PostgreSQL adapter | `packages/persistence/src/exchange/pg-exchange-core-store.ts` |
| Existing SQL | `db/customer/migrations/V025__sunrey_exchange.sql`, `V027__operational_persistence.sql` |

Do not create `packages/exchange-v2`, `packages/matching-engine`, or a
second Exchange. Persistence is not a second ledger.

---

## 2. Audit classification

| Surface | Class |
| --- | --- |
| `SunReyExchangeService` digital-asset path | PRODUCTION-CAPABLE simulation (now persistent) |
| Price-time matching | PRODUCTION-CAPABLE (deterministic, bigint) |
| Coin/Fiat ports | SIMULATION-ONLY adapters over Ledger/custody ports |
| `ExchangeStore` | was IN-MEMORY; now snapshotted / recoverable |
| V025 metadata tables | PERSISTENCE-GAPPED for updates (INSERT-only); operational V027 updates order state |
| Universal / compute / capacity families | SIMULATION-ONLY specialized |
| Consumer / ops / native-clearing | ACTIVE_SPECIALIZED; not replaced |
| Agent tool | CANONICAL read / propose only |
| Live trading | DISABLED |

---

## 3. Market model

Server-authoritative productized statuses:

`PREOPEN` `OPEN` `HALTED` `AUCTION` `CLOSE_ONLY` `CLOSED` `SUSPENDED`

Existing operational aliases remain: `CANCEL_ONLY`, `PAUSED`, `RESTRICTED`.

A productized instrument includes:

`instrumentId`, `baseAsset`, `quoteAsset`, `marketType` (`SPOT`),
`status`, `priceIncrement`, `quantityIncrement`, `minimumOrderSize`,
`maximumOrderSize`, `minimumNotional`, `maximumNotional`, `feeScheduleId`,
`jurisdictionRestrictions`, `listingStatus`, `custodyRequirements`
(`SIMULATION_CUSTODY`), `settlementModel`.

Market status is taken from the Exchange, not the client.

---

## 4. Order types productized

Fully implemented:

- `LIMIT`
- `MARKET` (requires book liquidity and a protection price)
- existing governed types already on the tree: `IOC`, `FOK`, `POST_ONLY`,
  `MARKET_WITH_PROTECTION`

Unsupported future types stay unavailable. Client-supplied owner,
eligibility, fee override, market status, and priority are ignored.

Order identity is server-issued. Fields include `orderId`, owner account,
instrument/market, side, type, quantity, `limitPrice` where relevant,
`timeInForce`, `submittedAt` (`createdAt`), status, `filledQuantity`,
`remaining`, fee context, authorization reference, compliance reference,
and idempotency key.

Lifecycle (server-validated):

`CREATED` → `VALIDATING` → `AUTHORIZED` / `ACCEPTED` → `OPEN` →
`PARTIALLY_FILLED` / `FILLED` / `CANCEL_PENDING` / `CANCELLED` /
`EXPIRED` / `SUSPENDED` / `REJECTED`

---

## 5. Matching model

Deterministic price-time priority. AI cannot influence matching.

1. Bids: highest price, then earliest sequence.
2. Asks: lowest price, then earliest sequence.
3. Trade price is the resting (maker) price.
4. All authoritative arithmetic is `bigint`. No float prices.
5. A MARKET order with a protection price is capped like a limit.
6. Empty or abnormal books reject MARKET (`MARKET_ORDER_UNSAFE`).
7. Unfilled MARKET remainder is cancelled. It does not rest.
8. POST_ONLY that would take is rejected. FOK that cannot fill fully is rejected.
9. Self-trade policy `CANCEL_INCOMING` / `PREVENT` rejects the incoming order.
10. Replay of the same accepted sequence yields the same prices and quantities.

---

## 6. Reservation model

Before an executable order is accepted:

- BUY reserves quote notional plus the server-calculated taker fee buffer.
- SELL reserves the base asset.

Holds use the existing CoinPort / FiatPort (Ledger/custody adapters).
Available funds cannot be used by two open orders. Cancel releases only
the uncaptured remainder. Captured fill quantity is never over-released.

---

## 7. Fee model

Server-controlled `ProductizedFeeSchedule`:

- absolute minor units (`makerFeeMinor`, `takerFeeMinor`)
- listing-specific and customer-tier fields
- basis points: `floor(notional * bps / 10_000)`

Frontend `feeOverride` is rejected (`CLIENT_FEE_OVERRIDE_FORBIDDEN`).
Fees are recorded on the immutable trade and included in settlement
when non-zero. Default simulation schedule remains zero so existing
zero-fee fixtures stay stable; productized tests use non-zero bps.

---

## 8. Market controls

Auditable controls, all server-side:

- trading halt / resume
- instrument suspension
- close-only / cancel-only
- price bands (`abs(price-ref) * 10_000 <= ref * bandBps`)
- order-size and notional limits
- per-account rate windows
- circuit breakers that halt the market when last trade exceeds `tripBps`

Evidence is sealed on halt, reject, fill, cancel, and circuit trip.

---

## 9. Persistence / recovery

Critical Exchange state is an `ExchangeCoreSnapshot`
(`sunrey-exchange-core/1`). It is not process-memory authority.

- In-process: `InMemoryExchangeCorePersistence`
- Crash-safe file envelope: `DurableExchangeCoreStore`
- PostgreSQL: existing `sunrey_exchange.*` tables (append-only V025) plus
  V027 operational order updates

After restore the Exchange reconstructs open orders, book, market
state, reservations, and settlements. Replay rematches accepted orders
for determinism proofs and skips known fill keys so fills are not
duplicated.

---

## 10. Event / evidence model

Events are outputs of Exchange state. They do not create truth.

Phase B names include:

`exchange.order.accepted`, `exchange.order.rejected`,
`exchange.order.cancelled`, `exchange.fill.created`,
`exchange.market.halted`, `exchange.market.resumed`

Domain types `ExchangeOrderRejected` and `ExchangeFillCreated` were
added to the canonical events taxonomy. Correlation IDs travel with
rejects and book events. Evidence vault seals submission, authorization,
eligibility, matching, fill, fees, cancel, and market control.

---

## 11. Agent boundary

Phase F Agent may:

- read markets
- retrieve holdings through existing read tools
- create an Exchange order **proposal**
- explain the proposal

It must not call matching internals, place/cancel/halt/settle, or issue
Execution Authority. Approved proposals travel:

`Agent → proposal → human approval → Execution Authority → Exchange API`

`SubjectScopedSunReyExchangeTool.matchIncoming()` always refuses.

---

## 12. Performance

See the observational in-process harness
`packages/sunrey-exchange/src/production-core/performance.ts`.

Batch size used in tests: 64 orders. Metrics cover validation,
submission construction, matching, book update, cancellation, and
recovery/replay. These are not production SLAs.

---

## 13. Production flags

Preserved:

- `CORE_CODE_COMPLETE_CANDIDATE=true`
- `PRODUCTION_READY=false`
- `PRODUCTION_ACTIVE=false`
- `LIVE_CONNECTIVITY_ENABLED=false`
- `production_authorized=false`
- live trading / mainnet / real custody / real deposits / real
  withdrawals / real native-asset issuance remain disabled

---

## 14. Remaining gaps / blockers

1. CoinPort / FiatPort on the service path are still simulation adapters.
   Settlement journals remain a later Phase G concern (Prompt 2+).
2. Customer V034 migrations are duplicated on this tree, so a new V035
   Exchange-core table was not added. Persistence reuses V025/V027.
3. `PHASE_F_CLOSURE_REPORT.md` is not on this tree. Phase F Prompts 1–4
   exist and this prompt extends that work.
4. No live Exchange, custody, or bank is connected.

`SAFE_TO_PROCEED_TO_PHASE_G_PROMPT_2=true` after tests in this prompt
pass and live trading remains disabled.
