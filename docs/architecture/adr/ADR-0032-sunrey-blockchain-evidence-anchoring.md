# ADR-0032 — SunRey Blockchain evidence anchoring and audit model

- Status: ACCEPTED_FOR_ENGINEERING
- Legal / regulatory confidence: RESEARCH_REQUIRED
- Date: 2026-08-16
- Affected subsystem: EVIDENCE / SUNREY_CHAIN
- Depends on: ADR-0015, ADR-0019, ADR-0031
- Implementation status: PARTIAL (simulation evidence anchors);
  production anchoring network: NOT_IMPLEMENTED

## Context

The Evidence Vault is a hash-chained, append-only store of Kernel
decisions and related records. The simulation chain already has an
`EVIDENCE_ANCHOR` record type. Production must not move the vault
onto the chain or make the chain the only copy of a refusal.

## Decision

1. The **Evidence Vault remains authoritative** for Kernel decision
   evidence and the application hash chain.
2. The chain may store **anchors**: a commitment to a vault record
   id + content hash + timestamp + policy version, not the raw
   decision payload when that payload is sensitive.
3. Audit procedure: verify vault chain, then optionally verify the
   on-chain anchor matches. Anchor absence is not "no decision."
   Vault absence is a defect.
4. Refusals still seal in the vault even when nothing is submitted
   to the chain.
5. Reorg of an anchor does not unseal vault evidence.
6. External auditors get vault exports and, later, block headers.
   They do not get raw PDV.

## Alternatives considered

- **Replace the vault with the chain.**
- **Put full Kernel payloads on-chain.**
- **Skip anchoring entirely forever.**

## Why rejected

- Replacing the vault reimplements a protected component and loses
  the existing sealed-refusal property when the chain is down.
- Full payloads leak sensitive data and bloat blocks.
- Never anchoring loses a public-verifiable commitment path the
  protocol wants later.

## Security implications

A forged anchor that does not match the vault is a
reconciliation-mismatch, not a new truth. Nodes must not "repair"
the vault from the chain.

## Compliance implications

Auditability is not legal sufficiency. Record-keeping rules are
`RESEARCH_REQUIRED`.

## Operability implications

Anchor submission is async (already `CHAIN_SUBMISSION_UNKNOWN` in
simulation). Operators investigate unknowns; they do not blind
resubmit.

## Migration implications

Simulation anchors are not production proofs of public finality.

## Unresolved questions

- Anchor cadence (per decision versus batched Merkle of many
  decisions).
- Public verifier UX (out of scope).

## Status

`ACCEPTED_FOR_ENGINEERING` for vault-authoritative, chain-optional
anchors. Production anchoring network: **not implemented**. Legal
confidence: `RESEARCH_REQUIRED`.
