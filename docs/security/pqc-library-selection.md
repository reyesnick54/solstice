# PQC library-selection record

Status: **NOT_SELECTED_FOR_PRODUCTION**.

This is not a quantum-proof claim and not a certification.

## Decision

Chunk 33R registers NIST family algorithm IDs and provider ports for
ML-KEM, ML-DSA, and SLH-DSA. It does **not** vendor a production
post-quantum library.

Node.js 22 has no native FIPS 203/204/205. Adding `@noble/post-quantum`
or `liboqs` would expand the trusted computing base before a portable,
reviewed integration exists for this monorepo.

## What shipped

- Provider interfaces (`SignatureProvider`, `KemProvider`)
- Algorithm IDs for `ML-DSA-65`, `ML-KEM-768`, `SLH-DSA-SHA2-128S`
- DRAFT suites that fail closed (no production provider)
- `simulation-pq-placeholder` TEST_ONLY provider using HMAC/SHA-256
  test doubles, labeled as **not** those NIST algorithms

## Candidates (not selected)

| Candidate | Kind | Portable here | Selected |
| --- | --- | --- | --- |
| `@noble/post-quantum` | JavaScript | yes | no |
| liboqs / liboqs-js | native or WASM | no | no |
| future `node:crypto` | runtime | yes | no |

Machine-readable copy lives in
`packages/security/src/pqc-library-selection.ts`.
