# Chunk 106 — Canonical Human Economic Contribution Registry

Canonical owner: `packages/human-economic-contribution`.

Capability `sunrey-human-economic-contributions` is `IMPLEMENTED`.

This chunk extends the Chunk 104 ontology with the canonical system of
record for verified contribution records. It does not create a second
package or capability.

See [`docs/economics/chunk-106-human-contribution-registry.md`](../economics/chunk-106-human-contribution-registry.md).

## Authority rule

A registry record is not an ActionIntent, Execution Authority, or
SunRey issuance instruction. Verification records a privacy-safe
measurement. It does not mint.

## What it implements

- `HumanContributionRegistry` lifecycle: submit, verify, reject,
  supersede, correct, query, snapshot, rebuild
- Canonical registry records with fingerprints and lineage
- Rebuildable query projections
- Deterministic audit summary
- `HumanContributionRegistryPort` for other domains
- In-memory `HumanContributionRegistryStore` for CI

## What it does not do

- Calculate SunRey Coin quantities or contribution valuation
- Issue Execution Authority or mint authority
- Create `packages/human-contribution-registry`,
  `packages/contribution-registry`, or
  `packages/human-economic-contribution-registry`
