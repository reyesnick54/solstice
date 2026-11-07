# Best Execution — Engineering Evidence (EXEC05 / EXEC07)

## Smart routing (EXEC05)

`ExecutionRoutingService` applies regulatory-compatible route **filtering** before scoring. Non-permitted corridors are excluded; regulatory compatibility is not a score weight.

Evidence: `tests/helios-multi-asset-m23-execution-routing.test.ts`, `EXECUTION_PROVIDER_ROUTE_CATALOG`.

## Transaction cost analysis (EXEC07)

M22 execution plan planner models spread, slippage, and fee certainty levels. M24 fill records capture `slippageMinorUnits` and `priceImprovementMinorUnits` for post-trade TCA evidence.

## Simulation-only posture

No production order routing to live venues. Execution Twin and paper matchers consume canonical fixtures. `LIVE_INVESTMENT_EXECUTION=false`.

## Customer-facing boundary

Best-execution engineering evidence supports research and simulation narratives only; it is not a regulatory best-execution certification.
