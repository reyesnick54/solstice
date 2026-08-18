# Reopening auctions

After a configured interruption, a market may enter `AUCTION`.

| Step | Rule |
| --- | --- |
| Eligibility | `LIMIT` and `POST_ONLY` only |
| Price discovery | Uniform price = last crossed offer (marginal ask) |
| Allocation | Price-time; ties break by earlier sequence then order id |
| Transition | Leftover open orders remain; state returns to `OPEN` |

The algorithm is deterministic and uses integer quantities only.
