# Chunk 99 — SunRey consumer Exchange backend

Canonical owner: `packages/sunrey-exchange` (`src/consumer`).

This chunk adds the consumer-facing UX/API projection over the
canonical SunRey Exchange. It does not create a second Exchange,
matching engine, or balance ledger. Positions come from chain,
custody, and the canonical Ledger according to asset class.

## What it implements

- `ConsumerTradingProfile` and eligibility (identity, jurisdiction,
  account, market, custody/wallet, Exchange capability, compliance)
- `ConsumerMarketView` for `SUNREY_COIN` / `MOONREY_COIN` with no
  fixed exchange rate
- `ConsumerQuote` (`INDICATIVE` vs `EXECUTABLE`) bound to sequenced
  market data
- `ConsumerTradePreview`, buy/sell/convert, limit and
  market-with-protection
- Wallet and mobile authorization; API session cannot spend
- Agent path with mandate, no matching priority
- `ConsumerPortfolioProjection` without a second quantity store
- Fee, risk, and price-protection disclosures
- Settlement views including `SUBMISSION_UNKNOWN`
- Favorites, informational price alerts, sandbox, SDK/API

## What it does not do

- Match orders or settle DVP itself
- Hold independent balances
- Guarantee execution or redemption value
- Activate licensed production consumer trading
- Expose private portfolios on the public Explorer
- Let a price alert trade by itself
