# Chunk 95 — Market operations

SunRey Exchange now has a production-candidate operations layer at
`packages/sunrey-exchange/src/ops`.

| Surface | Owner |
| --- | --- |
| Policy / sessions / state | `MarketOperationsPolicy`, `MarketSession`, `MarketState` |
| Gateway | `InstitutionalOrderGateway`, `TradingSession`, `TradingCredential` |
| Risk | `MarketRiskControl`, `OrderRatePolicy`, `VolatilityControl`, `CircuitBreaker` |
| Data | `MarketDataBook`, `MarketDataSnapshot`, `MarketDataSequence` |
| Liquidity / MM | `LiquidityMetric`, `MarketMakerSession`, `MarketMakerQuote` |
| Ops | `ExchangeOperationalReport`, replay, reconciliation |

Native market: `SUNREY_COIN` / `MOONREY_COIN` with no peg and no
guaranteed price relationship.

DIGITAL_ASSET is fully implemented. Other canonical families keep
their existing eligibility rules and stay restricted until separately
ready. No family inherits another family's legal status.

Production activation still requires legal, licensing, market policy,
compliance, surveillance, custody, and human authorization.
Engineering completion is not enough.
