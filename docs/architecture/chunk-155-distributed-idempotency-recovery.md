# Chunk 155 — Distributed idempotency and external side-effect recovery

SunRey hardens the failure class:

> The external effect may have happened, but our process crashed before we
> recorded the answer.

This is not magical exactly-once delivery across banks, custodians, or
chains.

Canonical model:

- at-least-once event delivery
- stable idempotency keys
- durable `OperationExecutionRecord`
- provider query / reconciliation
- domain-specific deduplication

Name: `EFFECTIVELY_ONCE_BY_IDEMPOTENCY_AND_RECONCILIATION`.
`EXACTLY_ONCE_CLAIMED` remains `false`.

## Owners

| Concern | Owner |
| --- | --- |
| Domain-neutral port, digest, coordinator | `packages/events/src/operation` |
| PostgreSQL adapter + atomic outbox unit | `packages/persistence/src/operations` |
| Payment unknown submission | `packages/payments` |
| Custody unknown withdrawal | `packages/custody` |
| Exchange settlement restart | `packages/sunrey-exchange` |
| HIN chain-anchor idempotency | `packages/information-market/src/network/chain-anchor` |
| Oracle observation dedupe | `packages/sunrey-chain/src/oracle/production` |

Do not create `packages/saga-engine`, `packages/workflow-v2`,
`packages/idempotency-service`, `packages/transaction-manager`,
`packages/distributed-ledger`, or `packages/exactly-once`.

## Operation states

`PREPARED` → `DISPATCHING` → `SUBMITTED` | `SUBMISSION_UNKNOWN` →
`CONFIRMED` | `REJECTED_FINAL` | `RECONCILIATION_REQUIRED` |
`COMPENSATION_REQUIRED` → `COMPENSATED`.

`CONFIRMED` requires authoritative downstream evidence.

## External-call rule

1. Begin DB, record `PREPARED`, commit.
2. Call the injected provider.
3. Begin DB, record result or uncertainty, write the existing outbox,
   commit.

Never hold a database transaction open across a bank, custodian, oracle,
KYC, or Travel Rule provider call.

After `SUBMISSION_UNKNOWN`, query and reconcile. Blind retry is refused.

The reconciliation coordinator may discover, query, propose, and mark
reconciled. It may not post ledger corrections, mint, issue Execution
Authority, change a beneficiary, or create custody approval.

## Demo

`demo:sunrey-idempotent-recovery-fabric`

## Capability

`sunrey-distributed-idempotency-recovery`
