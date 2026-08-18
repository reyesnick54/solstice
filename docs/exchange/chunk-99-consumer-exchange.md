# Chunk 99 — Consumer Exchange

SunRey now has a consumer trading backend at
`packages/sunrey-exchange/src/consumer`.

| Surface | Type |
| --- | --- |
| Profile / eligibility | `ConsumerTradingProfile` |
| Market | `ConsumerMarketView` |
| Quote | `ConsumerQuote` |
| Preview | `ConsumerTradePreview` |
| Order | `ConsumerOrderRequest`, `ConsumerOrderStatus` |
| Convert | `ConsumerConversionRequest` |
| Protection / fees / risk | `ConsumerPriceProtection`, `ConsumerFeeDisclosure`, `ConsumerRiskDisclosure` |
| Portfolio | `ConsumerPortfolioProjection` |
| Receipt | `ConsumerTradeReceipt` |
| Alerts / favorites | `ConsumerPriceAlert`, `ConsumerFavoriteMarket` |
| Ops | `ConsumerExchangeReport` |

The consumer layer calls `MarketOperationsEngine` for matching and
`NativeClearingEngine` for DVP. Production consumer trading stays
unavailable until legal, licensing, compliance, custody, provider,
and human authorization exist.
