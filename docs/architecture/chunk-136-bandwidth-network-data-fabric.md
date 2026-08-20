# Chunk 136 — Bandwidth network data fabric

See [`docs/economics/chunk-136-bandwidth-network-data-fabric.md`](../economics/chunk-136-bandwidth-network-data-fabric.md).

Canonical owner remains `packages/sunrey-chain` at
`packages/sunrey-chain/src/oracle/production/provider-families/bandwidth`.
Capability `sunrey-production-oracles` is extended. Bounded capability
`sunrey-bandwidth-network-data-fabric` names this provider-family fabric.

`BANDWIDTH_USAGE_SCHEMA_V1` remains the historical `GB_s` rate contract.
`BANDWIDTH_USAGE_SCHEMA_V2` is the governed volume contract (`GB`, `TB`).
Capacity stays a `DATA_RATE`. Do not create `packages/bandwidth-oracle`,
`packages/telecom-data-fabric`, `packages/network-oracles`, or
`packages/cdn-metering`.
