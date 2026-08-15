# Chunk 25R — Privacy Clean Room resume (supersedes historical stop)

**Status:** IMPLEMENTED.

**Supersedes:** `docs/architecture/chunk-25-stop.md` (historical Chunk 25
STOP-ONLY, PR #49).

PR #49 was a constitutional STOP record only. It did not implement the
Clean Room. `chunk-25-stop.md` is historical.

## Why the original stop is historical

The first Chunk 25 agent stopped because Consent Ledger / Purpose
Firewall were absent. After Chunk 24:

- Consent Ledger is IMPLEMENTED (`packages/consent`).
- Purpose Firewall is IMPLEMENTED in that same owner.
- Personal Data Vault is IMPLEMENTED (`packages/personal-data-vault`).

This resume implements the reserved CLEAN_ROOM bounded context at
`packages/clean-room`.

## Canonical owner

- `packages/clean-room`

Forbidden competing roots remain: `packages/privacy-compute`,
`packages/data-clean-room`, `packages/secure-data-room`,
`packages/research-room`, `packages/clean-room-v2`.

## Foundational rule

Computation moves to the data. Raw Personal Data Vault records are not
handed to a requester because the requester paid, authenticated, or was
approved as an enterprise.

Flow:

Enterprise / authorized requester
→ purpose + scope request
→ Consent Ledger
→ Purpose Firewall
→ DataUsePermit
→ Clean Room Session
→ minimized PDV retrieval
→ constrained approved computation
→ Egress Firewall
→ authorized derived result
→ Computation Receipt
→ audit + evidence

## What this chunk implements

- Typed Clean Room IDs and session lifecycle with explicit transitions
- Default-deny authorization: verified ActorContext, requester, purpose,
  per-subject consent, DataUsePermit, scope/recipient/operation match
- Multi-subject cohorts: each subject qualifies independently
- Ephemeral minimized dataset views (no universal decrypted Vault copy)
- Versioned query templates / constrained AST (no arbitrary SQL or code)
- Egress Firewall: RELEASE / REDACT / SUPPRESS / REVIEW_REQUIRED / DENY
- RAW_ROW_EXPORT default DENY
- Engineering privacy thresholds (min cohort/cell, max dimensions/rows)
- QueryBudget that is **not** a differential-privacy epsilon budget
- Recipient + purpose separated HMAC join tokens via KeyProvider
- Consent re-check before execution and before egress
- Immutable CleanRoomComputationReceipt (no raw input)
- ContributionComputationReference metadata only (no coin, no price)
- Persistence of controlled metadata (customer V021)
- Versioned `clean_room.*` events and Evidence Vault seals

## Intentionally unimplemented

- SunRey Coin / any public ticker
- Arbitrary SQL or requester-supplied code
- Raw-row export
- Differential privacy
- TEE / confidential compute / HSM claims
- GDPR / CCPA / PDPL / HIPAA compliance claims
- Live enterprise data or health/genetic production data
- Execution Authority issuance
- Financial journals
