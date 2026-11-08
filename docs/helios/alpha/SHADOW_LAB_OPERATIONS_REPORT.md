# Shadow Lab Operations Report

## Continuous runtime

Shadow lab campaigns run under simulation posture only. Orchestration composes with HELIOS continuous runtime patterns (observe → decide → seal → shadow execute) without ProposalGate customer execution.

## Control room (ALPHA22)

`projectControlRoom` exposes read-only tiles: campaign id, decision count, demoted count. **`canActivateLiveTrading` is always `false`.**

## Reports (ALPHA24)

- Daily: `rpt:daily:<decisions>:<generation>`
- Weekly: `rpt:weekly:<decisions>:<generation>`

## Demotion (ALPHA23)

Automatic demotion applies to deliberately degrading strategies in the qualification harness; demoted strategies retain append-only evidence.

## Qualification command

```bash
npm run helios:alpha25:qualify
```

Fast local evaluation (no subprocess CI):

```bash
npm run helios:alpha25:qualify:fast
```
