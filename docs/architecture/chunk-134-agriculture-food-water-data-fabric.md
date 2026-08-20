# Chunk 134 — Agriculture, food, and water data fabric

See [`docs/economics/chunk-134-agriculture-food-water-data-fabric.md`](../economics/chunk-134-agriculture-food-water-data-fabric.md).

Canonical owner remains `packages/sunrey-chain` at

- `packages/sunrey-chain/src/oracle/production/provider-families/agriculture`
- `packages/sunrey-chain/src/oracle/production/provider-families/water`

Capability `sunrey-production-oracles` is extended. Bounded capabilities
`sunrey-agriculture-food-data-fabric` and `sunrey-water-data-fabric`
name these evidence layers.

Do not create `packages/agriculture-oracle`, `packages/food-data-fabric`,
`packages/farm-connectors`, `packages/ag-data`, `packages/water-oracle`,
`packages/water-data-fabric`, `packages/utility-water`,
`packages/irrigation-oracle`, or a second oracle owner.
