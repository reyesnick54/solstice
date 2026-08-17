# External review finding lifecycle

Source: `packages/sunrey-chain/src/audit/findings.ts`.

## Schema

`ExternalReviewFinding` keeps the reviewer's original severity in
`reviewer_severity`. Internal engineering severity is a separate
optional field and is never written over the reviewer rating.

## States

1. `RECEIVED`
2. `TRIAGED`
3. `REMEDIATION_IN_PROGRESS`
4. `READY_FOR_RETEST`
5. `VERIFIED_RESOLVED`
6. `ACCEPTED_RISK_WITH_HUMAN_APPROVAL`

## Authority

AI may help triage. AI cannot mark an independent finding
`VERIFIED_RESOLVED`. That transition requires a `HUMAN` actor.

`ACCEPTED_RISK_WITH_HUMAN_APPROVAL` requires a human approval
reference. Security exceptions are never granted automatically.
