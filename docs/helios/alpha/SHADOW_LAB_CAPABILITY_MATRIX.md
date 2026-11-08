# Shadow Lab Capability Matrix (ALPHA16–ALPHA25)

| Work package | Customer money | Live execution | Evidence | Qualified by |
|--------------|------------------|----------------|----------|--------------|
| ALPHA16 | No | No | ALPHA15 architecture closure | Module + ALPHA15 test |
| ALPHA17 | No | No | Campaign lifecycle | Long-run step `START_CAMPAIGN` |
| ALPHA18 | No | No | Chronological admission | Chaos: disconnect, gap, duplicate |
| ALPHA19 | No | No | Outcome maturity queue | Long-run step `MATURE_OUTCOMES` |
| ALPHA20 | No | No | Frozen cohort boundaries | Frozen strategy registration |
| ALPHA21 | No | No | Shadow capital book | `MAINTAIN_SHADOW_CAPITAL` |
| ALPHA22 | No | No | Read-only tiles | `canActivateLiveTrading: false` |
| ALPHA23 | No | No | Demotion records | Deliberate degrading strategy demoted |
| ALPHA24 | No | No | Daily / weekly reports | Report ids sealed |
| ALPHA25 | No | No | Capstone marker | Full subprocess gate bundle |

**Posture (required):** `LIVE_TRADING_ENABLED=false`, `LIVE_INVESTMENT_EXECUTION=false`, `LIVE_CUSTODY_ENABLED=false`, `production_authorized=false`.
