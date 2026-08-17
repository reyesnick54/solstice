# ADR-0025 — SunRey Blockchain post-quantum migration architecture

- Status: ACCEPTED_FOR_ENGINEERING
- Legal / regulatory confidence: RESEARCH_REQUIRED
- Date: 2026-08-16
- Affected subsystem: SUNREY_CHAIN / SECURITY
- Depends on: ADR-0024, ADR-0028
- Implementation status: PARTIAL (Chunk 60: real standardized PQ
  provider `@noble/post-quantum@0.5.4` integrated for
  development/testnet; hybrid CLASSICAL_AND_PQ; height-activated
  migration rehearsal). Production deployment, external HSM, and
  certification remain pending. Not quantum-secure. Not mainnet.

## Context

Chunk 33 will expand the full threat and PQC architecture. Chunk 31
must freeze a migration *shape* so later node work does not paint
the protocol into classical-only signatures.

This ADR does **not** claim quantum security.

## Decision

1. **Hybrid-first migration:** when PQC signatures are introduced,
   they appear as an additional algorithm ID in a hybrid envelope
   (classical AND PQC) until a later upgrade retires classical
   verification.
2. Genesis and headers already carry algorithm IDs (ADR-0024), so a
   PQC ID can be added by protocol upgrade without a new chain ID
   *unless* the upgrade is a planned hard cutover.
3. Long-lived authority material (validator keys, genesis roots,
   evidence anchors) must be inventory-listed for re-signing or
   dual-verification during migration.
4. Hash agility: if a hash is broken, `app_hash` and evidence
   chaining require an explicit upgrade; Evidence Vault SHA-256
   remains the application vault algorithm until a separate vault
   ADR.
5. No PQC algorithm is selected in this chunk. Candidates must come
   from established standards processes (for example NIST PQC), not
   novel constructions.
6. AI cannot flip a "quantum mode" flag or mark the chain quantum
   secure.

## Alternatives considered

- **Wait until quantum computers exist, then hard-fork.**
- **Claim lattice signatures now without a node.**
- **Replace SHA-256 everywhere in this chunk.**

## Why rejected

- Waiting without agility hooks forces a chaotic cutover.
- Selecting and implementing PQC now would be a false claim and a
  premature TCB expansion. Chunk 33 owns the detailed threat/PQC
  work.
- Replacing Evidence Vault hashing here would break the existing
  vault invariant.

## Security implications

A poorly engineered hybrid (OR instead of AND during transition) lets
an attacker forge with the weaker scheme. Harvest-now-decrypt-later
applies mainly to confidentiality (ADR-0030), not to public
consensus signatures, but recorded signatures may still need
long-term authenticity.

## Compliance implications

No regulatory claim that the chain is quantum-safe. `RESEARCH_REQUIRED`.

## Operability implications

Migration is a versioned protocol upgrade with dual-verify windows
and rollback criteria. Reproducible builds must pin provider
versions.

## Migration implications

Simulation HMAC signatures are not PQC-migrated. They remain
simulation.

## Unresolved questions

- Which NIST (or successor) algorithms to dual-sign with.
- Whether validator keys require HSM firmware that is PQC-capable.
- Evidence Vault hash migration (out of scope here).

## Status

`ACCEPTED_FOR_ENGINEERING` for hybrid, algorithm-ID-based migration
shape. Chunk 33R implemented the hybrid envelope, migration-state
table, provider ports, and a TEST_ONLY simulation provider.
Chunk 60 selects `@noble/post-quantum@0.5.4` for development/testnet
and registers `TESTNET_APPROVED` suites (`ML_DSA_65_V1`,
`ML_KEM_768_V1`, `SLH_DSA_SHA2_128S_V1`, hybrid Ed25519+ML-DSA).
Production PQC / HSM / certification: **not selected**, **not claimed**.
Legal confidence remains `RESEARCH_REQUIRED` and is separate from
engineering implementation.
