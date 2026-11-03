# HELIOS Adaptive Alpha Fabric V2 — Final Report (AAF V2.6)

## Objective

Adaptive Alpha Fabric V2 is a **mandatory integrity layer** between Strategy Genome research and HELIOS strategy qualification (Strategy Lab, H18 promotion, H20 meta-allocator inputs).

Branch: `helios/aaf-v2`

Qualification marker: `HELIOS_ADAPTIVE_ALPHA_FABRIC_V2_QUALIFIED`

## Integrated components

| Work package | Capability | Canonical owner |
| --- | --- | --- |
| AAFV2.1 | Universal evidence-time feature fabric | `packages/platform/src/helios/feature-fabric` |
| AAFV2.2 | Temporal entity and instrument graph | `packages/platform/src/helios/feature-fabric/entity-resolution` |
| AAFV2.3 | Point-in-time dataset compiler | `packages/platform/src/helios/feature-fabric/compiler` |
| AAFV2.4 | Coverage and missingness intelligence | `packages/platform/src/helios/feature-fabric/feature-coverage` |
| AAFV2.5 | Statistical bias sentinel | `packages/platform/src/helios/feature-fabric/aaf06` |
| AAFV2.6 | Strategy Lab binding and final qualification | `packages/platform/src/helios/adaptive-alpha-v2` |

## Mandatory research pipeline

```
Research hypothesis
  → Strategy Genome
  → Feature requirements
  → AAFV2 entity resolution
  → AAFV2 point-in-time dataset compilation
  → coverage assessment
  → missingness assessment
  → bias assessment
  → dataset certification
  → Strategy Lab
  → chronological evaluation → holdout → walk-forward → shadow → paper
  → promotion consideration (H18)
```

Orchestration entrypoint: `runAdaptiveAlphaResearchPipeline` in `packages/platform/src/helios/adaptive-alpha-v2/pipeline.ts`.

## Mandatory gates

All gates are evaluated in `evaluateAdaptiveAlphaMandatoryGates`:

- `POINT_IN_TIME_INTEGRITY`
- `ENTITY_RESOLUTION_INTEGRITY`
- `REVISION_INTEGRITY`
- `FEATURE_LINEAGE_INTEGRITY`
- `COVERAGE_INTEGRITY`
- `MISSINGNESS_INTEGRITY`
- `BIAS_INTEGRITY`
- `ENTITLEMENT_INTEGRITY`
- `REPRODUCIBILITY`

Strategy promotion (`gateResearchToEvaluation`) requires a portable AAF qualification record when `QualificationPolicy.requireAdaptiveAlphaQualification` is true (default).

## Authority rules

- AI agents and Strategy Genome mutators **cannot** waive AAF failures, change thresholds, or self-certify (`assertAdaptiveAlphaActorMayCertify`).
- WARNING gates may proceed only with a recorded controlled review (reviewer, reason, timestamp, warning gate, policy version, Evidence Vault reference).
- SEVERE bias failures remain blocked unless a separate governed review path is satisfied (AAF06 controlled review semantics).

## Evidence and counterfactual / VOI

- `AdaptiveAlphaEvidenceBundle` seals certification payloads into the Evidence Vault.
- Dataset manifests retain observation references for future rejected-opportunity / counterfactual analysis.
- `AdaptiveAlphaValueOfInformationSummary` exposes coverage, missingness, and bias severity for H20 research allocation (value-of-information compatibility).

## Final system test

`tests/helios-aaf-v2-strategy-lab-final-qualification.test.ts` exercises:

1. Multi-source ingest (market, SEC, macro, alternative fixture)
2. Point-in-time compile and manifest reproduction
3. Leakage rejection probe
4. Coverage / bias certification
5. Evidence Vault sealing
6. Strategy Lab promotion block on SEVERE bias

## Superseded open PRs

Do **not** merge PRs #579, #580, or #581. See [OLD_AAF_SUPERSESSION_REPORT.md](./OLD_AAF_SUPERSESSION_REPORT.md).
