# ADR-0009 — Canonical cryptographic infrastructure

**Engineering status:** ACCEPTED

**Legal / regulatory confidence:** not a legal opinion; no counsel review

**Affected subsystem:** SECURITY

**Depends on:** none

**Implementation status:** IMPLEMENTED

## Context

Execution Authority HMAC, Evidence Vault SHA-256, and simulation
composition previously used `node:crypto` directly and a raw signing
secret in the accounts runtime. Production signing secrets must not live
in application configuration.

## Decision

`packages/security` is the single cryptographic control plane. Signing,
verification, envelope encryption, secret references, and key lifecycle
go through `KeyProvider` / `SecretProvider`. Algorithms are HMAC-SHA256,
SHA-256, and AES-256-GCM from `node:crypto`. The local provider is
explicitly DEVELOPMENT/SIMULATION. Future KMS/HSM/Vault adapters
implement the same port without vendor SDKs in this chunk.

## Consequences

- `AuthorityIssuer` remains the only issuer; it signs through `KeyProvider`.
- Key metadata may be persisted; key material may not.
- Competing packages `packages/crypto`, `packages/kms`, and
  `packages/secrets` are forbidden.
- Competing post-quantum roots `packages/quantum-security`,
  `packages/crypto-v2`, `packages/pqc-core`, `packages/crypto-agility`,
  and `packages/post-quantum` are forbidden. Chunk 33 is a process-gate
  stop until Chunks 31 and 32 merge; see
  [`chunk-33-stop.md`](../chunk-33-stop.md). This ADR does not authorize
  a quantum-proof or production-certified claim.
