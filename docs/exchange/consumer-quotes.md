# Consumer quotes

A `ConsumerQuote` binds market, side, requested quantity or notional,
estimated execution, estimated price impact, configured fees,
expiration, and the market-data sequence/reference.

## Kinds

| Kind | Meaning |
| --- | --- |
| `INDICATIVE` | Order-book estimate. Informational. Not guaranteed execution. |
| `EXECUTABLE` | Firm executable quote. Not implemented for the initial market. |

Order-book walks are always labeled `INDICATIVE` unless a separately
governed firm-quote facility exists. `guaranteedExecution` is
`false`.

Quotes expire. A stale quote is rejected or repriced according to
`ConsumerExchangePolicy.staleQuotePolicy`. Client-cached mobile
market data is not authoritative.
