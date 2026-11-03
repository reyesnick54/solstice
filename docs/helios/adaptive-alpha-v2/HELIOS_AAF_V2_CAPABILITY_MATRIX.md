# HELIOS AAF V2 Capability Matrix

| Gate / artifact | V2 owner | Strategy Lab seam | Promotion impact |
| --- | --- | --- | --- |
| Evidence-time features (V2.1) | `feature-fabric/fabric.ts` | `evaluation/point-in-time-feature-fabric-seam.ts` | Required before evaluation |
| Entity resolution (V2.2) | `feature-fabric/entity-resolution` | Genome feature requirements | `ENTITY_RESOLUTION_INTEGRITY` |
| PIT compiler (V2.3) | `feature-fabric/compiler` | PIT manifest attachment | `POINT_IN_TIME_INTEGRITY`, `REPRODUCIBILITY` |
| Coverage / missingness (V2.4) | `feature-fabric/feature-coverage` | `evaluation/coverage-evidence.ts` | `COVERAGE_INTEGRITY`, `MISSINGNESS_INTEGRITY`, `ENTITLEMENT_INTEGRITY` |
| Bias sentinel (V2.5) | `feature-fabric/aaf06` | `evaluation/coverage-bias-promotion-gate.ts` | `BIAS_INTEGRITY` |
| Dataset certification (V2.6) | `adaptive-alpha-v2/certification.ts` | `evaluation/adaptive-alpha-promotion-gate.ts` | Blocks H18 when failed |
| Qualification policy (V2.6) | `adaptive-alpha-v2/policy.ts` | `QualificationPolicy.requireAdaptiveAlphaQualification` | Default **true** |
| Evidence bundle (V2.6) | `adaptive-alpha-v2/evidence.ts` | Evidence Vault | Audit trail |
| VOI summary (V2.6) | `AdaptiveAlphaValueOfInformationSummary` | Meta allocator inputs (future H20 wiring) | Research spend decisions |

## Domain types (V2.6)

| Type | Purpose |
| --- | --- |
| `AdaptiveAlphaDatasetCertification` | Point-in-time dataset gate verdicts + VOI summary |
| `AdaptiveAlphaQualification` | Strategy-bound certification outcome |
| `AdaptiveAlphaQualificationPolicy` | Mandatory gates and review rules |
| `AdaptiveAlphaFailure` | Blocking / warning failures |
| `AdaptiveAlphaEvidenceBundle` | Sealed certification + policy binding |
