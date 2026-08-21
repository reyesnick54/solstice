# Chunk 79 — Production governance operations

See [../governance/chunk-79-production-governance-operations.md](../governance/chunk-79-production-governance-operations.md).

Capability `sunrey-governance-operations` is `IMPLEMENTED` at
`packages/sunrey-chain/src/governance-ops`. Existing Chunk 40 protocol
governance remains authoritative. This chunk adds operational packaging,
preflight, human approvals, activation evidence, and bounded emergency
authority. Chunk 167 extends this owner with launch abort and recovery
rehearsal at `packages/sunrey-chain/src/governance-ops/launch-abort`.
Do not create `packages/governance-ops`,
`packages/sunrey-governance`, `packages/governance-token`,
`packages/kill-switch`, `packages/emergency-admin`, or
`packages/rollback-engine`.
