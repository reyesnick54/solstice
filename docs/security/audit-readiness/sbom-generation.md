# SBOM generation

## Formats

- **CycloneDX 1.5 JSON** — primary (`dist/testnet-release/sbom.cdx.json`)
- Lock integrity manifest — `dist/testnet-release/release-manifest.json`

## Commands

```bash
# Node + lockfile SBOM (canonical for CI)
npm run testnet:sbom

# Full supply-chain path (Chunk 59)
npm run supply-chain:audit

# Rust components (when building chain)
cd packages/sunrey-chain/rust && cargo metadata --format-version 1
cd packages/sunrey-chain/node && cargo metadata --format-version 1
```

## Contents

Generated SBOM includes:

- `package-lock.json` hash
- `Cargo.lock` hashes (chain + node)
- Protocol schema hash (`srcb-v1.json`)
- Selected dependency components (e.g. `@noble/post-quantum` when present)

Each component record includes name, version, and SHA-256 where available.

## Do not

- Manually fabricate SBOM entries
- Claim SBOM completeness without running generators

## npm audit

```bash
npm audit --audit-level=moderate
```

Included in `npm run security:test`.

## Rust audit (optional)

```bash
cargo install cargo-audit
cd packages/sunrey-chain/rust && cargo audit --locked
```

Skipped gracefully if `cargo-audit` not installed.

See also `docs/security/software-bill-of-materials.md` and `docs/security/chunk-59-supply-chain.md`.
