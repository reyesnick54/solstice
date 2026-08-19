# Chunk 124 — Deterministic MoonRey Productive Value Function Engine

Canonical owner remains `packages/sunrey-chain`.

Capability `moonrey-productive-value-function` stays `IMPLEMENTED` at
`packages/sunrey-chain/src/productive/policy-governance/value-function`.

Chunk 123 defined the Productive Value Function constitution, GPUV,
factor taxonomy, exact-arithmetic helpers, category rules, and the
policy registry. It intentionally did not compute a value.

This chunk adds the deterministic simulation engine inside that same
module. It does not create `packages/moonrey-value-engine`,
`packages/productive-valuation`, `packages/moonrey-valuation`, or
`packages/economic-value-engine`.

## Engine status is not production status

`ProductiveValueFunctionPolicy.engineImplemented=false` remains the
Chunk 123 constitution-era marker. Historical policy objects keep it.

Chunk 124 introduces a separate runtime status:

```text
engineeringImplemented=true
simulationAvailable=true
productionActivated=false
productionPolicyConfigured=false
canMint=false
canCreateMonetaryAuthority=false
```

Engineering implementation does not activate production. The engine
cannot mint and cannot create monetary or Execution Authority.

## Base value is economic policy

Canonical physical measurement is still owned by
`packages/sunrey-chain/src/units`. The engine never writes conversion
ratios back into that unit system.

The versioned `ProductiveBaseValueSchedule` is the governed bridge:

```text
canonical physical measurement
  → governed base-value schedule
  → preliminary ProductiveValueUnit basis
```

Entries are specific to productive category, canonical unit,
measurement semantic, and eligible claim / realization state. They
define an exact `baseValueNumerator / baseValueDenominator` into GPUV.

These ratios are `ENGINEERING_SIMULATION_PARAMETERS`. They are not:

- `1 Wh = 1 GPUV`
- `1 liter = 1 GPUV`
- `1 GPU-second = 1 GPUV`
- `1 tonne-km = 1 GPUV`

Production schedules remain `UNCONFIGURED`.

## Pipeline

```text
Verified Productive Contribution
  → Canonical Measurement Verification
  → Economic Event Verification
  → Attribution Verification
  → Base Value Schedule Resolution
  → Preliminary Productive Value Basis
  → Required Reference Fact Resolution
  → Factor Evaluation
  → Ordered Factor Composition
  → Attribution Application
  → Policy Floor/Ceiling
  → Final Governed Productive Value
  → Explainability Receipt
```

Cross-references among contribution, claim, object, event, category,
measurement period, normalization receipt, policy version, and
attribution decision are checked before value is calculated. A valid
attribution for Event A cannot value Event B.

## Attribution is mandatory and mathematical

The engine consumes the authoritative Chunk 121/122 share. If a claim
has 40% attribution it receives at most 40% of the governed
pre-attribution value. Attribution is not metadata.

## Safety

- Missing factor evidence follows `FAIL_CLOSED`, `REVIEW_REQUIRED`, or
  `GOVERNED_NEUTRAL_ALLOWED`. The engine does not silently substitute
  `1.0` unless policy allows governed neutral behavior.
- Scarcity is bounded. Price or sentiment cannot define it. The factor
  cannot run away into higher issuance.
- Utilization is `actual / governed capacity` with exact math. A zero
  denominator is rejected. The engine never fabricates a basis.
- Geography requires governed evidence (grid scarcity, basin
  availability, corridor congestion, regional resource availability).
  Arbitrary country preference is rejected.
- Reference price alone cannot establish Productive Value.
- AI economic judgment is rejected.
- Provider self-report is insufficient where independent evidence is
  required.
- Historic `ProductiveValueResult` rows are immutable. A new policy
  version creates a new result with lineage; it does not rewrite
  historic issuance.

## What this chunk does not do

- produce MoonRey quantity
- replace `moonrey.issuance.formula.v1`
- activate production valuation
- change MoonRey supply
- create a mint or monetary authority
- put economic-policy ratios inside `packages/sunrey-chain/src/units`

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains false.

```text
PRODUCTIVE_VALUE_ENGINE_ENGINEERING_IMPLEMENTED=true
VALUE_UNIT=GPUV
GPUV_IS_PHYSICAL_UNIT=false
GPUV_IS_MOONREY=false
ENGINE_CAN_MINT=false
PRODUCTION_ACTIVE=false
```
