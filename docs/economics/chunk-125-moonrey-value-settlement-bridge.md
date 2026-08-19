# Chunk 125 — Productive Value → MoonRey Settlement Conversion → Monetary Authority Bridge

Canonical owner: `packages/sunrey-chain`.

Capability `moonrey-productive-value-settlement` is `IMPLEMENTED` at
`packages/sunrey-chain/src/productive/policy-governance/value-settlement`.

This chunk inserts a governed conversion layer between Productive Value
and native MoonRey issuance. It does not create a second mint.

## Why this exists

GPUV is not MoonRey Coin. There is no implicit permanent equality
between the Productive Value Unit and a MoonRey quantity.

## Architecture

Legacy V1 (`LEGACY_ENGINEERING_SIMULATION_V1`):

```text
VerifiedProductiveContribution
→ moonrey.issuance.formula.v1
→ MoonRey quantity
→ Chunk 71 MonetaryIssuanceAuthority
```

Governed V2 (`GOVERNED_VALUE_SIMULATION_V2`):

```text
VerifiedProductiveContribution
→ Productive Value Function
→ GPUV
→ MoonReyProductiveSettlementConversionPolicy
→ MoonReyProductiveSettlementAuthorization
→ Chunk 71 MonetaryIssuanceAuthority
→ canonical AssetSupplyBook
```

`PRODUCTION` remains unavailable.

## Conversion policy

`MoonReyProductiveSettlementConversionPolicy` is versioned. Simulation
fixtures use exact rational arithmetic (`conversionNumerator` /
`conversionDenominator`) and an explicit rounding rule. Production
conversion values are unconfigured. `productionActivated` is `false`.
`parameterClass` is `ENGINEERING_SIMULATION_PARAMETERS`.

1 GPUV is not 1 MoonRey by definition.

## Settlement authorization

`MoonReyProductiveSettlementAuthorization` requires the complete
governed chain. Each of the following is insufficient by itself:

- OracleObservation
- VerifiedEconomicFact
- ProductiveClaim
- VerifiedProductiveContribution
- ProductiveEconomicEvent
- AttributionDecision
- ProductiveValueResult
- GPUV quantity

AI, Financial Agent, S3M, Grok, oracle providers, and productive
controllers cannot authorize. Existing protocol / human governance
actors remain the only simulation authorizers.

## Fail-closed reviews

A new valuation of an already-settled contribution raises
`REVALUATION_SETTLEMENT_REVIEW`. It does not remint and does not claw
back customer MoonRey.

An attribution change after settlement raises
`ATTRIBUTION_SETTLEMENT_ADJUSTMENT_REVIEW_REQUIRED`. It does not
silently issue a difference or burn customer assets.

Replay protection keys contribution fingerprint, event id, productive
value id, value digest, settlement authorization id, and conversion
policy version.

## Caps

The authorized MoonRey quantity is the strictest bound of:

- Productive Value Function cap
- attribution share
- conversion-policy contribution / event / object / controller /
  category-epoch / global-epoch ceilings
- Chunk 71 monetary quantity ceiling

No lower layer may loosen an upper-layer restriction.

## What this chunk does not do

- define 1 GPUV = 1 MoonRey
- let ProductiveValueResult mint
- let the Productive Value Engine call MonetaryIssuanceAuthority
- replace `moonrey.issuance.formula.v1`
- activate production conversion or production issuance
- use the productive-local supply tracker as canonical V2 money

Chunk 71 remains the only constitutional native-asset issuance gate.

```text
GPUV_EQUALS_MOONREY_BY_DEFINITION=false
PRODUCTIVE_VALUE_ENGINE_CAN_MINT=false
AI_AUTHORIZED=false
PRODUCTION_ACTIVE=false
```
