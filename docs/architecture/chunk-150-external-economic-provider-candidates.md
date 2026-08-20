# Chunk 150 — External economic provider candidates

Canonical owner:
`packages/sunrey-chain/src/oracle/production/external-provider-candidate`

This chunk extends the existing production-oracle owner. It does **not**
create a second oracle capability.

Required capabilities (all `IMPLEMENTED` on `main`):

- `sunrey-production-oracles`
- `sunrey-economic-data-connector-runtime`
- `sunrey-provider-certification`
- `sunrey-unified-economic-data-fabric`
- `sunrey-provider-runtime`
- `sunrey-oracle-network`

`evaluateChunkRequirements` returns `mustStop: false`.

Forbidden packages:

- `packages/external-oracle-providers`
- `packages/oracle-provider-candidates`
- `packages/external-economic-oracles`

See [`docs/economics/chunk-150-external-economic-provider-candidates.md`](../economics/chunk-150-external-economic-provider-candidates.md).
