# Build status

Last local verification for Phase 6 (Solstice Alpha — portfolio, risk
engine, model registry, paper trading).
Last updated: 2026-08-14

## Commands

```
npm test
npm run demo
npm run ci
```

CI: `.github/workflows/ci.yml` (Node 22).

## LIVE_* flags

All remain `false`:

- `LIVE_TRADING_ENABLED`
- `REAL_MONEY_ENABLED`
- `LIVE_CRYPTO_ENABLED`
- `LIVE_EXCHANGE_ENABLED`
- `LIVE_DATA_MARKET_ENABLED`
- `LIVE_MONEY_MOVEMENT`
- `LIVE_EXTERNAL_EXECUTION`
- `LIVE_SUBSCRIPTION_MUTATION`
- `LIVE_LLM_ENFORCEMENT`
- `LIVE_MERCHANT_NETWORK`

## Phase exit

- Phase 6: strategies run in shadow and paper with zero customer capital
  at risk. Deposits reach investments only across a disclosed bridge with
  all agreements present. The Risk Engine is unoverridable. Unrealized
  P&L is structurally unsweepable.

## Test count

170 passed, 0 failed (local `npm test` / `npm run ci`, 2026-08-14).
Prior documented count was 71 (Phase 4–5). Count did not decrease.
