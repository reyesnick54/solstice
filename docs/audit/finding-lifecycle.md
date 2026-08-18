# External review finding lifecycle

Source: `packages/sunrey-chain/src/audit/findings.ts` (Chunk 62
compatibility) and `packages/sunrey-chain/src/audit/remediation/`
(Chunk 83).

## Schema

`ExternalSecurityFinding` keeps the reviewer's original severity in
`externalSeverity`. Internal engineering severity is a separate
optional field and is never written over the reviewer rating.
Silent downgrade of a mapped external severity is refused.

## Chunk 83 states

1. `RECEIVED`
2. `TRIAGED`
3. `REPRODUCED`
4. `REMEDIATION_IN_PROGRESS`
5. `REMEDIATED_PENDING_RETEST`
6. `EXTERNALLY_RETESTED`
7. `ACCEPTED_RISK`
8. `NOT_REPRODUCIBLE_WITH_EVIDENCE`
9. `SUPERSEDED`

## Authority

AI may help triage. AI cannot assign `EXTERNALLY_RETESTED`.
AI cannot accept security risk.

`ACCEPTED_RISK` requires a human security authority reference.
Every transition records actor, timestamp, source state, destination
state, evidence, and commit. Signature is required where the
destination is an external-retest or risk-acceptance state.

A retest bound to commit A does not automatically clear the same
finding on unrelated commit B. Compatibility must be explicit.

## Chunk 62 compatibility

The earlier `ExternalReviewFinding` states remain for the Chunk 62
engineering bundle. New ingestion uses `ExternalSecurityFinding`.
