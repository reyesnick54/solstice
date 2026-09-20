# HELIOS Multi-Asset Expansion — M09–M10 Strategy Lab Report

Date: 2026-09-20 (UTC)

## Strategy families implemented

| Milestone | Family | Rule id | Instruments | Mode |
|---|---|---|---|---|
| M09 | Multi-asset Strategy Lab foundation | — | BTC/USD, ETH/USD canonical ids | Research fixtures |
| M10 | 1h volume-confirmed momentum breakout | `HELIOS_M10_CRYPTO_MOMENTUM_BREAKOUT_V1` | `CRYPTO:BTC:bitcoin:native:USD`, `CRYPTO:ETH:ethereum:native:USD` | Forward-paper / research |

M10 entry requires breakout from rolling range, volume confirmation, liquidity/spread limits, fresh observations, healthy provider, volatility bounds, active work order, valid customer mandate, and decision-validity envelope. Exits support trailing stop (volatility-adjusted), momentum failure, max holding period, emergency/risk forced close, and stale-data invalidation. Risk sizing remains under canonical Risk Engine / Meta Allocator authority — no fixed universal 1% stop.

## Datasets used

- **M06 production-shaped crypto reference plane:** `sunrey.crypto-market-reference.v1` via `packages/sunrey-exchange/src/crypto-market/` (fixture adapters in simulation).
- **Strategy Lab evaluation manifest:** `edmf-m10-crypto-momentum-v1` with 1h OHLCV-style chronological observations for BTC/USD and ETH/USD.
- **Information-time semantics:** H08 knowable-at; no look-ahead in rolling-range fixtures.

## Evaluation status

| Capability | Status |
|---|---|
| Versioned strategy capsule (H16 material) | Implemented — `scap_helios_m10_crypto_momentum_breakout_v1` |
| Deterministic rule evaluator | Implemented — `evaluateCryptoMomentumBreakoutRule` |
| Chronological replay manifest | Implemented |
| Fees / spread / slippage (explicit costs) | Covered in qualification tests |
| Walk-forward / shadow / paper promotion hooks | Supported via existing Strategy Lab H17–H18 pipeline and M10 promotion capsule |
| Benchmarks (BTC, ETH, cash) | Covered in qualification tests |
| Qualification tests | `tests/helios-multi-asset-m10-crypto-momentum-breakout.test.ts` |

Qualification marker: **`HELIOS_MULTI_ASSET_M10_CRYPTO_MOMENTUM_BREAKOUT_QUALIFIED`**

No performance or return claims are made in this report. Measured forward evidence is not yet attached.

## Paper eligibility

- **Forward-paper / Strategy Lab paper:** Eligible for promotion pipeline registration (`buildM10ReferenceCapsule`) subject to H18 gates (evaluation qualification, shadow duration, policy hash match).
- **Live crypto execution:** **Not enabled.** `ENVIRONMENT` remains `simulation`; `LIVE_TRADING_ENABLED` remains `false`. M10 material explicitly marks `liveCryptoExecution: false`.

## Remaining blockers

1. **Live HELIOS paper runtime dispatch** — `HeliosPaperGrowStrategyService` still routes only H14; M10 rule is Strategy Lab / research qualified, not yet wired into paper cycle execution.
2. **Production-shaped crypto history at scale** — evaluation uses synthetic fixture manifest; full M06 historical replay across providers is not yet bound into H17 chronological engine for M10.
3. **Shadow-forward evidence** — promotion to `PAPER_ACTIVE` still requires forward shadow outcomes per H18 policy.
4. **Meta Allocator binding** — position sizing authority is declared in capsule material; runtime sizing integration is unchanged from pre-M10 posture.

## M11

Not started (per scope).
