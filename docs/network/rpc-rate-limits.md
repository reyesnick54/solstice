# Public RPC rate limits

Limits are configurable by:

- IP / network identity
- API key
- request class
- method
- cost units

Default anonymous quota is 30 requests / minute. An API key default
is 300 requests / minute. Archive scans and broad Explorer searches
cost more units than `chain.status`.

`RpcRateLimitPolicyEngine` is distributed-safe: counters for the same
key and window merge by `max(count)` / `max(cost)`. That is commutative
and safe for multi-node edges.

429 responses include `retryAfterMs`. Rate-limit events are recorded
on the public data-plane metrics surface.
