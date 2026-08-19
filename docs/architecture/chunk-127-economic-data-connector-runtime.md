# Chunk 127 — Production Economic Data Connector Runtime

Implemented on latest `main` after Chunk 123. Canonical owner remains
`packages/sunrey-chain`. This chunk extends the Chunk 68 production
oracle data plane. It does not create a second oracle consensus
system.

- Runtime: `packages/sunrey-chain/src/oracle/production/runtime.ts`
- Transport: `packages/sunrey-chain/src/oracle/production/transport.ts`
- Demo: `demo:sunrey-oracle-connector-runtime`

See
[`docs/economics/chunk-127-economic-data-connector-runtime.md`](../economics/chunk-127-economic-data-connector-runtime.md).

Do not create `packages/oracle-connectors`,
`packages/data-ingestion`, `packages/moonrey-connectors`, or
`packages/provider-runtime-v2`.

Consensus never calls HTTP. A successful fetch is not a verified
economic fact and does not mint MoonRey.
