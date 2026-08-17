# Fee-market simulation

`AdaptiveFeeSimulator` is an engineering simulation. It is not a
production parameter tuner and not a live market.

Required scenarios:

- very low utilization
- target utilization
- sustained high utilization
- sudden transaction burst
- spam burst
- PQ-heavy workload
- oracle-heavy workload
- interop-heavy workload
- Exchange-heavy workload

Reported metrics: resource utilization, base-price trajectory, average /
p50 / p95 / p99 fee, validator / burn / treasury allocation, rejected
transaction count, block resource saturation.

Stability analysis flags excessive oscillation, fee runaway, min/max
pinning, insufficient spam cost, and extreme priority-fee behavior.

CLI:

```
npm run sunrey-economics -- fees simulate TARGET_UTILIZATION
npm run sunrey-economics -- fees verify
```
