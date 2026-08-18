# Runbook — Exchange market incident

Simulation / production-candidate operations only. Do not enable
`LIVE_*` flags.

## Symptoms

- Volatility trigger or circuit breaker engaged
- Settlement queue growth
- Custody health `DEGRADED` / `UNAVAILABLE`
- Market-data sequence gap reported by a client
- Surveillance candidate burst

## Immediate actions

1. Confirm market state (`sunrey-exchange market-state`).
2. Inspect kill switches and risk (`sunrey-exchange risk`).
3. If settlement is degraded, leave new-order risk restricted. Do
   not invent balancing entries.
4. Recover market data from snapshot + incrementals.
5. Reconcile orders, reservations, trades, settlement intents,
   finalized DVP, and custody attribution
   (`sunrey-exchange reconciliation`).
6. Replay the session (`sunrey-exchange replay`) for audit.

## Authority

Human or security authority only. AI recommendations are not
authorization. Unlicensed production activation remains unavailable.
