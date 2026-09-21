# HELIOS Multi-Asset Expansion — M09–M12 Strategy Library Report

Date: 2026-09-21 (UTC)

Engineering status for Strategy Lab capsule families M09–M12. No performance or return claims are made.

## Summary

| Milestone | Family | Rule id | Mode |
|---|---|---|---|
| M09 | 15m Index Mean Reversion | `HELIOS_M09_INDEX_MEAN_REVERSION_V1` | Research / shadow / paper |
| M10 | 1h Crypto Volume-Confirmed Momentum Breakout | `HELIOS_M10_CRYPTO_MOMENTUM_BREAKOUT_V1` | Research / shadow / paper |
| M11 | Commodity Trend (4h WTI) | — | **Not implemented on main** |
| M12 | 1h Relative Value / Statistical Arbitrage | `HELIOS_M12_RELATIVE_VALUE_STAT_ARB_V1` | Research / shadow / paper |

Qualification markers:

- `HELIOS_MULTI_ASSET_M09_INDEX_MEAN_REVERSION_QUALIFIED`
- `HELIOS_MULTI_ASSET_M10_CRYPTO_MOMENTUM_BREAKOUT_QUALIFIED`
- `HELIOS_MULTI_ASSET_M12_RELATIVE_VALUE_STAT_ARB_QUALIFIED`

---

## M09 — Index Mean Reversion

**Engineering status:** Implemented. Versioned capsule `scap_helios_m09_index_mean_reversion_v1`, deterministic rule evaluator, chronological replay, walk-forward hooks, promotion/demotion lifecycle.

**Data requirements:** SPY and QQQ 15-minute bars (`SECURITY:US:SPY:ARCX`, `SECURITY:US:QQQ:XNAS`); M05 equity index data plane; knowable-at / no-look-ahead semantics.

**Paper eligibility:** Eligible for Strategy Lab promotion pipeline (H18 gates). Not wired into live HELIOS paper runtime dispatch (H14-only today).

**Known limitations:** Single-instrument decisions per evaluation tick; synthetic fixture history for qualification; Meta Allocator sizing declared but runtime binding unchanged.

---

## M10 — Crypto Momentum Breakout

**Engineering status:** Implemented. Capsule `scap_helios_m10_crypto_momentum_breakout_v1`; volume-confirmed breakout with trailing stop, momentum failure, and stale-data invalidation.

**Data requirements:** BTC/USD and ETH/USD 1h OHLCV via M06 crypto market reference plane; manifest `edmf-m10-crypto-momentum-v1`.

**Paper eligibility:** Promotion pipeline eligible. `liveCryptoExecution: false`; `ENVIRONMENT=simulation`, `LIVE_TRADING_ENABLED=false`.

**Known limitations:** Not dispatched by `HeliosPaperGrowStrategyService`; production-scale crypto history not bound into H17 engine; forward shadow evidence still required for `PAPER_ACTIVE`.

---

## M11 — Commodity Trend

**Engineering status:** **Not implemented on main.** M08 WTI energy data foundation exists (`HELIOS_MULTI_ASSET_M08_WTI_ENERGY_DATA_QUALIFIED`, 4h trend readiness assessment). No M11 strategy capsule, rule evaluator, or qualification marker yet.

**Data requirements (planned):** WTI continuous / front-month research series from M08; 4h bar evidence; roll-context awareness.

**Paper eligibility:** Not eligible — strategy family absent.

**Known limitations:** Entire M11 capsule family pending; do not infer commodity trend signals from WTI data readiness alone.

---

## M12 — Relative Value / Statistical Arbitrage

**Engineering status:** Implemented (this milestone). First HELIOS capsule family evaluating **relationships between instruments** rather than each instrument independently.

Architecture layers (separated):

| Layer | Module | Authority |
|---|---|---|
| Statistical relationship discovery | `packages/strategy-lab/src/relative-value/relationship.ts` | None |
| Pair validation / strategy qualification | `relative-value/validation.ts`, `relative-value/rule.ts` | None |
| Capital allocation hooks | `relative-value/allocation.ts` | Recommends only; Meta Allocator |
| Execution | Existing order lifecycle + `packages/platform/src/helios/multi-leg/` | Execution Authority external |

**Pair universe (initial):**

- SPY / QQQ (equity ETF)
- BTC / ETH (crypto)
- GLD ETF / COMEX gold continuous research series (identity mismatch explicitly acknowledged; research-only)

**Features:** Pair spread construction, volatility normalization, spread z-score, rolling correlation, cointegration test hook, per-leg liquidity/spread gates, synchronized timestamps, multi-leg proposals with hedge evidence and invalidating conditions.

**Multi-leg execution risk hooks:** `assessMultiLegExecutionRisk` covers first-leg fill, second-leg failure, partial fill, hedge slippage, timeout, and unwind requirement — not a parallel order manager.

**Data requirements:** 1h synchronized bars per leg; M05/M06/M07 data planes depending on pair; fixture manifest `edmf-m12-*-v1`.

**Paper eligibility:** Strategy Lab promotion pipeline eligible (shadow/paper). No live execution, no uncontrolled leverage. Multi-leg proposals carry `grantsFinancialEffect: false`.

**Known limitations:**

- Correlation does not imply arbitrage; pair validation may refuse entries even when correlation is high.
- GLD vs continuous gold futures is research-only with explicit identity separation.
- Cointegration hook is an engineering gate, not production econometric certification.
- Multi-leg paper runtime dispatch not wired; partial-fill handling is architectural assessment only.
- Chronological evaluation uses synthetic fixtures; full provider-scale replay not yet bound.

---

## Cross-cutting posture

- All families: `simulationOnly: true`, no live trading flags enabled.
- Position sizing: `EXTERNAL_META_ALLOCATOR` — no inline leverage or yield fields.
- Promotion: RESEARCH → EVALUATION → SHADOW → PAPER via existing H17–H18 pipeline.
- M13: **Not started** (out of scope for this report).
