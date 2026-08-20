# Chunk 135 — Real Estate Use & Infrastructure Economic Data Fabric

Canonical owner: `packages/sunrey-chain`.

Implementation:

- `packages/sunrey-chain/src/oracle/production/provider-families/real-estate`
- `packages/sunrey-chain/src/oracle/production/provider-families/infrastructure`

This chunk extends the existing `sunrey-production-oracles` owner. It does
**not** create a second oracle network, mint, Productive Value Function, or
named property/terminal provider integration.

Capability `sunrey-production-oracles` remains singular. Bounded capability
`sunrey-real-estate-infrastructure-data-fabric` names this provider-neutral
evidence layer.

## Governed vocabulary extensions

| Extension | Owner | Historical compatibility |
| --- | --- | --- |
| FactType `REAL_ESTATE_USAGE` | `oracle/types.ts`, `oracle/schemas.ts` | New. Does not rewrite `REAL_ESTATE_USE_CAPACITY` |
| Oracle UnitCode `m2_hour` | `oracle/types.ts`, `oracle/units.ts` | Projects Chunk 118 `m2_hour` / `AREA_TIME`. No second definition |
| Oracle UnitCode `facility_hour` | `oracle/types.ts`, `oracle/units.ts` | Projects Chunk 118 `facility_hour` / `FACILITY_TIME`. No second definition |
| Mapping `real_estate_use` → `REAL_ESTATE_USAGE` → `REAL_ESTATE_USE` → `USAGE` | source taxonomy | Primary realized-use path |
| Mapping `REAL_ESTATE_USE_CAPACITY` v2 | oracle source-taxonomy | v1 (`CAPACITY`+`USAGE`) is `SUPERSEDED`, not rewritten |

`REAL_ESTATE_USE_CAPACITY` remains available/installed area (`m2`).
It is never used as completed occupancy.

## Real-estate physical semantics

Capacity may be `m2`. Realized usage is `m2 × duration` as canonical
`m2_hour` (base `m2_s`). 100 m² available is not 100 m²-hours used.

A valid realized space-use event includes spaceRef, property/facility
ref, measurement window, area, usage state, controller/operator, and a
use-right/lease **reference** when policy requires it. Area × time is
derived exactly.

## What is not productive use

- property listing, asking rent, sale price, appraisal, assessed value
- legal ownership without a realized usage/occupancy/service state
- vacant space (available capacity)
- person-level resident/tenant/badge/room-access traces
- energy, water, or bandwidth consumed by the building (inputs/context)

Owner, controller, property manager, operator, use-right holder, and
custodian remain separate references. Management records do not infer
title.

## Infrastructure semantics

Infrastructure capacity is classified by infrastructure class
(`PORT_TERMINAL`, `AIRPORT_TERMINAL`, `RAIL_TERMINAL`,
`INDUSTRIAL_FACILITY`, `DATA_CENTER_FACILITY`, `UTILITY_FACILITY`,
`PUBLIC_FACILITY`, `OTHER_GOVERNED_FACILITY`). Facility-hours are not
assumed physically identical across classes.

`INFRASTRUCTURE_USAGE` is realized service. Facility × duration is
exact: 2 governed facility units used for 3 hours → 6 facility-hours.

Historical observations stored as `machine_h` remain
`LEGACY_INFRASTRUCTURE_MACHINE_H_V1` and are reproducible. New
provider-family feeds use `INFRASTRUCTURE_FACILITY_TIME_V2` /
`facility_hour`. `machine_h` is not silently treated as facility-hour.

Capacity of 10,000 units/day is not 10,000 units served. Maintenance
and downtime are operational context, not default negative output.

## Family boundaries

Port terminal usage and ocean freight transport may be distinct
productive services. They are not merged merely because one shipment
touches both. If two claims describe the same underlying service,
event identity and attribution zero the duplicate.

A building may appear as both `REAL_ESTATE_USE` and `INFRASTRUCTURE`.
Classification alone does not create two full credits for one
facility-time service.

Physical transport remains the logistics family
(`PORT_TERMINAL_SYSTEM` there is cargo movement, not
`PORT_INFRASTRUCTURE_SYSTEM` facility service).

Building management, booking, and access-control endpoints under one
controller are not independent quorum members.

## Certification

Sandbox feeds cover real-estate capacity, realized area-time, vacant
property, facility-time usage, terminal usage, and independent
utilization attestation. Adversarial cases include capacity-as-usage,
listing-as-productivity, ownership-as-usage, m² without duration,
silent `machine_h` as facility-hour, person-level logs, fake quorum,
schema drift, float duration, wrong unit, and stale utilization.

Certification still cannot authorize MoonRey, finalize an oracle fact,
or activate production ingestion.

## Economic Asset Registry

Only privacy-safe source/fact metadata is projected. Tenant records,
access histories, and commercial lease documents stay out of public
registry metadata. References and commitments only.

## Demo

```
npm run demo:moonrey-real-estate-infrastructure-data-fabric
```

Prints:

```
PROPERTY_OWNERSHIP_EQUALS_PRODUCTIVE_USE=false
VACANCY_EQUALS_PRODUCTIVE_USE=false
CAPACITY_EQUALS_REALIZED_USE=false
LEGACY_MACHINE_H_REINTERPRETED=false
REAL_PROVIDER_CONTACTED=false
PRODUCTION_ACTIVE=false
```

## What this does not do

- contact a real PMS, BMS, terminal, or airport system
- activate production ingestion or mint MoonRey
- treat capacity, vacancy, listing, or ownership as GPUV
- redefine Chunk 118 `m2_hour` or `facility_hour`
- merge logistics transport with terminal facility service
