# Chunk 59 — Software supply-chain security

Implemented on latest `main` after Chunk 55 (Chunks 56–58 were not
present as merged owners). Canonical owner remains
`packages/sunrey-chain`.

- TypeScript: `packages/sunrey-chain/src/supply-chain/`
- Policy data: `packages/sunrey-chain/supply-chain/`
- CLI: `sunrey-release`
- Docs: `docs/security/` and `docs/runbooks/software-supply-chain-incident.md`

Do not create `packages/supply-chain`, `packages/sunrey-release`,
`packages/sbom`, or `packages/reproducible-builds`.

Capability `sunrey-supply-chain` is `IMPLEMENTED`.
`evaluateChunkRequirements` returns `mustStop: false`.

Software release approval signs artifacts. It does not activate
protocol change. `ReleaseAuthority` is not Execution Authority.
