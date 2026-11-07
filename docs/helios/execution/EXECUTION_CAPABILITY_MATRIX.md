# Execution Capability Matrix (EXEC01–EXEC15)

| ID | Status | Module | Primary test |
|----|--------|--------|--------------|
| EXEC01 | IMPLEMENTED | `order-lifecycle/types.ts` | `helios-h23-order-fill-settlement-lifecycle.test.ts` |
| EXEC02 | IMPLEMENTED | `order-lifecycle/provider-port.ts` | `helios-h23-order-fill-settlement-lifecycle.test.ts` |
| EXEC03 | IMPLEMENTED | `order-lifecycle/service.ts` | `helios-h23-order-fill-settlement-lifecycle.test.ts` |
| EXEC04 | IMPLEMENTED | `multi-asset/m18/` | `helios-multi-asset-m18-portfolio-exposure-graph.test.ts` |
| EXEC05 | IMPLEMENTED | `execution-routing/resolver.ts` | `helios-multi-asset-m23-execution-routing.test.ts` |
| EXEC06 | IMPLEMENTED | `execution-twin/simulation/` | `helios-os03-execution-simulation.test.ts` |
| EXEC07 | IMPLEMENTED | `multi-asset/m22/planner.ts` | `helios-multi-asset-m21-execution-plan.test.ts` |
| EXEC08 | IMPLEMENTED | `multi-asset/m24/types.ts` | `helios-multi-asset-m24-execution-settlement-reconciliation.test.ts` |
| EXEC09 | IMPLEMENTED | `multi-asset/m24/settlement-semantics.ts` | `helios-multi-asset-m24-execution-settlement-reconciliation.test.ts` |
| EXEC10 | IMPLEMENTED | `capital-lifecycle/service.ts` | `helios-h24-capital-lifecycle.test.ts` |
| EXEC11 | IMPLEMENTED | `custody/provider-candidate/sandbox.ts` | `custody-simulation-travel-rule.test.ts` |
| EXEC12 | IMPLEMENTED | `multi-asset/m24/reconciliation.ts` | `helios-multi-asset-m24-execution-settlement-reconciliation.test.ts` |
| EXEC13 | IMPLEMENTED | `resilience/scenarios.ts` | `helios-h31-adversarial-resilience.test.ts` |
| EXEC14 | IMPLEMENTED | `execution-routing/venue-conformance/` | `helios-os04-venue-adapter-conformance.test.ts` |
| EXEC15 | IMPLEMENTED | `execution-connectivity/exec15-qualification.ts` | `helios-exec15-execution-connectivity-qualification.test.ts` |

All capabilities operate in **simulation / sandbox / paper** environments only.
