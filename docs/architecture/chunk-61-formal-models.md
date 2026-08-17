# Chunk 61 — Formal SunRey protocol models

Implemented on latest `main` after Chunks 56–60. Canonical owner remains
`packages/sunrey-chain`.

- Formal sources: `packages/sunrey-chain/formal/`
- Executable twins / reports: `packages/sunrey-chain/src/formal/`
- Rust harnesses: `packages/sunrey-chain/rust/crates/formal`
- Docs: `docs/assurance/`

Do not create `packages/formal`, `packages/tla`, `packages/model-checker`,
`packages/sunrey-formal`, or `tools/formal`.

Capability `sunrey-formal-assurance` is `IMPLEMENTED`.
`evaluateChunkRequirements` returns `mustStop: false`.

Results are **model checked within stated bounds**. This is not a claim
that the entire SunRey system has been formally verified.
