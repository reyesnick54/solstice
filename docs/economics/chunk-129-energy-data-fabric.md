# Chunk 129 — Energy & Electrical Grid Economic Data Provider Fabric

Canonical owner: `packages/sunrey-chain`.

Implementation: `packages/sunrey-chain/src/oracle/production/provider-families/energy`.

This chunk extends the existing `sunrey-production-oracles` owner. It
does not create a second oracle network, energy mint, or live utility
integration.

## Why this exists

Chunks 127 and 128 added the off-chain connector runtime and provider
certification gate. Real electrical-energy data still needs a
provider-neutral domain family before any named grid or meter API is
connected.

This fabric can eventually ingest verified real-world electrical energy
data. It does not do so yet.

## Constitutional firewall

```
HTTP_FETCH_SUCCESS
  ≠ VERIFIED_ECONOMIC_FACT
  ≠ PRODUCTIVE_CONTRIBUTION
  ≠ PRODUCTIVE_VALUE
  ≠ MOONREY_ISSUANCE
```

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains false.
`PRODUCTION_ACTIVE=false`.

Tests and the demo inject `FakeExternalHttpTransport`. There is no
public-internet call and no real API credential.

## Source profiles

`EnergySourceProfile` is vendor-neutral. Supported classes:

- `GENERATOR_METER`
- `PLANT_TELEMETRY`
- `UTILITY_METER`
- `GRID_OPERATOR_AGGREGATE`
- `DISTRIBUTION_OPERATOR_AGGREGATE`
- `ENERGY_STORAGE_METER`
- `MICROGRID_METER`
- `COMMERCIAL_BUILDING_METER`
- `INDUSTRIAL_ENERGY_METER`
- `ENERGY_MARKET_REFERENCE`

Future endpoint profiles may map a commercial API onto one of these
profiles without changing the domain model.

## Fact types

Only canonical `FactType` values are used:

| Path | Fact type | Productive category | Claim |
| --- | --- | --- | --- |
| energy production | `ENERGY_PRODUCTION` | `ENERGY` | `OUTPUT` |
| energy consumption | `ENERGY_CONSUMPTION` | `ENERGY` | `USAGE` |
| energy capacity | `ENERGY_CAPACITY` | none until units extend | none |
| reference price | `REFERENCE_PRICE` | `null` | none |

Historical fact types are not reinterpreted.

`REFERENCE_PRICE` remains reference-only. It cannot create a
`ProductiveClaim`, `VerifiedProductiveContribution`, GPUV, or MoonRey.

## Units

Accepted physical observations use `Wh`, `kWh`, and `MWh` through the
Chunk 118/119 constitution. Quantities are integer strings. Original
source quantity/unit and the canonical measurement are both retained.

Installed nameplate capacity is a power dimension (`W` / `kW` / `MW`).
The current `UnitCode` vocabulary is energy, not instantaneous power.
The fabric returns `UNIT_EXTENSION_REQUIRED` rather than storing MWh as
MW.

## Meter semantics

- `INTERVAL_ENERGY` — period production or consumption
- `CUMULATIVE_REGISTER` — register snapshot; not period production
- `INSTANTANEOUS_CAPACITY_REFERENCE` — cannot become a productive claim

Interval derivation:

```
current cumulative reading
− previous valid cumulative reading
= interval quantity
```

only when the same meter and register are ordered in time with no reset
or rollover ambiguity.

Reset, rollover, replacement, backwards, duplicate, and reversed
timestamps become explicit review/refusal states. They never become
negative production.

## Channels

`GRID_IMPORT`, `GRID_EXPORT`, `LOCAL_PRODUCTION`, and
`LOCAL_CONSUMPTION` remain distinct. Grid export is not gross
production. A site that produces 100 kWh, consumes 20 kWh, and exports
80 kWh records three measurements.

A consuming facility is not the producer of that electricity.
Behind-the-meter systems use separate source channels / registers.

## Storage

Charge is an input (`STORAGE_CHARGE`). Discharge may be delivered
energy (`STORAGE_DISCHARGE`) but does not automatically become
independent production. Charge + discharge are not two production
events. Round-trip efficiency is not invented.

## Identity and geography

Subjects are privacy-safe hashed references for generator, plant,
meter, grid region, microgrid, and building/facility. Secrets and
customer PII are refused.

Observations carry jurisdiction, region, and grid-zone. Geography is
reference context, not a value preference.

## Time

Required: source timestamp, measurement start, measurement end,
collection timestamp. UTC only. Undefined intervals, `end <= start`,
extreme stale readings, and future readings beyond policy tolerance are
refused. An interval is never inferred from collection time alone.

## Schemas

Provider-neutral families:

- `ENERGY_INTERVAL_V1`
- `ENERGY_CUMULATIVE_REGISTER_V1`
- `ENERGY_CONSUMPTION_INTERVAL_V1`
- `ENERGY_EXPORT_INTERVAL_V1`
- `ENERGY_REFERENCE_PRICE_V1`
- `ENERGY_CAPACITY_REFERENCE_V1`

Adapters map external fields into these schemas.

## Independence and duplicates

`controllerId`, `upstreamOrganizationId`, and `sharedControlGroup`
identify shared control. Three resellers of one upstream grid feed are
not three independent controllers.

Retries of the same meter+interval, `sourceObservationId`, cumulative
retransmission, multi-endpoint plant reading, or unit-alias
retransmission do not create additional economic output.

Multiple meter, plant-telemetry, and grid-aggregate observations of
the same generated interval share one economic event identity.

## Quality

Engineering-governed checks cover continuity, missing intervals,
timestamp regularity, calibration reference, schema validity, freshness,
independence, and conflicts. The source provider cannot select its own
final quality factor.

## Economic Asset Registry

Privacy-safe descriptors for energy source datasets and observation
sets may be projected where current adapters support it. Raw provider
credentials and full raw meter datasets are not stored.

## Demo

```
npm run demo:moonrey-energy-data-fabric
```

Prints:

```
REAL_EXTERNAL_PROVIDER_CONTACTED=false
ENERGY_REFERENCE_PRICE_CREATES_CLAIM=false
CONSENSUS_CALLED_HTTP=false
ENERGY_FACT_AUTO_MINTS_MOONREY=false
PRODUCTION_ACTIVE=false
```

Do not create `packages/energy-oracle`, `packages/grid-oracle`,
`packages/moonrey-energy`, `packages/power-data`, or
`packages/utility-integration`.
