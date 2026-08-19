# Chunk 116 — MoonRey Canonical Source-to-Productive Taxonomy Registry

Canonical owner: `packages/sunrey-chain`.

Capability `moonrey-source-taxonomy` is `IMPLEMENTED` at
`packages/sunrey-chain/src/productive/source-taxonomy`.

This chunk creates **one exhaustive mapping contract**:

```
DataSourceCategory
        → FactType
        → ProductiveCategory | null
        → allowed source units
        → allowed ClaimType values
```

It does **not** connect live providers.

It does **not** value productive output.

It does **not** mint MoonRey.

## What a mapping means

A `SourceProductiveMapping` says:

> This fact is semantically capable of supporting this kind of
> productive claim.

It does **not** say:

> Mint MoonRey.

Every mapping record encodes:

- `automaticIssuance: false`
- `mappingAuthorizesIssuance: false`
- `verifiedFactAloneCanMint: false`
- `capacityClaimAutomaticallyIssues: false`
- `reserveClaimAutomaticallyIssues: false`

Chunk 71 remains the monetary issuance authority.

## Data source categories

Canonical collection categories cover every productive domain:

- `energy`
- `food_agriculture`
- `water`
- `minerals_resources`
- `compute`
- `ai_compute`
- `manufacturing`
- `real_estate_use`
- `storage`
- `logistics`
- `bandwidth`
- `infrastructure`
- `goods`
- `services`
- `automated_machine_output`

`reference_price` is a shared reference-data category. It does not
represent a productive contribution.

Historical names remain valid stored values and are never rewritten:

| Stored legacy name | Canonical name |
| --- | --- |
| `resources` | `minerals_resources` |
| `ai_usage` | `ai_compute` |
| `service_delivery` | `services` |

## Fact types

Existing Chunk 43 fact types are reused where they already name the
right measurement. New types were added only where a productive domain
had no explicit collection path:

| Fact type | Why it exists |
| --- | --- |
| `AI_COMPUTE_CAPACITY` | AI accelerator capacity is not generic compute capacity |
| `AI_TRAINING_USAGE` | Training consumption is not inference usage |
| `INFRASTRUCTURE_CAPACITY` | Civil / facility capacity was previously implicit |
| `INFRASTRUCTURE_USAGE` | Measured infrastructure utilization |
| `GOODS_OUTPUT` | Finished goods are not manufacturing process output |
| `GOODS_DELIVERY` | Finished-goods delivery is not logistics capacity |
| `AUTOMATED_MACHINE_OUTPUT` | Autonomous output is not generic manufacturing |

One source category may map to several fact types. Example:

- `energy` → `ENERGY_PRODUCTION`, `ENERGY_CAPACITY`, `ENERGY_CONSUMPTION`
- `manufacturing` → `MANUFACTURING_OUTPUT`, `MANUFACTURING_CAPACITY`
- `compute` → `COMPUTE_USAGE`, `COMPUTE_CAPACITY`

## Claim types

Facts are not eligible for every claim:

- production / output facts → `OUTPUT`
- delivery-completion facts → `DELIVERY`
- verified usage / consumption facts → `USAGE`
- capacity facts → `CAPACITY`
- reserve facts → `RESERVE`

`REFERENCE_PRICE` has `allowedClaimTypes: []`.

## Reference price

`reference_price` / `REFERENCE_PRICE` is handled as:

- `productiveCategory: null`
- `economicAssetCategory: SHARED_ECONOMIC_REFERENCE`
- `canCreateProductiveClaim: false`
- `canBecomeProductiveContribution: false`

It may inform later valuation policy. It is not productive output.

## Overlap risk

`MANUFACTURING`, `GOODS`, `AUTOMATED_MACHINE_OUTPUT`, and
`LOGISTICS_TRANSPORTATION` can describe different views of the same
supply chain. Those mappings set `requiresAttributionPolicy: true`.

This chunk does **not** implement the cross-domain attribution engine.

## Economic Asset Registry

Each mapping points at the existing Economic Asset Registry economic
category. Productive names remain owned by Chunk 44. The asset registry
keeps its mirror/index vocabulary and is not given a second productive
taxonomy.

## Completeness

The registry constructor fails if a `ProductiveCategory` is added
without a source/fact path, or if an active `DataSourceCategory` has no
mapping decision.

`INFRASTRUCTURE`, `GOODS`, and `AUTOMATED_MACHINE_OUTPUT` are no longer
implicit gaps.

## Demo

```
npm run demo:moonrey-source-taxonomy
```

Prints the mapping table and:

```
PRODUCTIVE_CATEGORY_GAPS=0
REFERENCE_PRICE_CAN_CREATE_CLAIM=false
MAPPING_AUTHORIZES_MOONREY=false
PRODUCTION_ACTIVE=false
```
