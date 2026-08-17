# Dependency policy

Machine-readable source:
[`packages/sunrey-chain/supply-chain/dependency-policy.json`](../../packages/sunrey-chain/supply-chain/dependency-policy.json).

## Classifications

- `APPROVED` — allowed for the stated role after explicit review
- `REVIEW_REQUIRED` — may exist in the tree; release use needs review
- `TEMPORARY_EXCEPTION` — time-bounded; not a security endorsement
- `BLOCKED` — must not enter a release artifact

Unknown packages default to `REVIEW_REQUIRED`. Popularity is not used
to classify a package as secure.

## Criteria

Source, maintainer activity, license, security advisory, native code,
cryptographic role, network-facing role, and abandonment risk.

## Critical dependencies

These roles require heightened review metadata:

- cryptography
- consensus
- serialization
- P2P
- storage
- wallet signing
- HSM / KMS
- interop proofs

## Cryptographic dependency rule

No homegrown cryptographic primitive. Any library that implements
signature, hash, KDF, AEAD, KEM, or PQC must be registered in
[`crypto-inventory.json`](../../packages/sunrey-chain/supply-chain/crypto-inventory.json).

This inventory is an engineering record. It is not a certification
and not a quantum-proof claim.

## License inventory

The license report lists SPDX-like identifiers when present and flags
GPL, AGPL, SSPL, BUSL, and `UNKNOWN` for human/legal review. The code
does not make a legal conclusion.
