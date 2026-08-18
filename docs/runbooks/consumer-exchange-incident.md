# Runbook — Consumer Exchange incident

Simulation / production-candidate operations only. Do not enable
`LIVE_*` flags.

## Symptoms

- Consumer orders rejected for market state, stale quote, or
  protection
- Portfolio projection disagrees with Exchange reservations or
  chain holdings
- Settlement view is `SUBMISSION_UNKNOWN`
- Price-alert or sandbox confusion with production

## Immediate actions

1. Confirm canonical market state
   (`sunrey-exchange consumer-market` / `market-state`).
2. Do not submit a second settlement instruction when status is
   `SUBMISSION_UNKNOWN`.
3. Reconcile consumer projection, reservations, trades, DVP,
   custody, and chain holdings
   (`sunrey-exchange consumer-reconciliation`).
4. Confirm the caller presented wallet/mobile authorization, not
   only an API session.
5. If the market is paused or restricted, show the safe circuit
   breaker explanation. Do not expose surveillance data.

## Authority

Human or security authority only. Unlicensed production consumer
trading remains unavailable. Sandbox accounts cannot trade
production.
