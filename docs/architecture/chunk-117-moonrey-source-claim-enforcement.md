# Chunk 117 — MoonRey Source / Fact / Claim Compatibility Enforcement

Canonical owners:

- `packages/sunrey-chain/src/oracle/source-taxonomy`
- `packages/sunrey-chain/src/productive/claim-candidate`

This chunk extends `sunrey-production-oracles` and
`sunrey-productive-capacity`. It does not create a second oracle,
productive registry, mint, or economic-asset registry.

See [`docs/economics/chunk-117-moonrey-source-claim-enforcement.md`](../economics/chunk-117-moonrey-source-claim-enforcement.md).

## Authority rule

A compatible mapping, a verified economic fact, and a
`ProductiveClaimCandidate` are not MoonRey issuance. Issuance remains
the existing multi-step productive + monetary path.

## What it implements

- versioned `SourceProductiveMapping` registry (Chunk 116 surface)
- deterministic source / fact / unit / category / claim validator
- additional production source and feed onboarding filter
- `ProductiveClaimCandidateBuilder` with object-match and fact-finality gates
- mapping-aware claim submission gate
- mapping version traceability
- attribution-review state for overlap-risk routes
- MoonRey source coverage report with no productive-category gaps
- optional Economic Asset Registry lineage projection
