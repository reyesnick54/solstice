# Chunk 120 — Productive economic event identity

Canonical owner: `packages/sunrey-chain`.

Capability `moonrey-economic-event-attribution` is `IMPLEMENTED` at
`packages/sunrey-chain/src/productive/policy-governance/attribution`.

This chunk extends the existing `moonrey-policy-governance` owner. It
does not create a second attribution package, ledger, or mint path.

See [`docs/economics/chunk-120-productive-economic-event-identity.md`](../economics/chunk-120-productive-economic-event-identity.md).

## Authority rule

A canonical economic event is not Execution Authority and not a
MoonRey issuance instruction. Event identity cannot authorize
issuance. The attribution graph cannot mint.

## What it implements

- `ProductiveEconomicEvent` distinct from a claim
- deliberate event classes that are not 1:1 with `ProductiveCategory`
- cross-object identity via hashed lots, transformation refs, and
  alternate-view evidence
- event relation types, including `SAME_UNDERLYING_EVENT`
- linkage confidence classes that refuse silent merge on weak similarity
- rebuildable `ProductiveAttributionGraph`
- event fingerprint v3, leaving v1/v2 historical
- optional Economic Asset Registry lineage projection
