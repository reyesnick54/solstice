# Circuit breakers

A `CircuitBreaker` may move a market to `PAUSED`, `AUCTION`,
`CLOSE_ONLY`, or `RESTRICTED` according to policy.

Volatility control compares the high/low of eligible trades in the
current window against a configured bps trigger.

AI may recommend an operational action. AI does not independently
authorize a governed production market restriction. Current
architecture does not grant machine halt authority.
