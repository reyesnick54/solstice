# Chunk 118 — Canonical economic unit normalization

Canonical owner: `packages/sunrey-chain`.

Capability `sunrey-economic-unit-normalization` is `IMPLEMENTED`.

This chunk extends the Chunk 43 protocol unit contract with an exact
rational conversion constitution at
`packages/sunrey-chain/src/units`. It does not create a second unit
authority, a second npm package, or a MoonRey issuance path.

See [`docs/economics/chunk-118-canonical-economic-units.md`](../economics/chunk-118-canonical-economic-units.md).

## Authority rule

There is one canonical normalization authority inside
`packages/sunrey-chain`. Productive and machine `UnitRegistry`
imports remain compatibility facades.

## What it implements

- explicit measurement dimensions
- `CanonicalUnitDefinition` with integer/rational scales
- `ExactQuantity` / `ExactConversion`
- context-aware conversions that fail closed without duration or
  resource classification
- `NormalizationReceipt` with a retained constitution version
