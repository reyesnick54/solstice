# Chunk 92 — SunRey validator operator platform

Owner: `packages/sunrey-chain/src/validator-operator`.
Capability: `sunrey-validator-operator-platform`.

This is the operational platform used by SunRey validator operators
before and after network launch. It is a **projection and control
plane**. Canonical chain validator-set state remains authoritative.

It does **not**:

- create a second validator registry
- create a second consensus engine
- create public delegated staking
- create a governance token
- independently change validator-set state
- debit customer assets
- bypass consensus safety
- expose private key material
- expose private personal details publicly

## Operator model

`ValidatorOperator` records operator ID, organization reference,
authorized contacts, operational region, provider references, security
evidence references, incident contacts, and acceptance status.

`ValidatorOperatorOrganization` tracks the actual controller. Different
validator IDs do **not** imply independent operators.

`ValidatorOperatorProfile` is the public/operational descriptor.
Private personal details stay off the public surface.

## Enrollment

`ValidatorOperatorEnrollment` walks:

1. operator profile
2. infrastructure evidence
3. signer evidence
4. Candidate V2 assignment
5. Chunk 85 `ProductionValidatorDossier` (consumed, not duplicated)
6. human acceptance
7. validator governance action
8. activation coordinate

Fixture production acceptance is rejected.

## Fleet

`ValidatorFleet` records validators, sentries, signers, regions,
failure domains, cloud/provider, software release, protocol version,
and `ValidatorFleetHealth`.

Operational node states: `PROVISIONING`, `SYNCING`, `READY`,
`ACTIVE`, `MAINTENANCE`, `DEGRADED`, `JAILED`, `UNBONDING`,
`EXITING`, `RETIRED`. These map onto the Chunk 36 lifecycle where
applicable. Maintenance and degraded are operational overlays on an
`ACTIVE` canonical status.

## Signer inventory

`ValidatorSignerRecord` tracks key purpose, public-key fingerprint,
provider, HSM/KMS state, algorithm, rotation state, fencing state, and
anti-double-sign state. No private key material.

Sentry nodes cannot sign. Dual-active signers are detected.

## Maintenance and upgrades

`ValidatorMaintenancePlan` projects remaining voting power against
the configured operational quorum policy (`BFT_TWO_THIRDS_PLUS_REMAINING`).
Unsafe concurrent plans are refused.

`ValidatorUpgradePlan` binds release, artifact digest, protocol
version, upgrade policy, validator batch, readiness, and
post-upgrade verification. Rolling batches stay inside BFT
availability assumptions. Binary deployment does **not** activate
protocol rules.

## Key rotation

Operator tooling prepares and verifies rotation packages. It cannot
silently replace consensus keys. Replayed packages are rejected. The
old key is rejected after activation. Watermark, fencing, and audit
trail are preserved.

## Recovery, incidents, economics

Recovery workflows cover node, disk, sentry, signer, and
failure-domain loss. Key-compromise paths preserve evidence first
(Chunk 54/64 runbooks).

`ValidatorIncident` types: `NODE_FAILURE`, `SIGNER_FAILURE`,
`KEY_COMPROMISE_SUSPECTED`, `NETWORK_PARTITION`, `STORAGE_CORRUPTION`,
`VERSION_MISMATCH`, `DOUBLE_SIGN_EVIDENCE`, `PROVIDER_OUTAGE`.
Monitoring suspicion is not finalized misconduct.

Bond, reward, penalty, and unbond summaries are projected from
Chunk 72. Operator tooling cannot debit customer assets.

## Access, API, CLI

Authorization is workload/user scoped to an operator. There is no
shared admin secret. An operator cannot control another operator's
resources or receive another operator's signer credential.

AI may summarize governance proposals. AI cannot cast the
human/operator vote.

```
sunrey-ops validator fleet
sunrey-ops validator operator
sunrey-ops validator enrollment
sunrey-ops validator health
sunrey-ops validator maintenance
sunrey-ops validator upgrade
sunrey-ops validator rotate-key
sunrey-ops validator backup
sunrey-ops validator incidents
sunrey-ops validator concentration
```

High-impact actions record operator, role, validator, release/policy,
request hash, approval, and result.

## Rehearsal

The isolated seven-validator rehearsal exercises rolling upgrade,
one-node maintenance, signer outage, sentry replacement, key-rotation
rehearsal, validator exit, and backup/restore.

See also:

- [operator-enrollment.md](./operator-enrollment.md)
- [fleet-management.md](./fleet-management.md)
- [validator-maintenance.md](./validator-maintenance.md)
- [validator-upgrades.md](./validator-upgrades.md)
- [../runbooks/validator-operator-incident.md](../runbooks/validator-operator-incident.md)
