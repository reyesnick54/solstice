# Chunk 132 — Logistics, Freight, Delivery & Storage Economic Data Fabric

Canonical owner: `packages/sunrey-chain`.

Capability `sunrey-logistics-storage-data-fabric` is `IMPLEMENTED` at
`packages/sunrey-chain/src/oracle/production/provider-families/logistics`.
It extends the existing `sunrey-production-oracles` owner. It does not
create a second oracle network, a second mint, or a live named-carrier
integration.

## Why this exists

Freight, delivery, and warehouse sources describe different economic
events than goods production. A manufactured batch that is later
transported and stored must keep:

```
manufacturing event → goods batch → logistics event → storage event
```

Logistics value is measured from the logistics service. It is not a
replay of the goods production quantity.

## Source families

Provider-neutral families only. Named vendors are not connected.

- `TMS`
- `FREIGHT_CARRIER_SYSTEM`
- `VEHICLE_TELEMATICS_GATEWAY`
- `PROOF_OF_DELIVERY_SYSTEM`
- `CUSTOMS_STATUS_REFERENCE`
- `PORT_TERMINAL_SYSTEM`
- `RAIL_FREIGHT_SYSTEM`
- `AIR_CARGO_SYSTEM`
- `MARITIME_CARGO_SYSTEM`
- `WMS`
- `WAREHOUSE_METER`
- `COLD_STORAGE_METER`

## Canonical facts

Existing fact types only. No synonym types.

- `LOGISTICS_CAPACITY`
- `DELIVERY_COMPLETION`
- `STORAGE_CAPACITY`
- `GOODS_DELIVERY` when semantic mapping requires it

Realization state distinguishes available capacity from realized
service. A truck's carrying capacity is not tonne-km performed. A
warehouse's available cubic volume is not m³-hours of storage.

## Freight measurement

Canonical freight output may use `tonne_km` when the source provides
mass and distance, or directly attested tonne-km. Derivation uses exact
rational arithmetic and seals a receipt. Distance alone or mass alone
cannot become tonne-km. Floating-point quantities are refused.

## Multi-leg transport

A shipment may have road, rail, port, ocean, and final-mile legs. Each
independently realized leg may be a distinct logistics service.
Whole-journey plus all legs cannot take full value simultaneously.
Overlapping independently realized legs are refused.

## Delivery completion

`BOOKED`, `IN_TRANSIT`, and `OUT_FOR_DELIVERY` do not prove completion.
Governed completion requires `DELIVERED`, `ACCEPTED`, or equivalent
evidence. Proof of delivery prefers a commitment or reference.
Handwritten signature images are not stored unless source policy
explicitly requires them.

Carrier, TMS, customer WMS, and terminal reports of the same shipment
corroborate one delivery. They do not create four deliveries. Different
APIs operated by the same carrier are not independent controllers.

## Storage

`STORAGE_CAPACITY` available volume is capacity. Realized storage
service requires occupied volume and a duration. Chunk 118 duration
context is required before `m3_hour`. Warehouse cubic volume and
digital byte storage remain distinct physical dimensions. They are not
normalized into one unit.

Cold-storage temperature telemetry is supporting quality evidence. It
is not storage quantity and does not create a productive event per
reading.

## Privacy and movement review

Public payloads use route commitments, approved geographic scope,
origin/destination region references, distance measurement, and
proof-of-delivery references. Raw GPS traces and customer addresses
stay off-chain or restricted.

Engineering checks flag impossible speed, timestamp reversal,
teleporting location, duplicate vehicle telemetry, and distance
inconsistency. Those flags require review. They are not a
security-grade anti-GPS-spoofing solution.

## Authority boundary

```
RAW_GPS_PUBLIC=false
GOODS_PRODUCTION_RECOUNTED_AS_LOGISTICS=false
WAREHOUSE_CAPACITY_EQUALS_STORAGE_SERVICE=false
REAL_CARRIER_CONTACTED=false
PRODUCTION_ACTIVE=false
```

A logistics or storage fact cannot auto-mint MoonRey.

## Demo

`demo:moonrey-logistics-data-fabric` walks manufactured batch B1 through
carrier pickup, two transport legs, delivery completion, and a
warehouse storage period.

Do not create `packages/logistics-data-fabric`,
`packages/freight-oracles`, `packages/warehouse-storage-oracles`, or
`packages/moonrey-logistics`.
