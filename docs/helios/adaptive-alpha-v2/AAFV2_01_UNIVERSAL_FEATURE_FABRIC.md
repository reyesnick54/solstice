# AAFV2.1 — Universal Evidence-Time Feature Fabric

**Qualification marker:** `HELIOS_AAFV2_01_UNIVERSAL_FEATURE_FABRIC_QUALIFIED`

**Canonical owner:** `packages/platform/src/helios/feature-fabric/` (extended under `universal/`)

**Schema:** `sunrey.helios.feature-fabric.v2.1`

## Purpose

Generalize the HELIOS Feature Fabric from OS10 corporate fundamentals into a universal, point-in-time feature system for Strategy Lab and research. The OS10 fundamental service (`createHeliosFundamentalFeatureFabric`) remains unchanged; universal types compose via `fundamental-bridge.ts`.

## Core types

| Type | Role |
| --- | --- |
| `FeatureDefinition` | Versioned feature metadata with `featureFamily` |
| `FeatureObservation` | Evidence-time value with information-time fields and lineage |
| `FeatureSourceReference` | Source observation ref with revision |
| `FeatureComputation` | Derived / cross-asset computation record |
| `FeatureSnapshot` / `FeatureVector` | Evaluation-time bundles |
| `FeatureManifest` | Deterministic Strategy Lab evaluation context |
| `FeatureQuality` / `FeatureAvailability` | Propagated upstream semantics |

## Information-time invariant

For decision time `T`:

- A feature is visible only when `feature.knowableAt <= T`.
- Derived features set `knowableAt = MAX(input.knowableAt)`; derived knowability never precedes any required input.

## Feature families

`FEATURE_FAMILIES` includes market, technical, fundamental, macro, prediction market, cross-asset, research-derived, and related families. Not every family requires a live provider.

## Persistence

Append-only tables (migration `V071__helios_feature_fabric.sql`):

- `growth.helios_feature_observation`
- `growth.helios_feature_manifest`

API: `persistHeliosUniversalFeatureFabricState` / `loadHeliosUniversalFeatureFabricState` in `packages/persistence`.

## Evidence Vault

Strategy Lab manifests seal via `sealUniversalFeatureManifest` (`HELIOS_AAFV2_STRATEGY_LAB_FEATURE_MANIFEST`).

## Tests and qualification

- Integration tests: `tests/helios-aafv2-01-universal-feature-fabric.test.ts`
- Runner: `scripts/helios-aafv2-01-qualify.ts`

## Historical reference

PRs #579–#581 (`helios/adaptive-alpha-fabric`) informed design; this package extends `main` without restoring obsolete layouts or overwriting NATIVE/OS work.
