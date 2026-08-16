# ADR-0015 — SunRey Chain foundation

- Status: PROPOSED
- Legal / regulatory confidence: RESEARCH_REQUIRED
- Date: 2026-08-16

## Decision

SunRey Chain lives at `packages/sunrey-chain`. It is the reserved
`SUNREY_CHAIN` bounded context.

The chain is a simulation trust layer for consent receipts, revocations,
attestations, provenance, policy decisions, computation receipts, proof
of contribution, and settlement anchors. It is not a second financial
ledger. Canonical `Ledger.postJournal` remains the only money-movement
path.

No production chain technology is selected. The implemented adapter is
an in-process simulation. `DEVELOPMENT`, `TEST_NETWORK_PLACEHOLDER`,
and `PRODUCTION_DISABLED` are named so later work cannot silently
become a live network.

## Consequences

- Application modules write through `ChainWriteIntent` and the policy
  gate. They do not call the adapter directly.
- Raw PDV, PAN/CVV, health, genetic, and private-key material are
  structurally denied.
- Subject references are scope-separated commitments, not a universal
  public identifier.
- Consent databases remain authoritative. The chain stores append-only
  receipts and revocations.
- Proof of contribution does not mint.
- Settlement anchors are recorded after canonical ledger transfers.
  A chain reorg does not rewrite financial state.
- Unknown submission after possible broadcast blocks blind resubmit.
- Signing uses the canonical `KeyProvider` purpose
  `CHAIN_OPERATION_SIGNING`. Raw keys are not stored in source or the
  customer schema.
- SunRey Exchange matching remains out of scope.

This record is not counsel review and does not authorize a live
network, a public ticker, or a production finality threshold.
