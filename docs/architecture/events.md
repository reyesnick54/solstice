# Durable event fabric

Domain events communicate **what happened**. They are not financial
execution. An event never bypasses `ActionIntent` → Compliance Kernel →
Execution Authority.

This document is the delivery contract for Chunk 3. Implementation
inventory is in [`docs/build-status.md`](../build-status.md).

## Event vs Evidence

| | Domain event | Evidence record |
| --- | --- | --- |
| Purpose | Tell other services that something happened | Immutable provenance of a decision or state transition |
| Owner | `packages/events` | `packages/evidence` |
| Durable home | `solstice_ledger.domain_event` + outbox | `solstice_evidence.evidence_record` |
| Identity | `eventId` (stable across replay) | `evidenceId` + hash-chain `seq` |
| May be retried / replayed | Yes, at-least-once | No. Append-only chain |
| Authoritative money | Never | Never |

Some operations produce both. Opening an account seals evidence and
emits `AccountOpened`. One is not a replacement for the other.

## Canonical envelope

Every durable event is a `VersionedEvent` sealed into a
`DurableEventEnvelope`:

- `eventId`, `eventType`, `eventVersion` / `schemaVersion`
- `occurredAt`
- `aggregateType`, `aggregateId`, `aggregateSequence`
- `correlationId`, `causationId`
- `intentId`, `evidenceId` when applicable
- `jurisdiction`, `cellId` when known
- `schemaRef` (for example `solstice.account.opened/1`)
- `payload`, `metadata`

Secrets, HMAC material, and raw KYC documents do not belong in payloads.

## Taxonomy

Implemented (functionality that exists today):

- `customer.status_changed` → `CustomerStatusChanged`
- `account.opened` → `AccountOpened`
- `ledger.deposit_posted` → `DepositPosted`
- `ledger.withdrawal_posted` → `WithdrawalPosted`
- `ledger.internal_transfer_posted` → `InternalTransferPosted`
- `kernel.decision_recorded` → `KernelDecisionRecorded`
- `security.key_created` → `KeyCreated`
- `security.key_rotated` → `KeyRotated`
- `security.key_retired` → `KeyRetired`
- `security.key_revoked` → `KeyRevoked`

Reserved (not implemented): `payment.*`, `fx.*`, `card.*`,
`investment.*`, `agent.*`, `consent.*`, `data.*`, `pyr.*`, `exchange.*`,
`regulatory.*`, `notification.*`, `analytics.*`.

`evidence.*` is reserved as a namespace so evidence records are not
mistaken for domain events.

## Delivery semantics

This fabric provides **at-least-once** transport. It does **not** claim
exactly-once distributed delivery.

Business effects become effectively-once through the consumer inbox
(`PRIMARY KEY (consumer_id, event_id)`). Inbox rows are delivery state
and do not require a `domain_event` foreign key — consumers may record
replayed or not-yet-catalogued ids. Outbox and dead-letter rows still
reference a committed envelope.

| Concern | Guarantee |
| --- | --- |
| Transaction boundary | Authorized ledger mutation and outbox insert commit in the **same** `solstice_ledger` transaction (`persistLedgerUnit`) |
| Outbox | Committed events are not lost if the dispatcher crashes. Restart claims `PENDING` / expired `IN_FLIGHT` rows with `FOR UPDATE SKIP LOCKED` |
| Retry | Exponential backoff, bounded attempts, then dead letter. Failed rows are not deleted |
| Dead letter | Inspectable. Human replay is explicit (`replayEvents` / `npm run events:replay`) |
| Replay | Same `eventId`. Inbox keeps consumers idempotent. No new ledger journal is created by replay itself |
| Ordering | Per-aggregate `aggregateSequence` only. No global total order |
| Schema | Unknown incompatible versions fail safely (`UnsupportedEventVersionError`) before the consumer effect |

Customer status lives in `solstice_customer`. The corresponding domain
event is written to the ledger outbox in a following ledger transaction
(separate databases, no FDW). Account, deposit, withdrawal, transfer,
and Kernel decision events share the ledger unit with journals.

## Correlation

Example trace, identifiers only:

```text
ActionIntent I-100
    → KernelDecisionRecorded (correlation=I-100, evidence=K-200)
    → AccountOpened A-300 (correlation=I-100, causation=K-200)
    → Evidence E-400 (intentId=I-100)
    → outbox V-500 (eventId of AccountOpened)
```

## Event handlers and money

```text
event → new ActionIntent → Kernel → Execution Authority → authorized mutation
```

Never:

```text
event → Ledger.postJournal
```

`EventHandlerPorts` exposes only `submitIntent`.

## Local commands

```bash
npm run db:up
npm run db:migrate
npm run events:outbox          # pending / in-flight / delivered rows
npm run events:inbox           # consumer idempotency state
npm run events:dead-letters    # inspectable failures
npm run events:dispatch        # one in-process dispatcher pass
npm run events:replay -- --event-id <id>
npm run test:events            # unit tests for the envelope
npm run test:persistence       # includes Chunk 3 PostgreSQL scenarios
npm run db:down
```

Transport is the in-process / simulated adapter. Kafka, Kinesis, Pub/Sub,
SNS/SQS, and cloud brokers are out of scope for this chunk.
