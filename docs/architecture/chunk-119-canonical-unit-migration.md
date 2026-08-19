# Chunk 119 — Canonical unit migration

Canonical owner: `packages/sunrey-chain`.

Capability `sunrey-economic-unit-normalization` remains `IMPLEMENTED`.

This chunk migrates the MoonRey productive pipeline onto the Chunk 118
constitution at `packages/sunrey-chain/src/units`. It does not create
a second unit authority, a second npm package, or a MoonRey issuance
path.

See [`docs/economics/chunk-119-canonical-unit-migration.md`](../economics/chunk-119-canonical-unit-migration.md).

## Authority rule

There is one canonical normalization authority inside
`packages/sunrey-chain`. The productive `UnitRegistry` is a
compatibility facade, not an independent semantic authority.

## Boundary

```
PHYSICAL MEASUREMENT NORMALIZATION
  != ECONOMIC VALUE WEIGHTING
  != MOONREY ISSUANCE
```

`LEGACY_NPU_V1` preserves historical Chunk 74 replay.
`CANONICAL_MEASUREMENT_V2` is physical-only exact rational
normalization.
