# Chunk 113 — Canonical SunRey Dataset & Economic Asset Registry Foundation

Canonical owner: `packages/economic-asset-registry`.

Capability `sunrey-economic-asset-registry` is `IMPLEMENTED`.

This chunk creates one master metadata/control registry for datasets
and economic evidence assets. It sits above HIN, PDV, PEG, the Human
Economic Contribution Registry, the Oracle Network, the productive
capacity system, and the SunRey/MoonRey monetary constitution.

It does not replace those owners. It does not store raw datasets, value
assets, or authorize minting.

See [`docs/economics/chunk-113-economic-asset-registry-foundation.md`](../economics/chunk-113-economic-asset-registry-foundation.md).

## Authority rule

A registry descriptor is not an ActionIntent, Execution Authority,
settlement instruction, or mint. `VERIFIED` is a registry-policy
state, not issuance eligibility.

## What it implements

- versioned economic-asset class, storage, sensitivity, quality,
  freshness, lineage, rights, and economic-category taxonomies
- `EconomicAssetDescriptor` and `EconomicAssetChainAnchor`
- `EconomicAssetRegistry` with register / query / supersede / correct /
  snapshot / rebuild
- cycle-safe lineage edges
- structural refusal of native SunRey/MoonRey supply records
