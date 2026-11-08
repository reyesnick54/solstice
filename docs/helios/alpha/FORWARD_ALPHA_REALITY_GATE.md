# Forward Alpha Reality Gate (AlphaRealityGate)

Implementation: `packages/platform/src/helios/forward-alpha-evidence/reality-gate.ts`

## Status rules

1. **ARCHITECTURE_QUALIFIED** — software modules present and bounded.
2. **FORWARD_CAMPAIGN_READY** — prospective infrastructure ready (may be achieved in simulation).
3. **FORWARD_EVIDENCE_ACCUMULATING** — requires chronological forward decisions (`GENUINE_FORWARD_CAMPAIGN`).
4. **FORWARD_EDGE_CANDIDATE** — preliminary positive forward evidence; **not** alpha proven.
5. **FORWARD_ALPHA_SUPPORTED** — genuine forward sample + predeclared statistical policy.
6. **FORWARD_ROBUSTNESS_SUPPORTED** — forward alpha + required regime coverage.
7. **PAPER_IMPLEMENTATION_SUPPORTED** — forward paper after realistic costs.
8. **LIVE_ALPHA_SUPPORTED** — regulated live capital; blocked when `LIVE_TRADING_ENABLED=false` or `LIVE_INVESTMENT_EXECUTION=false`.

## Synthetic guard

`synthetic-guard.ts` prevents `SYNTHETIC_HARNESS` and `HISTORICAL_FIXTURE` from yielding investment-performance proof statuses.

## Separation

- Architecture marker: `HELIOS_FORWARD_ALPHA_EVIDENCE_V1_QUALIFIED`
- Evidence status: resolved independently via `resolveAlphaRealityGate`
