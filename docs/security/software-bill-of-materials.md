# Software bill of materials

Format: CycloneDX 1.5 JSON.

SBOMs are generated for:

- sunrey-node
- sunrey-rpc
- sunrey-explorer
- sunrey-faucet
- sunrey-relayer
- SDK artifacts
- Exchange service (when packaged)
- custody service (when packaged)

Each component record includes, where available:

- package name
- version
- SHA-256 hash / lock integrity
- supplier / source
- dependency relationship (`dependsOn`)
- artifact identity (the parent application name)

Each release artifact references its SBOM digest in the append-only
release history. The existing testnet generator
`scripts/sunrey-testnet-sbom.mjs` remains available; `sunrey-release
sbom` is the Chunk 59 path.
