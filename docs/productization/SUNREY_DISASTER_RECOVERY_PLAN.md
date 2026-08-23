# SunRey disaster recovery plan

Phase I Prompt 3. Extends Chunk 55 resilience drills and Chunk 67/154 persistence recovery.

This is not a multi-region failover claim and not production authorization.

`ENVIRONMENT=simulation`
`PRODUCTION_ACTIVE=false`
`MULTI_REGION_FAILOVER_IMPLEMENTED=false`
`MANAGED_CLOUD_PITR_CLAIMED=false`

Engineering RPO/RTO values are `ENGINEERING_TARGET` until human operations approval.

## What is implemented

| Failure | Rehearsed response | Claim |
| --- | --- | --- |
| Availability zone / failure domain | Chunk 55 domain isolation; BFT safety holds; RPC failover inside remaining domains | Simulated domains, not a cloud vendor AZ product |
| Database | Encrypted logical dump, isolated restore test, local WAL archive PITR | Restore has been tested in-process. Managed PITR is not claimed |
| Compute cluster | Supervision/restart primitives; API and worker restart chaos | Process restart, not a production Kubernetes contract |
| Provider | Domain-scoped kill switch + Kernel refuse/defer | Technical health ≠ legal approval |
| Custody | Withdrawal halt; read-only balances remain | Not a second ledger |
| Validator | Fencing, signer-safety restore, verified snapshots | Keys never reused; unverified snapshots refused |
| Region | Not implemented as automatic multi-region failover | Do not claim it |

## Recovery objectives (engineering targets)

| Component | RPO | RTO | Label |
| --- | --- | --- | --- |
| PostgreSQL application data | 120s | 600s | ENGINEERING_TARGET |
| Blockchain state | 60s | 300s | ENGINEERING_TARGET (existing ops also labels `ENGINEERING_TEST_TARGETS`) |
| Explorer index | 0 (rebuild) | 180s | ENGINEERING_TARGET |
| Signer safety | 0 | 120s | ENGINEERING_TARGET |

## Backup classes

Scheduled, encrypted where required, retained, integrity-verified. Backup is not claimed working until restore is tested.

- Blockchain state
- Consensus WAL
- Signer safety (encrypted, fenced)
- Validator configuration (non-secret)
- Explorer index (prefer rebuild)
- PostgreSQL application data (encrypted)
- Custody metadata (encrypted; reconcile, do not invent)
- Encrypted configuration (no raw secrets)

Secrets restore through the secret system, not an ordinary archive.

## Object storage

Evidence, PDV objects, and backup objects: versioning, retention, `BACKUP_ENCRYPTION`, defined restore. PDV payloads stay out of operational telemetry.

## Chain recovery (Phase G)

Verified snapshots, validator recovery with fencing, RPC recovery, safe network restart/rejoin, genesis protection. Unverified snapshot providers are refused.

## Restore test

`packages/sunrey-chain/src/ops/sre/restore.ts` executes:

backup → isolated blank target → restore → integrity validation → application smoke → ledger invariant checks

It records `claimBackupWorks` only on `PASS`. No invented journals.

## What operators must not do

- Catch a Kernel refusal and proceed
- Invent balancing journals
- Enable `LIVE_*` or change `ENVIRONMENT`
- Claim multi-region failover
- Copy secrets into ordinary backups
- Treat logs as financial evidence
