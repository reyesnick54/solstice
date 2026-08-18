# Production change management

`ProductionChangeRecord` binds change, reason, affected services, risk,
release, policy/governance reference, approval, deployment result, and
verification.

## Protocol changes

Protocol upgrades continue through canonical Chunk 40 governance and
Chunk 79 operations. Day-2 operations cannot bypass those systems.

## Application changes

Non-consensus deployments still require:

- a release artifact
- change approval appropriate to policy
- health verification
- a rollback strategy where technically applicable

Application rollback does **not** mean blockchain history rollback.
Finalized history is not rewritten.
