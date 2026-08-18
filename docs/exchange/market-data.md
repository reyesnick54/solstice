# Market data

Each stream (`TRADES`, `BBO`, `DEPTH`, `MARKET_STATE`,
`AUCTION_STATE`, `STATISTICS`) has a monotonically increasing
sequence per stream/session.

## Recovery

Clients recover with `snapshot + incremental updates`. Each snapshot
and increment carries a SHA-256 digest for deterministic replay.

## Tiers

Tiers do not change canonical trading state.

| Tier | Behavior |
| --- | --- |
| `PUBLIC_DELAYED` | Delayed last price / top of book |
| `AUTHORIZED_REALTIME` | Real-time depth for authorized sessions |

No commercial pricing is defined.

Public delayed data is exposed on the existing public gateway
(`/v1/exchange/market-data`).
