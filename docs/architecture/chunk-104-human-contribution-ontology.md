# Chunk 104 — Canonical SunRey Human Economic Contribution Ontology

Canonical owner: `packages/human-economic-contribution`.

Capability `sunrey-human-economic-contributions` is `IMPLEMENTED`.

This chunk defines what a human economic contribution is. It does not
value, mint, execute, or replace PEG, PEVE, HIN, consent, clean-room,
or the Chunk 71 monetary constitution.

See [`docs/economics/chunk-104-human-contribution-ontology.md`](../economics/chunk-104-human-contribution-ontology.md).

## Authority rule

A contribution event is not an ActionIntent, Execution Authority, or
SunRey issuance instruction. Measurement is a non-monetary unit count.

## What it implements

- Versioned contribution taxonomy
- Source-class and provenance vocabulary
- Reference-safe HumanContributionEvent
- In-memory HumanContributionRegistry
- Structural privacy and authority invariants

## What it does not do

- Calculate SunRey Coin quantities or create a valuation formula
- Use PEVE scores as contribution value
- Mint, issue Execution Authority, or post journals
- Create `packages/human-contribution`,
  `packages/human-economic-contribution-v2`,
  `packages/contribution-ontology`, `packages/human-worth`,
  `packages/contribution-valuation`,
  `packages/human-contribution-score`, or
  `packages/sunrey-contribution`
