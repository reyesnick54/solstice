# Cryptographic inventory

Owner: `packages/security`. Machine-readable copy:
[`cryptographic-inventory.json`](./cryptographic-inventory.json).

This inventory is an engineering record. It is **not** a certification,
quantum-proof claim, or counsel review.

Canonical control plane: `packages/security`. Chain consumers:
`packages/sunrey-chain`. Do not create `packages/quantum-security`,
`packages/crypto-v2`, `packages/pqc-core`, `packages/crypto-agility`,
`packages/blockchain-crypto`, or `packages/security-v2`.

## Classical algorithm selected (Chunk 33R)

**Ed25519** (RFC 8032) via `node:crypto`. Canonical algorithm ID:
`Ed25519`. Provider ID: `node-crypto-ed25519`.

Ed25519 is not secp256k1. HMAC-SHA256 remains application
infrastructure (Execution Authority, webhooks, simulation chain
receipts) and is not validator public-key consensus signing.

## Post-quantum status

NIST family IDs `ML-DSA-65`, `ML-KEM-768`, and `SLH-DSA-SHA2-128S`
are registered. No production PQC provider is selected. A
`TEST_ONLY` simulation provider is explicitly labeled as **not**
ML-DSA / ML-KEM / SLH-DSA. See
[`pqc-library-selection.md`](./pqc-library-selection.md).

## Inventory

| ID | Owner | Purpose | Algorithm / provider | Key lifecycle | Quantum exposure | Migration priority | Target architecture | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| execution-authority | permissions + security | EXECUTION_AUTHORITY_SIGNING | HMAC-SHA256 / KeyProvider | ACTIVE rotation | application MAC | keep separate from validator keys | sunrey-app-hmac-v1 | IMPLEMENTED |
| evidence-hashing | evidence + security | EVIDENCE_INTEGRITY | SHA-256 / node:crypto | hash-only | collision/preimage | vault ADR later | unchanged SHA-256 | IMPLEMENTED |
| consent-permits | consent + security | DATA_USE_PERMIT_SIGNING | HMAC-SHA256 | ACTIVE / DEPRECATED verify | application MAC | medium | sunrey-app-hmac-v1 | IMPLEMENTED |
| hmac-webhooks | security | WEBHOOK_SIGNING | HMAC-SHA256 | ACTIVE / DEPRECATED verify | application MAC | medium | sunrey-app-hmac-v1 | IMPLEMENTED |
| passkeys | identity (reserved) | SESSION_SIGNING / WebAuthn | not selected | n/a | authenticator-dependent | research | identity + CryptoSuite | NOT_IMPLEMENTED |
| data-encryption | security | DATA_ENCRYPTION | AES-256-GCM envelopes | ACTIVE encrypt | harvest-now-decrypt-later | high | ML-KEM wrap DRAFT | IMPLEMENTED |
| backup-encryption | security | BACKUP_ENCRYPTION | AES-256-GCM envelopes | ACTIVE encrypt | harvest-now-decrypt-later | high | ML-KEM wrap DRAFT | IMPLEMENTED |
| custody | custody + security | DATA_ENCRYPTION | simulation envelopes | simulation | simulation payloads | later | KeyProvider + suite | IMPLEMENTED (simulation) |
| chain-operation-signing | sunrey-chain + security | CHAIN_OPERATION_SIGNING | HMAC-SHA256 | ACTIVE | not consensus | do not promote to consensus | remain HMAC | IMPLEMENTED (simulation) |
| transaction-signatures | security + sunrey-chain | TRANSACTION_SIGNING | Ed25519 / node-crypto-ed25519 | descriptor lifecycle | CRQC forgery | hybrid TEST_ONLY available | versioned CryptoSuite | IMPLEMENTED (foundation) |
| validator-signatures | sunrey-chain + security | VALIDATOR_CONSENSUS_SIGNING / BLOCK_PROPOSAL_SIGNING | Ed25519; HMAC forbidden | Chunk 36 lifecycle | validator public keys | hybrid-required selected roles | no universal validator key | IMPLEMENTED (contract) |
| p2p-identities | sunrey-chain + security | P2P_IDENTITY | Ed25519 | descriptor | peer identity keys | medium | CryptoSuite; P2P later | IMPLEMENTED (purpose) |
| oracle-signatures | sunrey-chain + security | ORACLE_SIGNING | Ed25519 via CryptoSuite | descriptor | oracle public keys | medium | CryptoSuite; Chunk 43 runtime | IMPLEMENTED (runtime) |

## Migration states (no production dates)

`CLASSICAL_ONLY` → `HYBRID_AVAILABLE` →
`HYBRID_REQUIRED_SELECTED_ROLES` → `PQ_PRIMARY` →
`LEGACY_VERIFY_ONLY` → `LEGACY_RETIRED`.

Transitions are reserved for later protocol-upgrade machinery. AI
cannot change migration state or CryptoSuite lifecycle.
