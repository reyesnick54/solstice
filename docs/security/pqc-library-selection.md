# PQC library-selection record

Status: **SELECTED_FOR_DEVELOPMENT_AND_TESTNET**.
Production: **NOT_SELECTED_FOR_PRODUCTION**.

This is not a quantum-proof claim and not a certification.

## Decision

Chunk 60 selects `@noble/post-quantum@0.5.4` for the TypeScript
CryptoSuite path (development/testnet). See
[pqc-provider-selection.md](./pqc-provider-selection.md).

Node.js 22 has no native FIPS 203/204/205. liboqs native bindings are
not portable across this monorepo CI. Future `node:crypto` FIPS
modules remain preferred if they ship.

## What shipped

- Provider interfaces (`SignatureProvider`, `KemProvider`)
- Explicit algorithm IDs `ML_DSA_65_V1`, `ML_KEM_768_V1`,
  `SLH_DSA_SHA2_128S_V1` (aliases retained)
- `TESTNET_APPROVED` suites backed by noble
- Retained `simulation-pq-placeholder` TEST_ONLY provider
- Known-answer tests from the selected implementation
- Lockfile pin and SBOM component

Machine-readable copy lives in
`packages/security/src/pqc-library-selection.ts`.
