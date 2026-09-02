# SunRey Disaster Recovery Master Runbook

Operator master runbook for disaster recovery, resilience drills, and
controlled restoration. Engineering simulation until production activation.

**This runbook does not activate production, flip `LIVE_*` flags, or mint assets.**

## Scope

Covers recovery for:

- SunRey Chain (validators, RPC, snapshots, state sync)
- Application PostgreSQL (customer, ledger, evidence, security schemas)
- Evidence Vault (hash-chained audit trail)
- Exchange settlement state
- Custody and payment operational state
- Provider configuration and credentials (references only — never raw secrets)
- Identity, consent, and policy version bindings

## Prerequisites

- `ENVIRONMENT` confirmed as intended (simulation for drills)
- All `LIVE_*` flags verified `false` unless production activation ceremony complete
- Known network ID, chain ID, genesis fingerprint
- Access to `sunrey-ops` CLI
- Validator keys stored separately from chain-state backups
- Incident commander and communications channel established

## Quick reference

```bash
# Wave 9 qualification (smoke)
npm run qualify:wave9:fast

# Full Wave 9 qualification
npm run qualify:wave9

# Adversarial range smoke
npm run sunrey-range -- campaign --production-safety-smoke

# Chain snapshot
sunrey-ops snapshot create
sunrey-ops snapshot verify

# Database status and restore drill
sunrey-ops database status
sunrey-ops database restore-test

# End-to-end DR drill
sunrey-ops dr run END_TO_END_RESILIENCE
sunrey-ops dr report

# PostgreSQL qualification (real DB)
npm run db:up && npm run db:migrate && npm run qualify:backend-db
```

## Recovery authority boundaries

PostgreSQL operational state is **not** ledger authority and **not** native
supply authority. Recovery must never:

- Mint SunRey Coin or MoonRey Coin from a database restore
- Issue Execution Authority from a backup
- Replace or delete ledger postings
- Invent compensating journals to "fix" a restore

Corrections are new Kernel-gated compensating entries only.

## Rehydration order

After database restore, rehydrate in this order:

1. `DATABASE_SCHEMA` — verify migrations applied
2. `SECURITY_KEY_METADATA` — key references and rotation state
3. `PROVIDER_CONFIGURATION` — provider profiles and certification refs
4. `IDENTITY_COMPLIANCE` — identity and compliance metadata
5. `PAYMENT_CUSTODY_EXCHANGE` — operational payment/custody/exchange state
6. `EVENT_OUTBOX_INBOX` — drain or reconcile in-flight events
7. `RECONCILIATION_CHECKS` — resolve SUBMISSION_UNKNOWN, pending settlements
8. `APPLICATION_READY` — health checks pass

Unresolved operations require human review — do not auto-retry financial writes.

## Scenario A — API / application tier restart

1. Drain load balancer traffic (if applicable).
2. Graceful shutdown of API workers.
3. Verify no in-flight Execution Authorities remain unexpired.
4. Restart workers.
5. Confirm `/health` returns 200.
6. Spot-check authenticated read paths.
7. Resume traffic.

**Chaos script:** `node --experimental-strip-types scripts/chaos/restart-sandbox.mjs`

## Scenario B — Database outage (single schema)

| Schema | Immediate action | Financial writes |
| --- | --- | --- |
| Customer | Fail closed on account mutations | Blocked |
| Ledger | Fail closed on all postings | Blocked |
| Evidence | Block proof-dependent issuance | Blocked where required |
| Security | Block key operations | Blocked |

1. Confirm outage scope (single schema vs entire cluster).
2. Fail over to synchronous replica if available.
3. If no replica: degrade reads per policy; block all sensitive writes.
4. Never post compensating journals during outage.
5. After recovery: run reconciliation, drain outbox.

**Qualification:** `npm run qualify:backend-db`

## Scenario C — Blockchain node failure

See `docs/runbooks/SUNREY_BLOCKCHAIN_RECOVERY_RUNBOOK.md`.

| Sub-scenario | Procedure |
| --- | --- |
| Query node down | Failover RPC; APIs return degraded, not invented state |
| Validator down | Scenario B in blockchain runbook; quorum permitting |
| State corruption | Stop node; verify storage; restore verified snapshot |
| New node join | Genesis sync or trusted snapshot + tail |

**Chaos script:** `node --experimental-strip-types scripts/chaos/blockchain-recovery.mjs`

## Scenario D — Provider / oracle outage

1. Circuit breakers trip per provider family.
2. Affected economic domains degrade or pause.
3. Unrelated blockchain transfers continue.
4. Compliance outage → DEGRADED, never silent ALLOW.
5. Do not fabricate canonical oracle values.

