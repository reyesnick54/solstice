# Consumer portfolio projection

`ConsumerPortfolioProjection` is a read model. It does not store an
independent quantity.

| Holding | Source |
| --- | --- |
| SunRey quantity | chain / custody via `NativeClearingEngine.position` |
| MoonRey quantity | chain / custody via `NativeClearingEngine.position` |
| Fiat quantity | only when an application product already exposes it |

Open orders, recent trades, and pending settlement are canonical
Exchange/DVP references. Informational market value cites an
explicit reference source and timestamp. It is not guaranteed
redemption value.

Cost-basis and performance analytics, when shown, are informational,
jurisdiction-dependent, and not a tax or investment statement.
Sandbox portfolios are labeled `NON_PRODUCTION`.
