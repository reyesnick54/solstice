# Chunk 95 — SunRey Exchange market operations

Canonical owner: `packages/sunrey-exchange` (`src/ops`).

This chunk adds the production-candidate institutional trading and
market-operations layer. It does not create a second Exchange or a
second native-asset balance ledger. Chain and custody remain
authoritative for assets.

## What it implements

- Market-state model (`PREOPEN`, `OPEN`, `AUCTION`, `PAUSED`,
  `HALTED`, `CLOSE_ONLY`, `CANCEL_ONLY`, `RESTRICTED`, `CLOSED`)
- Configurable market sessions (continuous native markets, scheduled
  others)
- Institutional order gateway with session auth, sequence numbers,
  idempotency, cancel/replace, status, and recovery
- FIX-style and WebSocket-style adapters (not certified)
- Pre-trade risk, rate limits, price collars, volatility controls,
  circuit breakers, and reopening auctions
- Sequenced market data with snapshot + incremental recovery
- Market-maker sessions without hidden matching priority
- Settlement backpressure and custody-health consumption
- Surveillance candidates routed to the existing case-management port
- CLI, SDK sandbox/market-data surfaces, and adversarial scenarios

## What it does not do

- Activate a licensed production market
- Let AI independently authorize a market restriction
- Invent a guaranteed fair price or a fixed SUNREY/MOONREY peg
- Trade production funds from a developer API key
- Store balances on the Exchange
