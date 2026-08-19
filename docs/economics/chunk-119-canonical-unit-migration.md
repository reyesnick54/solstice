# Chunk 119 — Canonical Economic Unit Migration Through the MoonRey Productive Pipeline

Canonical owner: `packages/sunrey-chain`.

Capability `sunrey-economic-unit-normalization` remains `IMPLEMENTED`.

Chunk 118 created the exact rational unit/normalization constitution
at `packages/sunrey-chain/src/units`. This chunk migrates newly
processed MoonRey productive evidence onto that authority.

It does not create a second unit package, a Productive Value Function,
or a MoonRey mint.

## Boundary

```
PHYSICAL MEASUREMENT NORMALIZATION
  != ECONOMIC VALUE WEIGHTING
  != MOONREY ISSUANCE
```

`CanonicalProductiveMeasurement` carries source and canonical
quantity, dimension, semantic qualifier, productive category, fact
type, claim type, and a sealed normalization receipt. It does not
carry quality multipliers, economic category weights, or MoonRey
quantities.

## One unit authority

The canonical authority remains:

`packages/sunrey-chain/src/units`

The productive `UnitRegistry` at
`packages/sunrey-chain/src/productive/units.ts` stays as a
category-scoped compatibility facade. `normalize()` remains for
historical replay. It is not an independent semantic authority.

Do not create:

- `packages/moonrey-units`
- `packages/productive-units-v2`
- `packages/economic-normalization-v2`
- `packages/measurement-engine`
- `packages/unit-registry-v2`

## Pipeline

```
Source Observation
  → Verified Economic Fact
  → Normalization Receipt
  → Productive Claim Candidate
  → Verified Productive Contribution
```

Original source quantity and source unit are retained. Callers cannot
substitute a canonical quantity without the matching receipt.

New contributions record:

- `normalizationConstitutionVersion`
- `normalizationReceiptId`
- `canonicalUnit`
- `canonicalMeasurement`
- `PRODUCTIVE_CONTRIBUTION_SCHEMA_V2`
- `PRODUCTIVE_FINGERPRINT_V2`

Historical `PRODUCTIVE_FINGERPRINT_V1` values are unchanged.

## Context-requiring conversions

The productive path fails closed when required context is missing.
Missing duration or resource classification is not inferred.

| Source | Required context | Canonical target |
| --- | --- | --- |
| `kWh` | none | `Wh` |
| `tonne` | none | `g` |
| `gpu_s` | none | `gpu_s` |
| `GPU_HOUR` | none | `gpu_s` |
| `m2` | duration | `m2_s` |
| `m3` (storage) | duration | `L_s` |
| `GB_s` | duration | `B` |
| `compute_s` | CPU or GPU class | `cpu_s` or `gpu_s` |
| `token_inference` | inference qualifier | `TOKEN` |

`1 GPU_HOUR` is `3600 gpu_s`. `1 gpu_s` remains `1 gpu_s`. A
GPU-second is not truncated to zero GPU-hours.

## Semantic binding

A receipt must be compatible with the Chunk 116/117 mapping:

- `ENERGY_PRODUCTION` + `kWh` + `ENERGY` is acceptable
- `AI_INFERENCE_USAGE` + `TOKEN` requires
  `INFERENCE_PROCESSED_TOKENS`
- `machine_h` is usage/capacity time and cannot become `UNIT` output
- `REFERENCE_PRICE` cannot become a productive-output quantity

## Legacy NPU vs canonical measurement

Chunk 74 `LEGACY_NPU_V1` still mixes physical scale, quality,
delivery, and economic-category factors for historical replay.

`CANONICAL_MEASUREMENT_V2` applies none of:

- quality
- economic category
- scarcity
- utilization
- delivery-value
- geographic-value

Those belong to a future Productive Value Function. This chunk does
not build that function.

Eligibility may consume canonical physical measurement. Budgets,
oracle quorum, source quality, duplicate controls, and policy
versioning remain.

## Rejection codes

- `CANONICAL_UNIT_REQUIRED`
- `NORMALIZATION_RECEIPT_REQUIRED`
- `NORMALIZATION_VERSION_MISMATCH`
- `NORMALIZATION_CONTEXT_REQUIRED`
- `NORMALIZATION_DIMENSION_MISMATCH`
- `NORMALIZATION_SEMANTIC_MISMATCH`
- `LOSSY_NORMALIZATION_FORBIDDEN`
- `LEGACY_NORMALIZATION_NOT_ALLOWED_FOR_NEW_CONTRIBUTION`
- `FACT_UNIT_MISMATCH`
- `CLAIM_UNIT_MISMATCH`

## What this chunk does not do

- change MoonRey valuation or production tokenomics
- enable live providers
- apply quality or economic weights during physical normalization
- silently reinterpret historical contributions
- produce a MoonRey quantity from normalization

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains false.
`PRODUCTION_ACTIVE=false`.
`PHYSICAL_NORMALIZATION_INCLUDES_ECONOMIC_WEIGHTING=false`.
`NORMALIZATION_AUTHORIZES_MOONREY=false`.
`LOSSY_CONVERSION=false`.
