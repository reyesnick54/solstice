# Mainnet readiness framework

Chunk 90 adds the production-handoff and day-2 readiness report at
`packages/sunrey-chain/src/production-handoff`. Handoff states describe
the evidence package, not network launch. See
[chunk-90-production-handoff.md](./chunk-90-production-handoff.md).


Readiness is assembled from machine-readable dimensions. Each dimension
holds requirement ID, description, scope, evidence type, hash/reference,
source, verification status, authorized verifier role, optional review
date, and notes.

## Evidence states

| State | Meaning |
| --- | --- |
| `NOT_PROVIDED` | Slot exists; no artifact is recorded |
| `PROVIDED_UNVERIFIED` | An artifact reference exists but is unverified |
| `ENGINEERING_VERIFIED` | Software/engineering checks passed |
| `EXTERNAL_VERIFICATION_REQUIRED` | Outside evidence is required |
| `HUMAN_VERIFIED` | An accepted human authorization bound the slot |
| `NOT_APPLICABLE` | Explicitly out of scope for the configured policy |

Software cannot convert external evidence into `HUMAN_VERIFIED` without
an accepted `MainnetAuthorizationRecord` from a human actor.

## Evaluator statuses

| Status | Meaning |
| --- | --- |
| `INCOMPLETE` | Required engineering evidence is missing |
| `ENGINEERING_READY_FOR_HUMAN_REVIEW` | Engineering complete; humans still needed |
| `AWAITING_EXTERNAL_EVIDENCE` | External/legal/audit/ceremony slots incomplete |
| `AWAITING_HUMAN_AUTHORIZATION` | Evidence otherwise complete; humans have not signed |
| `AUTHORIZED_CANDIDATE` | Configured policy is satisfied. This does not launch the network. |

Default production policy keeps legal, regulatory, licensing, partner,
formal-assurance, external-review, and real root-of-trust slots
incomplete. The rehearsal therefore evaluates to
`AWAITING_EXTERNAL_EVIDENCE`.

## Distinctions that remain explicit

- Engineering readiness is not legal approval
- Security testing is not an independent audit
- Testnet success is not mainnet authorization
- Software custody is not a licensed custody business
- Software exchange is not a licensed exchange
- PQC software is not production HSM PQC capability
