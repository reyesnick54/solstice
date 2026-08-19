# Chunk 121 — Governed MoonRey Cross-Domain Attribution Policy Engine

Capability `moonrey-policy-governance` is `IMPLEMENTED` and is
extended in place at
`packages/sunrey-chain/src/productive/policy-governance/attribution`.

See [`docs/economics/chunk-121-moonrey-attribution-policy.md`](../economics/chunk-121-moonrey-attribution-policy.md).

This chunk assigns attribution shares. It does not implement the
Productive Value Function, mint MoonRey, or create a second policy
registry. `evaluateChunkRequirements` returns `mustStop: false`.
