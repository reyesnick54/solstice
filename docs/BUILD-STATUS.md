# Solstice build status

This file describes what is in the tree and what has been tested.
It does not describe planned work as if it were done.

**As of 2026-08-14: Phase 6 — Solstice Alpha (simulation) is implemented.**
Strategies run in shadow and paper trading. No customer capital is at risk.
`LIVE_TRADING_ENABLED` remains false. No broker, exchange, or market-data
provider is contacted.

---

## How to run what exists

```bash
npm test
npm run demo
npm run ci
```

`npm run demo` runs the Phase 4–5 platform demo, then `demo/phase6.ts`.
Both print `demo: ok` / `phase-6 demo: ok`.

---

## Phase 6

| Item | Status |
| --- | --- |
| Investment account opening (Kernel ActionIntent) | Implemented. Refuses if agreement, risk profile, disclosure, or transfer authorization is absent. |
| Sweep Bridge `DEPOSIT_TO_INVESTMENT_CASH_SWEEP` | Implemented. Balanced journals on both sides. Undefined pairs refused. |
| Distinct investment cash vs securities positions | Implemented. |
| Portfolio engine (cost basis, qty, valuation) | Implemented. Corporate actions out of scope. Valuation is never cash. |
| Realized vs unrealized P&L | Distinct types. Cannot be summed. Unrealized is unsweepable. |
| Risk Engine | Deterministic. ALLOW / REDUCE / REFUSE. REFUSE is FINAL. |
| Kill switches | ALL_TRADING, STRATEGY, AGENT_RUNTIME, BROKER_CONNECTIVITY. No AI required. |
| Model registry | RELEASED validation gate is structural. Covers trading, AML, fraud, personalization, data-valuation, recommendation. |
| Strategies | Mean reversion, momentum, market-neutral pair. Seeded. Proposals only. |
| Shadow / paper execution | Paper ledger only. ExecutionAuthority required. |
| Weekly Harvest | Realized settled only. 0/25/50/75/100%. Class bridge back to deposits. |
| Phase 6 exit-criterion test | `tests/phase-6-solstice-alpha.test.ts` |
| Local CI | `npm run ci` — ok (2026-08-14). 170 tests pass, 0 fail. |

## LIVE_* flags

All remain `false`. `ENVIRONMENT` remains `simulation`.
