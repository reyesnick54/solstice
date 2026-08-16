# Chunk 29 — SunRey Exchange Core

Implemented at `packages/sunrey-exchange` after Clean Room, SunRey Coin,
the information market, and SunRey Chain landed on `main`.

Simulation only. `LIVE_EXCHANGE_ENABLED` and `LIVE_CRYPTO_ENABLED` stay
false. The exchange does not issue Execution Authority. Journals stay on
the canonical Ledger via `CoinPort` / `FiatPort`. ExchangeAccount stores
no balance. Last trade is labeled `SIMULATION_MARKET_PRICE`.

Information and compute contracts delegate to the information market.
They do not become CLOB orders and never return raw rows.

Do not create `packages/exchange-v2`, `packages/orderbook`,
`packages/matching-engine-v2`, `packages/crypto-exchange`, or
`packages/reyn-exchange`.
