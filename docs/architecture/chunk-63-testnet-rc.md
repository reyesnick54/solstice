# CHUNK-63 — Testnet release-candidate control

Implemented on latest `main` after Chunk 60 (Chunks 61–62 were not
present as merged owners). Canonical owner remains
`packages/sunrey-chain`.

- TypeScript: `packages/sunrey-chain/src/release-candidate/`
- CLI: `sunrey-release rc`
- Docs: `docs/releases/`

Do not create `packages/sunrey-rc`, `packages/release-candidate`,
`packages/testnet-rc`, `packages/sunrey-qualification`, or
`packages/rc-control`.

Capability `sunrey-testnet-rc` is `IMPLEMENTED`.
`evaluateChunkRequirements` returns `mustStop: false`.

This remains TESTNET work. No RC status implies mainnet readiness.
Public tickers remain `NOT_ASSIGNED`. `ReleaseAuthority` signs the
candidate bundle only and does not activate protocol change.
