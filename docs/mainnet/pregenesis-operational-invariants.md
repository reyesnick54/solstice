# Pre-genesis operational invariants

The following invariants are evaluated on every qualification run:

| Invariant | Meaning |
| --- | --- |
| `NO_CONFLICTING_FINALITY` | No two different finalized blocks at one height |
| `SIGNER_SAFETY` | Dual-active fencing is rejected; anti-double-sign persists |
| `STATE_ROOT_CONVERGENCE` | Healthy validators agree on height, block ID, state root, validator-set hash |
| `SUPPLY_RECONCILIATION` | Rehearsal-only SunRey/MoonRey supply audits |
| `NO_DUPLICATE_SETTLEMENT` | Sandbox DVP is at-most-once |
| `NO_DUPLICATE_WITHDRAWAL` | Sandbox withdrawal workflow is at-most-once |
| `BACKUP_VERIFIABLE` | Chain, database, signer-safety, configuration, and release backups verify |
| `RESTORE_CONVERGES` | Isolated restore reconciles with expected canonical state |
| `NO_SECRET_EXPOSURE` | Logs contain no private keys, secrets, KYC payloads, or raw PDV data |
| `CONFIGURATION_PARITY_ACCOUNTED` | Every variance is classified; unexpected variance fails |

A no-quorum partition must not fabricate financial finality. After
recovery, nodes converge.
