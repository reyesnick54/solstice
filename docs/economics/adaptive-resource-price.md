# Adaptive base resource price

Formula version: `BASE_PRICE_FORMULA_V1`.

Let `P` be the previous finalized base price, `U` the previous finalized
weighted usage, `L` the block resource limit, `t` the target utilization
in basis points, `D` the adjustment denominator, and `A` the maximum
one-block adjustment.

```
T = (L × t) / 10_000

if U ≥ T:
  raw = (P × (U − T)) / (T × D)
  adj = min(raw, A)
  P' = min(P + adj, Pmax)
else:
  raw = (P × (T − U)) / (T × D)
  adj = min(raw, A)
  P' = max(P − adj, Pmin)
```

All terms are unsigned integers. Overflow is a rejection.

Properties:

- `Pmin ≤ P' ≤ Pmax`
- one-block change is bounded by `A` before the min/max clamp
- identical `(P, U, policy)` produces identical `P'` on every validator
- no unbounded fee change

Development fixture (not a production constant copied from another
chain): `D = 8`, `t = 5000`, `A = 250`, `Pmin = 1`, `Pmax = 10000`,
`L = 2_000_000` (Chunk 58 development block limit). Production values
remain unconfigured.
