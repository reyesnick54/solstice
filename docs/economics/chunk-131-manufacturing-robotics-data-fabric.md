# Chunk 131 — Manufacturing, Industrial Automation & Robotics Economic Data Fabric

Canonical owner: `packages/sunrey-chain`.

Implementation:
`packages/sunrey-chain/src/oracle/production/provider-families/manufacturing`.

This chunk extends the existing production-oracle owner. It does not
create a second oracle network, a second mint, or any ability to
command industrial equipment.

## Why this exists

SunRey needs a production-candidate, read-only path for economic
evidence from:

- manufacturing execution systems
- factory automation
- industrial equipment
- robotic production

The fabric observes. It does not control factory machinery.

## Security boundary

This integration is read-only. It never creates:

- PLC write commands
- robot motion commands
- SCADA control commands
- machine start/stop commands
- actuator control
- firmware updates
- industrial safety overrides

Connector profiles point at an approved OT/IT read-only gateway with
`PRIVATE_NETWORK` authentication and network class. Public arbitrary
access into industrial control networks is refused.

## Source classes

Provider-neutral classes only. No vendor names are required:

`MES`, `ERP_PRODUCTION_LEDGER`, `SCADA_READ_ONLY_GATEWAY`,
`PLC_READ_ONLY_TELEMETRY`, `ROBOT_CONTROLLER_TELEMETRY`,
`MACHINE_DATA_HISTORIAN`, `QUALITY_MANAGEMENT_SYSTEM`, `WEIGH_SCALE`,
`VISION_INSPECTION_ATTESTATION`, `WAREHOUSE_PRODUCTION_HANDOFF`.

## Fact types

Deliberate canonical paths remain distinct:

- `MANUFACTURING_CAPACITY`
- `MANUFACTURING_OUTPUT`
- `AUTOMATED_MACHINE_OUTPUT`

`GOODS_OUTPUT` may appear in lineage. It is a later identity layer,
not a collapsed manufacturing category.

## Physical units

Supported mappings:

- `units_produced` / `UNIT`
- `kg`
- `tonne`
- `machine_h` where the semantic is usage or capacity

`machine_h` cannot become `UNIT`. Machine operating time is not
product count.

## Event identity

The same manufactured batch may be observed by MES, robot telemetry,
ERP, a weigh scale, and a quality system. Those are evidence sources.
They are not five independent outputs.

Chunk 120/121 prevent two full credits when factory and robot describe
one underlying production event.

A later goods registration preserves:

manufacturing event → output batch identity → goods asset identity

ERP classification change does not mint another production event.

A later logistics movement is a distinct service and is not part of
this chunk.

## What is not output

- A created, scheduled, or released production order
- Machine runtime or an online machine without realized output evidence
- Scrap, rejected output, and unfinished WIP
- Rework until a later completed good-output measurement exists

`AUTOMATED_MACHINE_OUTPUT` requires machine identity, a measurement
period, output quantity, output semantic, and an economic-event
reference.

## Quality, mass, counters, and lineage

Quality attestation is stored as a reference. The quality system
cannot mint.

Mass inputs, output, and scrap may be retained as lineage. Perfect
mass equality is not required; governed tolerances apply.

Interval counters are period output. Cumulative lifetime counts are
not. Undocumented reset is refused. Documented rollover uses the
energy-interval analogue: `(max - previous) + current`.

Batch split `B1 → B1A + B1B` must not increase aggregate productive
quantity. A merged shipment does not fabricate new production.

MES and ERP from the same company or controller are not automatically
independent organizations. A weigh-scale auditor may be a separate
controller where evidence supports that.

## Data minimization

Do not retain PLC memory dumps, machine recipes, proprietary CAD,
trade-secret process settings, robot control programs, or factory
credentials. Device provenance may retain hashed machine, gateway,
firmware, calibration, and attestation references. Attestation is
never fabricated.

## What this does not do

- command or control industrial equipment
- contact a real factory
- activate production ingestion
- mint MoonRey
- collapse manufacturing, machine-output, and goods into one fact

```
INDUSTRIAL_CONTROL_COMMANDS_AVAILABLE=false
SAME_BATCH_MULTIPLE_FULL_CREDITS=false
MACHINE_RUNTIME_EQUALS_OUTPUT=false
REAL_FACTORY_CONTACTED=false
PRODUCTION_ACTIVE=false
```

## Demo

```
npm run demo:moonrey-manufacturing-data-fabric
```

Do not create `packages/manufacturing-oracle`,
`packages/industrial-data-fabric`, `packages/robotics-oracle`, or
`packages/factory-connectors`.
