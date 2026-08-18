# Market risk controls

Before an order enters matching the engine checks:

- participant eligibility
- market eligibility (DIGITAL_ASSET operational; others restricted)
- account restrictions
- available reservation
- quantity and notional limits
- price collars around the reference price
- kill switches (`MARKET`, `ASSET`, `MARKET_FAMILY`, `ORDER_ENTRY`,
  `SETTLEMENT`, `WITHDRAWAL`)
- compliance state
- settlement-queue health
- custody health

## Reference price

Explicit hierarchy, no implied source:

1. Recent eligible trade
2. Internal midpoint
3. Approved oracle / reference feed

There is no guaranteed fair price.

## Collars and protection

Collars use bounded integer arithmetic (bps of the reference).
`MARKET_WITH_PROTECTION` walks the book only inside the protection
band and never rests.
