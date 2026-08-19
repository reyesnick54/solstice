# Chunk 137 — Goods and services data fabric

See [`docs/economics/chunk-137-goods-services-data-fabric.md`](../economics/chunk-137-goods-services-data-fabric.md).

Canonical owner remains `packages/sunrey-chain` at
`packages/sunrey-chain/src/oracle/production/provider-families/goods`
and
`packages/sunrey-chain/src/oracle/production/provider-families/services`.
Capability `sunrey-goods-services-data-fabric` extends
`sunrey-production-oracles`.

`SERVICE_DELIVERY` is extended to allow `service_hour` for time-based
services. Historical `machine_h` records are preserved.

Do not create `packages/goods-oracles`, `packages/commerce-data-fabric`,
`packages/services-oracle`, or `packages/moonrey-commerce`.
