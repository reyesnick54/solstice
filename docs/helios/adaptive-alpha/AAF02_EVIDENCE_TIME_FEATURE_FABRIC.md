# AAF02 — Evidence-Time Feature Fabric

## Objective

Extend the canonical HELIOS observation architecture (`packages/platform/src/helios/observation/`) into a **point-in-time Feature Fabric** for quantitative research and Strategy Lab. This is not a parallel market observation system.

## Ownership

- Domain: `packages/platform/src/helios/feature-fabric/`
- Durable store: `growth.helios_feature_observation`, `growth.helios_feature_manifest` (migration `V071`)
- Persistence adapter: `packages/persistence/src/growth/pg-helios-feature-fabric-store.ts`

## Core types

| Type | Role |
|------|------|
| `FeatureDefinition` | Versioned feature schema and transformation metadata |
| `FeatureObservation` | Sealed feature value with evidence-time and lineage |
| `FeatureValue` | Typed value (minor units, decimal, text, …) |
| `FeatureSnapshot` | Entity-scoped feature collection at an evaluation instant |
| `FeatureVector` | Ordered feature slots for model input |
| `FeatureManifest` | Strategy Lab evaluation reproducibility envelope |
| `FeatureSourceRef` | Pointer to contributing market observation + knowability |
| `FeatureQualityState` / `FeatureAvailabilityState` | Degradation and visibility semantics |

## Non-negotiable point-in-time rule

A feature may not be visible to a decision at time **T** unless:

`feature.knowableAt <= T`

For features built from **N** observations:

`feature.knowableAt >= max(knowableAt of every contributing observation)`

`knowableAt` is **never** derived from economic period-end dates alone. Publication, provider availability, and SunRey arrival/ingestion bound knowability (inherited from `InformationTime`).

## Feature manifest

Every Strategy Lab evaluation can seal a `FeatureManifest` capturing:

- Feature definitions and versions
- Transformations and parameters
- Source datasets and observation knowability ranges
- Entitlements and point-in-time rule (`knowable_at_lte_evaluation_time`)
- Universe definition and missing-value policy
- Code/model version and evaluation timestamp

## Persistence

- Canonical feature bodies are stored in `body_canonical` (JSON).
- Raw provider payloads are **not** duplicated; observations reference `evidence://` refs and `evidence_ref_hash` at the row level.
- Inserts are append-only (`ON CONFLICT DO NOTHING`); revisions remain queryable for historical evaluation times.

## Qualification

Marker: `HELIOS_AAF02_EVIDENCE_TIME_FEATURE_FABRIC_QUALIFIED`

- Tests: `tests/helios-aaf02-evidence-time-feature-fabric.test.ts`
- Gate script: `scripts/helios-aaf02-qualify.ts`

## Safety

Feature creation does **not** grant Execution Authority or enable live financial execution. `ENVIRONMENT` remains `simulation`; `LIVE_*` flags stay off.
