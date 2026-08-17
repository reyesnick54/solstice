# CHUNK-64 — SunRey root-of-trust and key ceremony architecture

See [../security/chunk-64-root-of-trust.md](../security/chunk-64-root-of-trust.md).

Implemented on latest `main` after Chunk 60 (Chunks 61–63 were not
present as merged owners). Canonical owner remains
`packages/security`.

Capability `sunrey-root-of-trust` is `IMPLEMENTED`.
`evaluateChunkRequirements` returns `mustStop: false`.

Do not create `packages/ceremony`, `packages/hsm-v2`,
`packages/root-of-trust`, or `packages/key-ceremony`.
Do not create real production private keys in CI.
Do not claim a commercial HSM or production ceremony has been
completed unless external evidence exists.
