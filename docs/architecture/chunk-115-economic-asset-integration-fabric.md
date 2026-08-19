# Chunk 115 — Cross-Domain Economic Asset Registry Integration Fabric

Canonical owner remains `packages/economic-asset-registry`.

Capability `sunrey-economic-asset-registry` is `IMPLEMENTED`.

This chunk adds the narrow `EconomicAssetRegistryPort` and source-domain
adapters that project privacy-safe metadata from HIN, the Human
Contribution Registry, the Oracle Network, and the productive economy
into master descriptors.

It does not replace those owners. It does not store raw datasets, value
assets, mint, or become the source of truth for consent, verification,
oracle facts, productive eligibility, or native supply.

See [`docs/economics/chunk-115-economic-asset-integration-fabric.md`](../economics/chunk-115-economic-asset-integration-fabric.md).

## Authority rule

A projected descriptor is an index record. Source domains remain
authoritative. `VERIFIED` on a descriptor is either a source reflection
or registry-policy metadata — never issuance eligibility.

## What it implements

- `EconomicAssetRegistryPort`
- idempotent `projectDescriptor` / lifecycle reflection
- HIN, human-contribution, oracle, and productive adapters
- cross-domain lineage without invented links
- `demo:sunrey-economic-asset-fabric`
