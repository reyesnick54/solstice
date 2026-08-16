# Validator lifecycle (Chunk 36R)

Owner: `packages/sunrey-chain` (`src/validators`,
`rust/crates/validators`).

## States

| State | Meaning |
| --- | --- |
| `CANDIDATE` | Recorded, not bonded |
| `BONDED` | Simulation bond accepted |
| `PENDING_ACTIVATION` | Queued for the next epoch |
| `ACTIVE` | In the consensus set |
| `PENDING_EXIT` | Voluntary exit scheduled |
| `JAILED` | Evidence recorded; not voting |
| `TOMBSTONED` | Permanent; not restorable |
| `EXITED` | Removed at an epoch boundary |

## Allowed transitions

- `CANDIDATE → BONDED`
- `BONDED → PENDING_ACTIVATION | JAILED`
- `PENDING_ACTIVATION → ACTIVE | JAILED`
- `ACTIVE → PENDING_EXIT | JAILED`
- `PENDING_EXIT → EXITED | JAILED`
- `JAILED → TOMBSTONED | BONDED` (restore is conservative: back to
  `BONDED`, never directly to `ACTIVE`)

Every transition emits a reason code (`BOND_ACCEPTED`,
`EPOCH_BOUNDARY_ACTIVATE`, `EXIT_SCHEDULED`, `JAIL_EVIDENCE`, …).
Undefined edges fail closed.

## Epoch rule

The active set of a started epoch is immutable. Queued changes
(`ADD_VALIDATOR`, `ACTIVATE_VALIDATOR`, `CHANGE_VOTING_POWER`,
`ROTATE_CONSENSUS_KEY`, `SCHEDULE_EXIT`, `JAIL_VALIDATOR`,
`RESTORE_ELIGIBLE_VALIDATOR`) apply only at the next epoch
boundary. Mid-height removal is forbidden.

## Controllers

Permitted: `HUMAN`, `LEGAL_ENTITY`, `ENTERPRISE`.
Forbidden: `AI_AGENT`, `ROBOT`, `DEVICE`.
