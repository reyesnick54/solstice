# HELIOS Counterfactual Learning — Final Report (CF14)

**Qualification marker:** `HELIOS_COUNTERFACTUAL_LEARNING_V1_QUALIFIED`  
**Authority:** `packages/platform/src/helios/counterfactual-learning`  
**Environment:** simulation — `LIVE_TRADING_ENABLED=false`; authority map — `production_authorized=false`

## Objective

Qualify HELIOS as an architecture that learns from **both taken and untaken** investment decisions using off-policy and counterfactual methods, while **never fabricating hindsight profits** or promising missed gains to customers.

## Invariants (non-negotiable)

| Invariant | Enforcement |
|-----------|-------------|
| No guaranteed missed profit | Customer layer and research exports label shadow paths as **counterfactual / model-implied**, not realized or promised |
| No fabricated hindsight PnL | Sealed decisions bind `decisionTime` / `asOf`; all “what-if” paths are explicitly scored under models + twins |
| Simulation only | `LIVE_TRADING_ENABLED=false`; CF modules do not issue Execution Authority or post journals |
| Weak evidence fails closed | Poor overlap → `INSUFFICIENT_SUPPORT` / `BLOCKED`; dual weak models → `INCONCLUSIVE` |
| Expert annotation ≠ IPS observation | Synthetic labels are excluded from factual IPS/SNIPS denominators |

## Work packages (CF01–CF13)

| ID | Capability | Owner module |
|----|------------|--------------|
| CF01 | Decision ledger (taken + explicit non-actions) | `cf01-decision-ledger.ts` |
| CF02 | Rejected opportunity shadow book | `cf02-rejected-opportunity-shadow-book.ts` |
| CF03 | Behavior policy / propensity | `cf03-behavior-policy-propensity.ts` |
| CF04 | Outcome model | `cf04/` (cross-fit outcome surface) |
| CF05 | Doubly robust OPE | `cf05-doubly-robust-ope.ts` |
| CF06 | Distributional OPE | `cf06-distributional-ope/` |
| CF07 | Sequential OPE (FQE) | `cf07-sequential-ope/` |
| CF08 | Market response twin | `execution-twin/simulation/` (L1/L2/L3 counterfactual triple) |
| CF09 | Heterogeneous effects | `cf09-heterogeneous-effects.ts` |
| CF10 | Decision attribution | `cf10-decision-attribution.ts` |
| CF11 | Conservative policy improvement | `cf11-conservative-policy-improvement.ts` |
| CF12 | Evolution memory (EVOL) | `cf12-evolution-memory.ts` |
| CF13 | Agent committee | `cf13-agent-committee.ts` |

## End-to-end test narrative (steps 1–19)

1. **Point-in-time opportunity** — AAF V2 / universal feature fabric + temporal envelope (`asOf`, `knowableAt`).  
2. **Candidate actions** — Multiple discrete actions with logged propensities (CF03).  
3. **Policy rejects trade** — Behavioral policy assigns near-zero mass to chosen size/side.  
4. **Seal decision** — CF01 append-only record; Evidence Vault seal (pattern per VAL12 / HEALTH).  
5. **Advance market** — Chronological market path under simulation clock.  
6. **Factual path** — Observable outcomes recorded without counterfactual relabeling.  
7. **Passive shadow outcome** — CF02 shadow PnL **without** execution impact (no market footprint).  
8. **Execution Twin** — `packages/platform/src/helios/execution-twin` simulates lifecycle, fees, partial fills.  
9. **Responsive-market research** — CF08 stress on liquidity / microstructure scenarios.  
10. **Outcome model** — CF04 conditional expectations; calibration diagnostics.  
11. **Policy support** — Effective sample size, overlap curve, max importance weight cap.  
12. **IPS / SNIPS / DR** — CF05; DR uses propensity + outcome correction.  
13. **Distributional OPE** — CF06 quantiles / tail; drawdown-aware summaries.  
14. **Sequential FQE** — CF07 when multi-step trajectories exist.  
15. **Heterogeneous effects** — CF09 subgroup stability checks.  
16. **Gate attribution** — CF10 maps refusals to named gates (risk, overlap, data).  
17. **Conservative challenger** — CF11 improves only under explicit risk caps.  
18. **EVOL champion/challenger** — Strategy Lab evolution memory (CF12); no auto-promotion.  
19. **Seal evidence** — Hash-chained vault entry with full diagnostic bundle.

## Adversarial outcomes (A–H)

| Case | Required outcome |
|------|------------------|
| **A** Poor overlap | `INSUFFICIENT_SUPPORT` / `BLOCKED` |
| **B** Bad outcome model, good propensity | DR remains more robust than DM alone |
| **C** Bad propensity, good calibration | Diagnostics flag instability (variance explosion) |
| **D** Both weak | `INCONCLUSIVE` |
| **E** Wrong “expert” label | Not counted as factual IPS observation |
| **F** Passive profitable, twin negative | System preserves **both** narratives; no single headline |
| **G** Sharp rise after reject | UI/research still **no guaranteed missed profit** |
| **H** Higher mean, bad drawdown | Not auto-better; distributional + risk gates |

## Integration (gates required green)

Engineering baseline V2 (`tests/helios-health06-engineering-baseline-qualification.test.ts`) lists mandatory gates including CI, HELIOS strict scoped typecheck, architecture lint, production safety, AAF V2, EARNINGS, VALUATION, Strategy Lab, Execution Twin, fuzz, formal, nightly bench, and evolution posture. **`npm run helios:cf14:qualify`** additionally runs CF04, CF06, CF08, and EVOL14 qualification tests as subprocess gates.

## Qualification command

`npm run helios:cf14:qualify`

