# HELIOS Multi-Asset Expansion — M17–M20 Portfolio Risk Closure Report

Date: 2026-09-21 (UTC)

## Scope

M20 extends the canonical deterministic Risk Engine in `packages/risk` with portfolio-level controls for multi-strategy, multi-asset HELIOS mandates. No separate risk authority, ledger, Kernel proof, or Execution Authority mint was introduced.

Qualification marker: **`HELIOS_MULTI_ASSET_M20_PORTFOLIO_RISK_CONTROLS_QUALIFIED`**

## M17 — Dynamic correlation inputs

Correlation is **not fixed**. Instrument risk profiles carry versioned, policy-supplied cluster memberships (for example `US_EQUITY`, `TECH_GROWTH`, `CRYPTO`, `RISK_ON`). Cluster exposure is recomputed on every portfolio evaluation from current reconciled positions.

Example recognized pattern:

| Instrument | Clusters |
|---|---|
| SPY long | `US_EQUITY`, `RISK_ON` |
| QQQ long | `US_EQUITY`, `TECH_GROWTH`, `RISK_ON` |
| NVDA long | `TECH_GROWTH`, `RISK_ON` |
| BTC long | `CRYPTO`, `RISK_ON` |

Collective `RISK_ON` exposure can breach a mandate policy even when single-position caps remain satisfied.

Implementation: `packages/risk/src/portfolio/exposure-graph.ts`

## M18 — Exposure graph

The exposure graph aggregates:

- per-position and per-strategy gross/net exposure
- asset-class, venue, and correlated-cluster concentration
- liquidity and market-data quality inputs

All limits are read from versioned `MandateRiskPolicy` records. No universal customer percentages are hard-coded.

Implementation: `packages/risk/src/portfolio/exposure-graph.ts`, `packages/risk/src/portfolio/types.ts`

## M19 — Dynamic sizing boundary

Position sizing authority remains with the canonical Risk Engine pre-trade path and Meta Allocator recommendations. M20 evaluates whether proposed entries remain permitted under the active portfolio risk state; it does not invent sizing percentages.

Portfolio risk can block or throttle new entries (`NEW_ENTRIES_BLOCKED`, `REDUCED_RISK`, `EXIT_ONLY`) but does not auto-close unless policy `emergencyClosePermitted` is true and downstream Execution Authority exists.

## M20 — Drawdown, loss-budget, and kill controls

### Versioned mandate policies

`MandateRiskPolicy` supports configurable limits including:

- position, strategy, asset-class, correlated-cluster, crypto, commodity, venue, gross, and net exposure caps
- daily realized-loss and optional total-loss thresholds
- portfolio and strategy drawdown guards
- consecutive-loss thresholds
- liquidity minimums
- stale-data and provider-health restrictions

Policy updates may tighten limits but cannot loosen an active mandate (`policyUpdatePermitted`).

### Risk states (deterministic)

`NORMAL` → `CAUTION` → `REDUCED_RISK` → `NEW_ENTRIES_BLOCKED` → `EXIT_ONLY` → `EMERGENCY_CLOSE_REQUIRED` → `PAUSED`

Transitions are computed from reconciled facts, active kill triggers, and drawdown thresholds. Explicit kill triggers latch until cleared.

### Kill controls

Supported triggers: customer pause, compliance pause, provider failure, stale market data, excessive drawdown, loss-budget breach, severe liquidity degradation, repeated execution failure, reconciliation failure, operational emergency.

Actions distinguish:

- block new entries
- reduce exposure
- exit strategy / asset class
- close mandate (only when policy permits; never without Execution Authority downstream)

### Drawdown accounting

Uses reconciled equity points with `cumulativeNetFlowMinor` so deposits are not counted as profit and withdrawals are not counted as losses. Unsettled estimates are excluded from daily realized-loss accounting.

Implementation: `packages/risk/src/portfolio/drawdown-accounting.ts`

### Audit evidence

Every intervention seals `PORTFOLIO_RISK_INTERVENTION` evidence with rule, threshold, observed value, timestamp, affected strategy/position, resulting action, authority, and evidence refs.

Implementation: `packages/risk/src/portfolio/portfolio-risk-engine.ts`

## Qualification

| Artifact | Location |
|---|---|
| Qualification module | `packages/risk/src/portfolio/qualification.ts` |
| Integration tests | `tests/helios-multi-asset-m20-portfolio-risk-controls.test.ts` |
| Qualify script | `scripts/helios-m20-portfolio-risk-qualify.ts` |

Covered scenarios: normal operation, position/asset-class/cluster caps, daily loss, portfolio/strategy drawdown, stale data, provider outage, customer pause, emergency close request, partial fills during risk events, restart during `EXIT_ONLY`, reconciliation failure, policy version update, midnight rollover without false state reset.

## Remaining external / live-production dependencies

1. **Live reconciled equity feed** — M20 consumes reconciled portfolio facts; production binding to custody/ledger reconciliation is not activated (`ENVIRONMENT=simulation`).
2. **Grow operational controls (H27) wiring** — kill-state fan-out to consumer pause/close flows is not yet bound in the Grow BFF runtime.
3. **Execution Authority for emergency close** — close-mandate actions are policy-gated recommendations only; Kernel Execution Authority remains required for consequential closes.
4. **Dynamic correlation estimation** — cluster membership is policy/config supplied; statistical correlation estimation from live market data is not enabled.
5. **Meta Allocator runtime binding** — exposure graph outputs are available to orchestration but H33 harness still uses stub exposures in some paths.
6. **Live pilot gates (H36)** — catalog items for kill switches and loss/drawdown limits are satisfied at engineering qualification level only.

## Posture

- `ENVIRONMENT`: `simulation`
- `LIVE_TRADING_ENABLED`: `false`
- Engineering-only policies (`engineeringOnly: true`)

M21 was not started.
