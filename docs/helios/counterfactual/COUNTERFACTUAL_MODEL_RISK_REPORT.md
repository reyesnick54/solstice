# Counterfactual Model Risk Report (CF14)

**Marker:** `HELIOS_COUNTERFACTUAL_LEARNING_V1_QUALIFIED`

## Principal risks

| Risk | Mitigation |
|------|------------|
| Hindsight profit narration | Hard ban on customer-facing guaranteed missed profit; CF10 attribution ties outputs to gates |
| Propensity misspecification | Overlap metrics, SNIPS, DR instability flags (adversarial C) |
| Outcome model misspecification | DR + DM disagreement diagnostics; `INCONCLUSIVE` when both weak (D) |
| Confusing passive vs execution | CF02 stores **both** passive shadow and Execution Twin outcomes (F) |
| Drawdown neglect | CF06 distributional OPE + risk caps on CF11 challengers (H) |
| Expert noise as ground truth | Annotations tagged; excluded from IPS unless factual (E) |
| Live trading | `LIVE_TRADING_ENABLED=false`; `production_authorized=false` in authority posture |

## Agent committee (CF13)

Advisory only: PropensityReview, OutcomeModelReview, OPEDiagnostics, TwinScenarioReview, PolicySafety. No Execution Authority.

## EVOL integration (CF12 / EVOL15 line)

Conservative challengers enter Strategy Lab champion/challenger as **candidates** with sealed diagnostics; promotion remains gated by existing AAF / Strategy Lab flows — never automatic from counterfactual scores alone.

