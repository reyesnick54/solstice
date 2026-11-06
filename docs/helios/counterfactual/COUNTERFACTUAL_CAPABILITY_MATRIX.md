# Counterfactual Capability Matrix (CF01–CF14)

**Stack marker:** `HELIOS_COUNTERFACTUAL_LEARNING_V1_QUALIFIED`

| Package | Status | Module / owner |
|---------|--------|----------------|
| CF01 | IMPLEMENTED | `packages/platform/src/helios/counterfactual-learning/cf01-decision-ledger.ts` |
| CF02 | IMPLEMENTED | `packages/platform/src/helios/counterfactual-learning/cf02-rejected-opportunity-shadow-book.ts` |
| CF03 | IMPLEMENTED | `packages/platform/src/helios/counterfactual-learning/cf03-behavior-policy-propensity.ts` |
| CF04 | IMPLEMENTED | `packages/platform/src/helios/counterfactual-learning/cf04/` — `tests/helios-cf04-counterfactual-outcome-model.test.ts` |
| CF05 | IMPLEMENTED | `packages/platform/src/helios/counterfactual-learning/cf05-doubly-robust-ope.ts` |
| CF06 | IMPLEMENTED | `packages/platform/src/helios/counterfactual-learning/cf06-distributional-ope/` — `tests/helios-cf06-distributional-ope.test.ts` |
| CF07 | IMPLEMENTED | `packages/platform/src/helios/counterfactual-learning/cf07-sequential-ope/` — `tests/helios-cf07-sequential-ope.test.ts` |
| CF08 | IMPLEMENTED | `packages/platform/src/helios/execution-twin/simulation/` (orchestrator + qualification) — `tests/helios-cf08-market-response-twin.test.ts` |
| CF09 | IMPLEMENTED | `packages/platform/src/helios/counterfactual-learning/cf09-heterogeneous-effects.ts` |
| CF10 | IMPLEMENTED | `packages/platform/src/helios/counterfactual-learning/cf10-decision-attribution.ts` |
| CF11 | IMPLEMENTED | `packages/platform/src/helios/counterfactual-learning/cf11-conservative-policy-improvement.ts` |
| CF12 | IMPLEMENTED | `packages/platform/src/helios/counterfactual-learning/cf12-evolution-memory.ts` |
| CF13 | IMPLEMENTED | `packages/platform/src/helios/counterfactual-learning/cf13-agent-committee.ts` |
| CF14 | IMPLEMENTED | `packages/platform/src/helios/counterfactual-learning/qualification.ts` — `tests/helios-cf14-counterfactual-learning-qualification.test.ts` |

## EVOL15 alignment

Champion/challenger evolution memory and diagnostics live under Strategy Lab and `packages/platform/src/helios/strategy-evolution/`; **`tests/helios-evol14-strategy-self-evolution-qualification.test.ts`** is the engineering gate exercised by `npm run helios:cf14:qualify` alongside CF04/CF06/CF08.
