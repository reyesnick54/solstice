# Chunk 123 — Governed MoonRey Productive Value Function Constitution

Canonical owner: `packages/sunrey-chain`.

Capability `moonrey-productive-value-function` is `IMPLEMENTED` as a
policy/constitution layer at
`packages/sunrey-chain/src/productive/policy-governance/value-function`.

This chunk begins the replacement of simplistic MoonRey simulation
weights with a governed economic valuation architecture. It does not
compute a final productive value, mint MoonRey, or switch the issuance
engine.

The legacy path `moonrey.issuance.formula.v1` remains available and is
labeled `LEGACY_ENGINEERING_SIMULATION_V1`. Historical simulation and
replay continue to use it. Chunk 125 adds the separate V2 path
`GOVERNED_VALUE_SIMULATION_V2`: GPUV is converted by a versioned
settlement policy before Chunk 71 may issue MoonRey. Production
remains unavailable.

## Why this exists

The Chunk 44 development issuance model is:

normalized quantity × category weight × claim-type weight × quality
→ MoonRey simulation quantity

Those parameters are correctly labeled engineering simulation values.
They are not a productive-value theory. Comparing Wh, GPU-seconds,
liters, tonne-km, and service hours as if they were one physical
quantity is the conceptual failure this constitution closes.

## Architectural separation

Encoded invariants:

- physical measurement ≠ productive economic value
- productive economic value ≠ market price
- productive economic value ≠ MoonRey coin quantity
- `PRODUCTIVE_VALUE_FUNCTION_DOES_NOT_MINT = true`
- `PRODUCTIVE_VALUE_FUNCTION_DOES_NOT_CREATE_MONETARY_AUTHORITY = true`
- `ORACLE_FACT_ALONE_CANNOT_CREATE_VALUE = true`
- `CAPACITY_ALONE_IS_NOT_REALIZED_OUTPUT = true`
- `REFERENCE_PRICE_IS_CONTEXT_NOT_AUTOMATIC_VALUE = true`
- `AI_FINAL_ECONOMIC_POLICY_AUTHORITY_FORBIDDEN = true`
- `PRODUCTION_VALUE_POLICY_ACTIVE = false`

Chunk 71 remains the monetary issuance authority. The Productive Value
Function cannot create a second mint or a second monetary constitution.

## ProductiveValueUnit

`GovernedProductiveValueUnit` (`GPUV`) is an explicit economic-policy
valuation unit used only after physical measurements have been
normalized by the Chunk 118 constitution.

It is:

- not a universal physical unit
- not fiat value
- not a market price
- not a MoonRey quantity
- not guaranteed economic value

## Inputs

A `ProductiveValueInput` requires:

- a `VerifiedProductiveContribution`
- a canonical measurement reference
- a normalization receipt/version
- a Productive Economic Event identity (Chunk 120 consumption view)
- an attribution decision and available attribution share (Chunks 121–122)
- the value-function policy/version
- verified reference facts where the factor policy requires them
- jurisdiction/geography, measurement period, oracle quality/provenance

Raw provider payloads are forbidden. Consensus never calls HTTP.

## Factor taxonomy

Governed factor types:

- `REALIZATION_FACTOR`
- `CLAIM_STATE_FACTOR`
- `VERIFICATION_QUALITY_FACTOR`
- `FRESHNESS_FACTOR`
- `SOURCE_INDEPENDENCE_FACTOR`
- `UTILIZATION_FACTOR`
- `SCARCITY_FACTOR`
- `DELIVERY_FACTOR`
- `GEOGRAPHIC_CONTEXT_FACTOR`
- `ECONOMIC_CATEGORY_FACTOR`
- `PROVENANCE_CONFIDENCE_FACTOR`
- `ATTRIBUTION_SHARE_FACTOR`
- `CONCENTRATION_RISK_FACTOR`

Reserved and disabled: demand elasticity, substitution, multi-period
smoothing.

Forbidden: `AI_VALUE_FACTOR`, `MODEL_OPINION_FACTOR`,
`PROVIDER_SELF_REPORTED_VALUE_FACTOR`.

Every factor is versioned and declares its input source, required
reference-fact types, transformation method, min/max/neutral values,
missing-input behavior (`FAIL_CLOSED`, `REVIEW_REQUIRED`,
`GOVERNED_NEUTRAL_ALLOWED`), rounding rule, evidence requirements, and
governance reference.

Composition order is explicit. Arithmetic is bigint / exact rational
only. Factor domains are bounded. There is no hidden model inference.

## Realization, utilization, scarcity

Installed, available, and reserved capacity are describable and not
automatically eligible. Actual output, verified delivery, and completed
economic service may be eligible under policy. Existing conservative
capacity/reserve non-minting remains.

Utilization is a measurable ratio only when independently evidenced.
Divide-by-zero fails closed. Fabricated or provider-self-reported
utilization is rejected where policy requires independent evidence.

Scarcity requires governed reference facts. Price alone cannot define
it. Social-media sentiment cannot define it. The factor is bounded to
prevent runaway positive feedback.

Quality and freshness come from canonical oracle/evidence quality, not
from a provider-set multiplier.

Geographic weighting is versioned, bounded, evidence-based, and
jurisdiction-aware. It is not an arbitrary country-preference
multiplier.

## Attribution

The value function must consume the attribution share created by
Chunks 121–122.

Example: if the event basis is `X` and the claim attribution share is
`400,000 / 1,000,000`, the claim can receive at most 40% of that
governed value basis. The function may not ignore attribution.

Delivery and output are distinguished, but they are not automatically
two full productive events. Attribution remains authoritative for
overlap.

## Concentration

Single-provider, single-controller, rapid source-concentration, and
dominant object/controller issuance concentration can produce a bounded
factor or a review state. Legitimate scale is not automatically
punished. Behavior is explicit and governable.

## Policy and registry

`ProductiveValueFunctionPolicy` is stored on the existing
`MoonReyPolicyRegistry` owner (tightly coupled
`ProductiveValueFunctionPolicyRegistry`).

Policy states: `DEVELOPMENT`, `SIMULATION`, `PRODUCTION_CANDIDATE`,
`SUPERSEDED`.

AI may propose. AI cannot activate. Historical policies are immutable.
Production policy remains `UNCONFIGURED` / inactive.
`parameterClass` is `ENGINEERING_SIMULATION_PARAMETERS`.
`productionActivated` is `false`.

## Forbidden loops

MoonRey market price cannot become an automatic self-referential
multiplier:

MoonRey price → value function → issuance → MoonRey price

That architecture is rejected.

Also rejected: raw HTTP data, unverified provider prices, AI-generated
economic judgment, model-generated scarcity without evidence,
unsupported geography factors, unbounded multipliers, undefined
negative factors, floats/NaN, and provider credentials.

## What this chunk does not do

- implement the Productive Value Function engine
- calculate a final productive value for issuance
- remove or replace `moonrey.issuance.formula.v1`
- change production monetary parameters
- connect live sources
- create `packages/moonrey-value`, `packages/productive-value`,
  `packages/moonrey-tokenomics`, `packages/moonrey-pricing`, or
  `packages/value-function-v2`

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains false.

```text
PRODUCTIVE_VALUE_FUNCTION_ENGINE_IMPLEMENTED=false
PRODUCTIVE_VALUE_UNIT_IS_PHYSICAL_UNIT=false
PRODUCTIVE_VALUE_UNIT_IS_MOONREY=false
PRODUCTIVE_VALUE_FUNCTION_CAN_MINT=false
PRODUCTION_ACTIVE=false
```
