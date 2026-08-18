# Consumer price protection

Simple consumer execution uses `MARKET_WITH_PROTECTION` when the
canonical engine supports it. A maximum adverse price/slippage
policy is required.

Protection is derived from the explicit reference-price hierarchy
(recent eligible trade, internal midpoint, approved oracle). The
limit is not a guaranteed fill. If estimated execution would breach
the protection band, the order is rejected
(`PRICE_PROTECTION_EXCEEDED`).

Convert uses the same protected market-style path. There is no
hidden dealer inventory in this layer.
