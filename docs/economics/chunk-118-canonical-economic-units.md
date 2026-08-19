# Chunk 118 — Canonical SunRey/MoonRey Economic Unit & Normalization Constitution

Canonical owner: `packages/sunrey-chain`.

Capability `sunrey-economic-unit-normalization` is `IMPLEMENTED`.

This chunk is the conversion constitution between oracle source units
and productive-registry abstractions. It does not issue MoonRey, change
valuation weights, or activate production providers.

Chunk 43 remains the protocol unit-contract owner. This constitution
extends that owner inside the same package. The productive
`UnitRegistry` at `packages/sunrey-chain/src/productive/units.ts` is a
category-scoped compatibility facade. Machine-economy units stay
machine-specific. There is no second npm package and no second
canonical `UnitRegistry` authority.

Chunk 116/117 source taxonomy and claim-enforcement layers, when
present, consume this contract. They do not invent a parallel unit
lattice. Chunk 119 performs deeper consumer migration.

## Why this exists

Oracle vocabulary and productive vocabulary are not a set of simple
aliases. Some pairs are exact SI scales. Some require time or resource
context. Some are different physical dimensions and must never convert.

Unsafe or lossy conversion is a MoonRey integrity failure.

## Dimensions

Explicit measurement dimensions:

- `ENERGY`, `MASS`, `VOLUME`, `AREA`, `TIME`
- `AREA_TIME`, `VOLUME_TIME`
- `GPU_TIME`, `CPU_TIME`, `GENERIC_COMPUTE_TIME`
- `AI_TOKEN_COUNT`, `MACHINE_TIME`, `ITEM_COUNT`
- `MASS_DISTANCE`
- `DATA_VOLUME`, `DATA_RATE`
- `FACILITY_TIME`, `SERVICE_TIME`

`REFERENCE_PRICE` is not a universal physical unit. Price requires
explicit base/quote/denomination metadata in a reference-price schema.
A `REFERENCE_PRICE` fact type cannot ride `units_produced` through this
constitution.

## Exact conversion

Quantities are `ExactQuantity` values: integer `mantissa`, integer
`scale`, and an exact rational `numerator` / `denominator`. Conversion
uses only bigint / rational arithmetic.

Outcomes:

- `SUCCEED_EXACTLY`
- `REQUIRE_CONTEXT`
- `INCOMPATIBLE_DIMENSION`
- `LOSSY_CONVERSION_FORBIDDEN`
- `UNKNOWN_UNIT`

There is no silent rounding. A GPU-second is not truncated to zero
GPU-hours. The internal GPU-time base is the second, so `1 gpu_s`
becomes `1/3600 GPU_HOUR` exactly.

## Safe aliases

Equivalent only when the semantics match:

| Source | Target | Rule |
| --- | --- | --- |
| `tonne` | `t` | mass alias |
| `tonne_km` | `t_km` | mass-distance alias |
| `units_produced` | `UNIT` | item-count / output fact only |
| `token_inference` | `TOKEN` | processed inference tokens, version `token.inference.alias.v1` |

`machine_h` is usage/capacity time. `units_produced` is an output
count. They are not convertible.

## Context-aware conversions

`NormalizationContext` is a closed record:

`measurementStart`, `measurementEnd`, `durationSeconds`,
`resourceClass`, `resourceCount`, `semanticQualifier`,
`productiveCategory`, `factType`.

Free-form parameters cannot override unit safety.

| Conversion | Required context |
| --- | --- |
| `m2` → `m2_hour` | duration |
| `m3` → `m3_hour` | duration |
| `GB_s` → `GB` | duration |
| `compute_s` → `GPU_HOUR` | `resourceClass=GPU` |
| `compute_s` → `CPU_HOUR` | `resourceClass=CPU` |

`compute_s` is generic compute time. It does not become CPU or GPU
time without hardware classification. Heterogeneous hardware is not
treated as equivalent.

`service_hour`, `facility_hour`, and `m3_hour` stay distinct.

Mass or kilometres alone cannot become tonne-kilometres.

## Tokens

`token_inference` and productive `TOKEN` are qualified as
`INFERENCE_PROCESSED_TOKENS`. Generated-only counters and future
training-token counters remain distinguishable. They are not aliases
of the inference processed-token unit.

## Receipts and versioning

Every accepted conversion seals a `NormalizationReceipt`:

- `receiptId` is deterministic from source, target, rule, context, and
  constitution version
- `conversionVersion` is `NORMALIZATION_CONSTITUTION_VERSION`
- accepted receipts in this chunk have `exact=true`,
  `roundingApplied=false`, `lossy=false`

Historical observations keep the version they were normalized under.
A later rule change must not silently reinterpret MoonRey evidence.

## What this chunk does not do

- wholesale rewrite of oracle or productive consumers (completed by Chunk 119)
- valuation-weight changes
- MoonRey issuance changes
- live oracle or energy/compute providers
- a fake universal physical unit
- floating-point math

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains false.
`PRODUCTION_ACTIVE=false`.
