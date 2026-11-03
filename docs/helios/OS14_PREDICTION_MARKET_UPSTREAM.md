# HELIOS OS14 — Prediction-Market Microstructure (Upstream Attribution)

## Upstream

| Field | Value |
| --- | --- |
| Repository | [semrincaballero/Polymarket-Prediction-Bot](https://github.com/semrincaballero/Polymarket-Prediction-Bot) |
| Reference SHA | `1f7c9761ddd26863242e3ed4f83c230ee38aebeb` |
| License | MIT |

## Scope

OS14 is **research / paper / simulation only**. Solstice does not embed the upstream Python runtime, does not call Polymarket APIs, and does not enable live wagering or trading.

## Ported concepts (TypeScript reimplementation)

- Paired YES/NO CLOB normalization (`BookSide` / `ClobBook` shapes)
- Book imbalance (+YES-heavy / −NO-heavy)
- Research signal thresholds from upstream `StrategyEngine` (prob-edge, imbalance, liquidity) as **annotations**, not orders
- Deterministic fixture market shapes from upstream `mock_data.py`

## Canonical owner

`packages/platform/src/helios/open-source/os14-prediction-market/`

Strategy Lab bridge (DTO only): `packages/strategy-lab/src/os14-prediction-market/`

## Semantics

**Implied market probability** (from mid/spread/depth) is **market consensus**, not objective truth. OS14 types and evidence payloads never equate market price with “true probability.”

Future execution integration requires a separate authorized program outside OS14.