**Chaos script:** `node --experimental-strip-types scripts/chaos/provider-failure.mjs`

## Scenario E — Exchange settlement failure

1. Identify DVP phase from durable settlement state.
2. Do not retry settlement without idempotency key verification.
3. Duplicate settlement callbacks must be noop.
4. Reconcile exchange DB with ledger and chain custody.
5. No AssetSupplyBook mutation from exchange recovery.

**Verification:** `tests/phase-g-recovery.test.ts`, Wave 9 exchange-failure suite.

## Scenario F — Event bus backlog

1. Monitor outbox pending count and consumer lag.
2. Scale consumers horizontally if safe.
3. Dead-letter poison messages after retry exhaustion.
4. Replay only via internal dead-letter ops — no public replay endpoint.
5. Verify idempotency on replay.

## Scenario G — Full stack restart

1. Create snapshots and backups (chain, DB, config).
2. Stop all writers gracefully.
3. Restore from last known good backups.
4. Rehydrate per order above.
5. Drain outbox/inbox.
6. Reconcile unresolved operations.
7. Verify chain height, supply, wallet projections, consumed claims.
8. Confirm identity links, consent, and policy versions.

**Qualification:** `npm run qualify:wave9 -- --suite full-stack-restart`

## Scenario H — Backup and restore

### What to backup

| Asset | Method | Secret handling |
| --- | --- | --- |
| Chain state | Verified snapshot manifest | No validator keys in snapshot |
| PostgreSQL | PITR / logical dump per schema | No raw credentials in dump |
| Evidence Vault | Hash-chained export | Integrity verified on restore |
| Configuration | Version-controlled artifacts | Secret references only |
| Signer keys | HSM/KMS encrypted backup | Separate from chain/DB |

### Restore verification

1. Verify snapshot manifest (genesis fingerprint, state root).
2. Verify supply invariants if supply state bundled.
3. Scan restore artifacts for forbidden secrets.
4. Run `sunrey-ops database restore-test`.
5. Reconcile ledger, custody, exchange without invented journals.

**Do not expose private keys in ordinary restore artifacts.**

## Scenario I — Regional / host failure

Real multi-region infrastructure may not be provisioned in development.
Production requirements (not guaranteed values):

| Requirement | Description |
| --- | --- |
| Redundancy | Multi-AZ within region; N+1 application tier |
| Replication | Sync replica in-region; async cross-region standby |
| Failover | RPC auto-failover; DB manual ceremony cross-region |
| Backup location | Separate failure domain from primary |
| RPO | Measured per drill — not fabricated |
| RTO | Measured per drill — not fabricated |

## Scenario J — Policy / authorization outage

1. Sensitive writes fail closed (503/403).
2. Safe reads may degrade per documented policy.
3. Kernel decisions unchanged — do not catch refusals and proceed.
4. Seal all outcomes in Evidence Vault.

## Incident end criteria

Recovery is complete when:

- All health checks pass
- Chain height and state root match pre-incident (or documented expected state)
- Supply invariants hold
- No unresolved SUBMISSION_UNKNOWN without human review
- Outbox lag below threshold
- `npm run qualify:wave9:fast` passes
- `sunrey-range campaign --production-safety-smoke` passes

Incident end does **not** auto-resume paused capabilities (Chunk 167).

## Escalation

| Severity | Escalation |
| --- | --- |
| Ledger invariant breach | Immediate — economic emergency runbook |
| Supply inconsistency | Immediate — chain ops + governance |
| Evidence Vault corruption | Compliance + security |
| Key compromise | Key rotation ceremony runbook |
| Provider-wide outage | SRE provider outage runbook |

## Related runbooks

- `docs/runbooks/SUNREY_BLOCKCHAIN_RECOVERY_RUNBOOK.md`
- `docs/runbooks/database-pitr.md`
- `docs/runbooks/sre/database-outage.md`
- `docs/runbooks/sre/exchange-incident.md`
- `docs/runbooks/sre/provider-outage.md`
- `docs/operations/disaster-recovery.md`
- `docs/operations/production-backup-recovery.md`
- `docs/security/WAVE9_RELIABILITY_AND_CHAOS_REPORT.md`

## Chaos automation index

All scripts refuse execution when `ENVIRONMENT !== 'simulation'`.

```
scripts/chaos/restart-sandbox.mjs
scripts/chaos/network-delay.mjs
scripts/chaos/service-unavailable.mjs
scripts/chaos/provider-failure.mjs
scripts/chaos/database-restart.mjs
scripts/chaos/blockchain-recovery.mjs
```
