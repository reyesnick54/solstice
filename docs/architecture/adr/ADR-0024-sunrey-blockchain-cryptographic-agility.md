# ADR-0024 — SunRey Blockchain cryptographic agility model

- Status: ACCEPTED_FOR_ENGINEERING
- Legal / regulatory confidence: RESEARCH_REQUIRED
- Date: 2026-08-16
- Affected subsystem: SUNREY_CHAIN / SECURITY
- Depends on: ADR-0009, ADR-0016, ADR-0025
- Implementation status: IMPLEMENTED (Chunk 33R foundation:
  CryptoSuite registry, Ed25519 via node:crypto, provider ports,
  hybrid envelope, policy). Production node still uses these
  interfaces; no production PQC library. Application KeyProvider
  remains IMPLEMENTED.

## Context

`packages/security` is the only cryptographic control plane for
application signing, envelopes, and Execution Authority HMAC. Chain
consensus and transaction signatures will need additional algorithms
(typically digital signatures, not HMAC). Homegrown primitives are
forbidden. Post-quantum migration must not require a rewrite of every
module (Chunk 33 expands the threat/PQC architecture).

## Decision

1. Every key, signature, and hash on the chain carries an
   **algorithm identifier** from a versioned registry.
2. Crypto is accessed through a **provider port** (modular providers).
   Node-critical providers use established libraries only
   (for example, well-reviewed Rust crates or OS/FIPS modules).
3. Application-level keys continue to use `packages/security`
   `KeyProvider`. Validator and transaction keys are a *new purpose
   family*, not a reuse of `EXECUTION_AUTHORITY_SIGNING`.
4. Hash-for-consensus engineering direction: SHA-256 or SHA-3 family
   from established libraries, domain-separated. Do not invent a
   hash.
5. Signature engineering direction for the first implementation:
   established elliptic-curve signatures (Ed25519 or secp256k1 —
   pick at implementation, not both as silent aliases). HMAC is not
   a consensus signature.
6. Algorithm deprecation is a protocol upgrade. Nodes must reject
   unknown algorithm IDs.
7. No "quantum secure" claim is made.

## Alternatives considered

- **Invent a SunRey signature scheme.**
- **Use HMAC-SHA256 for consensus votes** (already in-tree).
- **Hard-code one algorithm with no ID.**

## Why rejected

- Homegrown crypto is an explicit non-goal.
- HMAC is symmetric; sharing a validator MAC secret is not public
  verifiability.
- Hard-coding blocks PQC hybrid migration.

## Security implications

Algorithm confusion (verify path A, hash path B) is catastrophic.
Providers must not silently fall back. Side-channel resistance is a
library-selection criterion, not a custom implementation task.

## Compliance implications

Algorithm choices are not legal approval. Export-control questions
are `RESEARCH_REQUIRED`.

## Operability implications

Key ceremony and rotation follow ADR-0009 lifecycle states where
applicable. Validator rotation is an epoch change (ADR-0018).

## Migration implications

Simulation `CHAIN_OPERATION_SIGNING` HMAC remains for the TypeScript
trust layer. It is not the production consensus algorithm.

## Unresolved questions

- Ed25519 versus secp256k1 for the first node — **resolved in
  Chunk 33R:** Ed25519 (RFC 8032) via `node:crypto`. Canonical ID
  `Ed25519`. Not an alias for secp256k1.
- Exact provider crate set — TypeScript/Node foundation uses
  `node:crypto`. A later Rust node may select a reviewed crate
  that interoperates with the same algorithm ID.
- Production PQC library — not selected. See
  [`docs/security/pqc-library-selection.md`](../../security/pqc-library-selection.md).

## Status

`ACCEPTED_FOR_ENGINEERING`. Chunk 33R implements the registry,
Ed25519 provider, hybrid envelope, and policy engine in
`packages/security`. Production node consensus signing is not
live. Legal confidence: `RESEARCH_REQUIRED`. Not quantum-proof.
