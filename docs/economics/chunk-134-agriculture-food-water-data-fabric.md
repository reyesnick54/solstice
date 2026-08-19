# Chunk 134 — Agriculture, Food & Water Economic Data Fabric

Canonical owner: `packages/sunrey-chain`.

Implementation:

- `packages/sunrey-chain/src/oracle/production/provider-families/agriculture`
- `packages/sunrey-chain/src/oracle/production/provider-families/water`

This chunk extends the existing `sunrey-production-oracles` owner. It does
**not** create a second oracle network, mint, Productive Value Function,
farm-control path, irrigation-control path, or named provider integration.

Bounded capabilities:

- `sunrey-agriculture-food-data-fabric`
- `sunrey-water-data-fabric`

Source taxonomy, provider certification, canonical units, event identity,
attribution, and the Economic Asset Registry stay on their existing owners.

## What this is

Provider-neutral economic evidence architecture for:

- agriculture
- food production
- harvest output
- agricultural commodities
- water production
- treated / desalinated water
- water availability / capacity

## Mandatory separations

| Concept | Fact / semantics | Not |
| --- | --- | --- |
| Planted / growing crop | `PLANTED`, `GROWING` | realized harvest, OUTPUT |
| Forecast yield | `EXPECTED_YIELD` | harvest, FOOD_PRODUCTION |
| Realized harvest | `HARVESTED`, `ACCEPTED_OUTPUT` → `FOOD_PRODUCTION` / `AGRICULTURAL_OUTPUT` | planted area, forecast |
| Processed food | manufacturing transformation lineage | added harvest mass |
| Packaged goods | `GOODS_OUTPUT` lineage | a third full harvest credit |
| Inventory movement | inventory evidence | new agricultural production |
| Weather | reference context | agricultural output |
| Water production | `WATER_PRODUCTION` | availability, irrigation consumption |
| Water availability | `WATER_AVAILABILITY` | produced or delivered water |
| Irrigation | agricultural INPUT | utility water-production ownership |
| Quality / grade | supporting evidence | physical mass or volume |
| Commodity price | `REFERENCE_PRICE` | production or MoonRey |

A planted crop is not production. A forecast yield is not production.
Field area (`m2`) is not convertible into harvested mass without an
independently observed output measurement.

## Units

Harvest uses canonical `kg` and `tonne` through exact unit normalization.
No floating point. Source quantity, source unit, canonical quantity, and
the normalization receipt are retained.

Water uses canonical `L` and `m3` exactly. Measurement period is preserved.
Water production is volume. Volume-time belongs to the storage domain and
is refused here.

Unsupported food measurements (for example milk volume in `L`, egg counts
in `units_produced`) return typed `UNIT_EXTENSION_REQUIRED` rather than
inventing a conversion.

## Event identity

Combine telemetry, farm management, weigh scale, and cooperative intake
may corroborate one harvest. They are not four harvests. Canonical
references exist for farm/site, field/plot, crop cycle, harvest campaign,
harvest batch, lot, silo batch, and packhouse batch.

Cumulative harvest and water meters derive interval quantity as
current − prior valid reading only when register identity and time
ordering are valid. Reset, replacement, rollover, duplicate reading, and
timestamp reversal never become negative output.

## Lineage

1,000 kg wheat harvested → milling → 750 kg flour is lineage, not
1,750 kg of the same productive quantity. Packaged finished food may later
appear as `GOODS_OUTPUT`. Harvest, processing, and goods registration are
not three full credits.

Water production → irrigation consumption → crop harvest is lineage.
Irrigation consumed by a farm is an input. It does not let the farm claim
the water utility's production event.

## Ownership and geography

Farm operator is not automatically landowner. Water operator is not
automatically water-right owner. Operator, controller, land-right,
water-right, concession/license, custodian, and rights holder remain
separate references. Fixture strings are not real permits.

Geography supports farm region, watershed, basin, utility service area,
agricultural district, and jurisdiction. Precise sensitive coordinates
stay redacted under default policy. Geography may later support scarcity
context; it cannot become an arbitrary country multiplier.

Farm management + farm-owned scale + farm-owned equipment telemetry are
not independent organizations. Independent cooperative, regulatory, or
audit sources may count independently only when controller, upstream
organization, and shared control group actually differ.

## Certification

Sandbox feeds exist for harvest mass, grain scale, dairy/food measurement,
water treatment, desalination, availability reference, and cumulative
water meters. Certification still cannot authorize production ingestion
or MoonRey.

The fabric uses Chunk 127 injected `FakeExternalHttpTransport` only.
`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains false.
`PRODUCTION_ACTIVE=false`.

```
npm run demo:moonrey-agriculture-water-data-fabric
```

Printed authority boundary:

```
PLANTED_AREA_EQUALS_OUTPUT=false
FORECAST_YIELD_EQUALS_OUTPUT=false
WATER_AVAILABILITY_EQUALS_PRODUCTION=false
IRRIGATION_CONSUMPTION_EQUALS_WATER_PRODUCTION=false
REAL_PROVIDER_CONTACTED=false
PRODUCTION_ACTIVE=false
```
