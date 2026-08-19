# Chunk 116 — MoonRey Canonical Source-to-Productive Taxonomy Registry

Canonical owner: `packages/sunrey-chain`.

Capability `moonrey-source-taxonomy` is `IMPLEMENTED` at
`packages/sunrey-chain/src/productive/source-taxonomy`.

This chunk is the exhaustive source-to-productive mapping contract. It
does not connect live providers, value output, or mint MoonRey.

See [`docs/economics/chunk-116-moonrey-source-taxonomy.md`](../economics/chunk-116-moonrey-source-taxonomy.md).

## Authority rule

A mapping record is not Execution Authority, not a verified productive
contribution, and not a MoonRey issuance instruction. Chunk 71 remains
the monetary issuance authority.

## What it implements

- expanded production `DataSourceCategory` coverage for every productive
  domain, plus `reference_price`
- deterministic legacy aliases for `resources`, `ai_usage`, and
  `service_delivery` without rewriting historical records
- one-to-many `DataSourceCategory → FactType` mappings
- explicit fact types for infrastructure, goods, AI compute capacity /
  training, and automated machine output
- claim-type eligibility that is narrower than “any claim”
- completeness validation that fails the build when a
  `ProductiveCategory` has no source path
- query API: `mappingsForSourceCategory`, `mappingsForFactType`,
  `mappingsForProductiveCategory`, `allowedFactTypesFor`,
  `allowedClaimTypesFor`, `sourcePathExistsFor`,
  `mappingRequiresAttribution`
