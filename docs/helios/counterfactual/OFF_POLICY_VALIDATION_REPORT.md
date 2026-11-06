# Off-Policy Validation Report (CF05–CF07)

**Marker:** `HELIOS_COUNTERFACTUAL_LEARNING_V1_QUALIFIED`

## Estimators

| Estimator | Role | Failure mode |
|-----------|------|--------------|
| **DM** | Direct method (outcome regression) | Misspecification when actions shift |
| **IPS / SNIPS** | Inverse propensity reweighting | Variance / instability under weak overlap |
| **DR** | Doubly robust | More stable than DM when propensity reasonably specified; degrades gracefully with diagnostics |

## Overlap and support policy

- **ESS** (effective sample size) and **max stabilized weight** computed per evaluation window.  
- When overlap falls below configured thresholds → **`INSUFFICIENT_SUPPORT`** / **`BLOCKED`** (adversarial suite A).  
- SNIPS used when raw IPS variance explodes; both reported with explicit weights.

## Distributional and sequential layers

- **CF06** — Quantile / tail risk; **drawdown** enters the comparison even when mean reward favors a policy (adversarial H).  
- **CF07** — Fitted Q / FQE-style value for trajectories with full state transitions; skipped with explicit `NO_SEQUENTIAL_PATH` when history is insufficient.

## Adversarial checks (B–D)

| Scenario | Pass criterion |
|----------|----------------|
| B — Misspecified outcome, good propensity | DR estimate stays closer to semi-synthetic oracle than DM |
| C — Poor propensity, calibrated outcome | `propensity_instability: true`; wide DR confidence / warning |
| D — Both weak | Outcome status **`INCONCLUSIVE`**; no promotion |

## Expert labels (E)

Synthetic or manual “expert” annotations are stored with `evidenceClass: ANNOTATION` and **excluded** from factual IPS denominators unless backed by an auditable observation stream.

