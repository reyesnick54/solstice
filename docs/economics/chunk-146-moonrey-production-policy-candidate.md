# Chunk 146 — MoonRey Coin Production-Candidate Policy Package

This chunk defines the production-candidate schema for MoonRey Productive
Value, GPUV → MoonRey conversion, category caps, supply guards, and the
issuance parameter package.

It does **not** choose real MoonRey production tokenomics.
It does **not** invent real GPUV values or conversion rates.
It does **not** activate MoonRey issuance.

## Canonical path

```
External Economic Source
→ Connector
→ Certification
→ Oracle Observation
→ Oracle Consensus
→ Verified Economic Fact
→ Productive Claim
→ Verified Productive Contribution
→ Economic Event
→ Attribution
→ Productive Value Function
→ GPUV
→ Governed GPUV→MoonRey Conversion
→ Chunk 71 MonetaryIssuanceAuthority
→ AssetSupplyBook
→ MoonRey Coin
```

No stage before Chunk 71 is a mint.

## GPUV constitution

Preserved forever:

- GPUV is not a physical unit
- GPUV is not fiat
- GPUV is not market price
- GPUV is not MoonRey
- GPUV does not guarantee economic value

## Canonical owners

| Concern | Owner |
| --- | --- |
| Productive Value policy | `packages/sunrey-chain/src/productive/policy-governance/value-function` |
| GPUV settlement conversion | `packages/sunrey-chain/src/productive/policy-governance/value-settlement` |
| Production parameter assembly | `packages/sunrey-chain/src/economics/production-activation` |

No new packages.

## Production-candidate Productive Value

`value-function/production-candidate/` describes future production
candidate policy. Every ProductiveCategory is reported. Missing base
GPUV values remain `VALUE_UNCONFIGURED`. Test fixtures are
`REHEARSAL_ONLY`.

GPUV schedules bind to canonical measurement semantics (Wh, `gpu_s`,
`UNIT`, `tonne_km`, `DATA_VOLUME`, `AREA_TIME`). Physical normalization
stays in `packages/sunrey-chain/src/units`.

Factors reuse the Chunk 123/124 taxonomy. Forbidden:

- AI / model-opinion factors
- provider self-reported economic-value multipliers
- MoonRey market price
- unverified price multipliers
- arbitrary geography preference
- unbounded scarcity

Price-feedback loops are rejected:

- MoonRey market price → Productive Value → MoonRey issuance
- MoonRey issuance → artificial scarcity → higher GPUV → more MoonRey

REFERENCE_PRICE remains reference-only. Attribution is mandatory. The
same underlying event cannot receive multiple full credits across
exclusive category pairs.

## Conversion and issuance package

`MoonReyProductionSettlementConversionPolicyCandidate` never defaults
to 1 GPUV = 1 MoonRey. Unconfigured conversion fails with
`MOONREY_PRODUCTION_CONVERSION_UNCONFIGURED`.

`MoonReyProductionIssuanceParameterPackage` binds Chunk 143 parameter
ids. The only canonical post-genesis MoonRey issuance class is
`VERIFIED_PRODUCTIVE_CONTRIBUTION`.

Production-candidate settlement requires the complete evidence chain.
Legacy V1 cannot qualify production. Fixture V2 cannot qualify
production. AI, S3M, Grok, models, providers, and controllers cannot
authorize.

## Firewall and shadow

Chunk 143 consumes validated package metadata. Current repository
`MOONREY_COIN_ISSUANCE` remains `ECONOMIC_ACTIVATION_BLOCKED`.

Chunk 126 can inspect production-candidate policy structure as
`PRODUCTION_CANDIDATE_UNACTIVATED` without treating it as active.

## Demo

`demo:moonrey-production-policy-candidate` walks the chain to fixture
GPUV and fixture conversion, then stops before production issuance.
