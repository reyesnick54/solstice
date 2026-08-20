# Chunk 156 — SunRey unified control room

The production-candidate control room is a **read/operations plane**.
It extends the existing owner at `packages/sunrey-chain/src/ops`.

Do not create `packages/observability` or `packages/control-room`.

## What it can do

- Observe normalized, low-cardinality snapshots
- Evaluate engineering SLOs and error budgets
- Emit in-process alert objects
- Open incident metadata and ordered timelines
- Seal safe incident evidence
- Recommend runbooks without executing them

## What it cannot do

- Post a ledger journal
- Mint SunRey or MoonRey
- Issue or renew Execution Authority
- Sign a custody transaction
- Modify provider credentials
- Clear a sanctions result
- Change tokenomics
- Enable `LIVE_*` flags
- Activate production economics

```
CONTROL_ROOM_CAN_POST_LEDGER=false
CONTROL_ROOM_CAN_MINT=false
CONTROL_ROOM_CAN_ISSUE_AUTHORITY=false
METRICS_CONTAIN_PII=false
LOGS_CONTAIN_CREDENTIALS=false
PROVIDER_HEALTH_EQUALS_LEGAL_APPROVAL=false
ENGINEERING_SLOS_ONLY=true
REAL_ALERT_PROVIDER_CONNECTED=false
PRODUCTION_ACTIVE=false
```

## Telemetry

New metric families reuse `MetricRegistry`, `TraceCollector`,
`StructuredLogSink`, `AlertEngine`, and the existing dashboard/SLO
catalogs.

Metric labels may use only aggregate dimensions: `domain`,
`providerClass`, `jurisdictionClass`, `asset`, `environment`,
`status`, `component`, `plane`.

Customer IDs, payment IDs, wallet addresses, emails, phones,
passports, beneficiaries, secret paths, API tokens, prompts, and full
error messages are forbidden as metric labels.

Logs and traces may carry safe correlation references (`requestId`,
`traceId`, `correlationId`, `intentId`, `evidenceId`, `eventId`,
`operationId`, provider submission reference, chain transaction
reference). Those IDs are not metric labels.

## Provider health

`TECHNICALLY_HEALTHY` is not legal approval, commercial approval, or
production authorization.

## Recovery

An incident does not resolve because a provider health endpoint turned
green. Recovery conditions must all be satisfied. Example for
`PAYMENT_SUBMISSION_UNKNOWN_SURGE`:

1. Provider technically healthy
2. `SUBMISSION_UNKNOWN` backlog drained
3. Reconciliation complete

## Runbooks

Incident kinds attach to existing operations documents. The control
room never auto-executes a destructive runbook.

| Kind | Reference |
| --- | --- |
| `PROVIDER_OUTAGE` | `docs/operations/alerts.md` |
| `DATABASE_FAILOVER` | `docs/operations/database-recovery.md` |
| `OUTBOX_BACKLOG` | this document |
| `CUSTODY_HSM_FAILURE` | `docs/operations/signer-failover.md` |
| `PAYMENT_SUBMISSION_UNKNOWN_SURGE` | this document |
| `ORACLE_QUORUM_LOSS` | `docs/operations/alerts.md` |
| `SUPPLY_RECONCILIATION_FAILURE` | this document |
| `CREDENTIAL_COMPROMISE` | this document |
| `CHAIN_FINALITY_DEGRADATION` | `docs/operations/failure-domain-loss.md` |

## Demo

```
npm run demo:sunrey-control-room
```
