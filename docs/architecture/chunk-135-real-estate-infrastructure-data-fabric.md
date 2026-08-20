# Chunk 135 — Real-estate / infrastructure data fabric

See [`docs/economics/chunk-135-real-estate-infrastructure-data-fabric.md`](../economics/chunk-135-real-estate-infrastructure-data-fabric.md).

Canonical owner remains `packages/sunrey-chain` at
`packages/sunrey-chain/src/oracle/production/provider-families/real-estate`
and
`packages/sunrey-chain/src/oracle/production/provider-families/infrastructure`.
Capability `sunrey-production-oracles` is extended. Bounded capability
`sunrey-real-estate-infrastructure-data-fabric` names this evidence layer.

Governed extensions: FactType `REAL_ESTATE_USAGE`; oracle UnitCodes
`m2_hour` and `facility_hour` (Chunk 118 semantics unchanged).

Do not create `packages/real-estate-oracles`,
`packages/infrastructure-oracles`, `packages/property-data-fabric`,
`packages/facility-data-fabric`, or a second oracle owner.
