# Phase B Prompt 5 — Events, jobs, workflows, and webhooks

This is a productization record for asynchronous financial middleware.
It is not production authorization, legal advice, or a claim that
external gates are satisfied.

No production activation occurred.

- `ENVIRONMENT=simulation`
- `PRODUCTION_READY=false`
- `PRODUCTION_ACTIVE=false`
- `LIVE_CONNECTIVITY_ENABLED=false`
- Every `LIVE_*` flag remains `false`

Prompt 5 does not start Prompt 6.

---

## 1. Canonical owner

SunRey already had a durable event plane. This prompt **extends** it.
It does not add `packages/events-v2`, `packages/event-bus`,
`packages/jobs`, `packages/workflow`, or `packages/webhooks`.

| Concern | Path |
| --- | --- |
| Event types and log | `packages/events/src/events.ts` |
| Canonical envelope | `packages/events/src/envelope.ts` |
| Versioning / compatibility | `packages/events/src/schema.ts` |
| Outbox / inbox / dead letter | `packages/events/src/dispatcher.ts`, `consumer.ts`, `delivery.ts` |
| PostgreSQL event fabric | `packages/persistence/src/ledger/event-fabric.ts` |
| Job queue | `packages/events/src/jobs.ts` |
| Workflow runtime | `packages/events/src/workflow.ts` |
| Retry classification | `packages/events/src/retry.ts` |
| Dead-letter ops (internal) | `packages/events/src/dead-letter-ops.ts` |
| Inbound / outbound webhooks | `packages/events/src/webhooks.ts` |
| Correlation / trace | `packages/events/src/trace.ts` |
| Durable adapters | `packages/persistence/src/ledger/async-fabric.ts` |
| Migration | `db/ledger/migrations/V007__async_fabric.sql` |

Existing specialized adapters stay where they are:

- Developer webhook signing helper: `packages/sunrey-sdk/src/developer-platform/webhooks.ts`
- Provider-neutral HMAC guard: `packages/security/src/regulated/webhook.ts`
- Rail callback ingest: `packages/payments/src/rail-webhook.ts`
- Chunk 155 operation execution: `packages/events/src/operation/`

Those are not a second event bus. Provider adapters later supply the
real verification scheme to `ProviderWebhookVerifier`.

---

## 2. Event envelope

`DurableEventEnvelope` is the only durable envelope.

| Field | Role |
| --- | --- |
| `eventId` | Stable identity |
| `eventType` / `eventVersion` / `schemaVersion` | Versioned type |
| `occurredAt` | UTC instant |
| `producer` | Service or package that sealed the event |
| `actor` | Optional `{ type, id }` who caused it |
| `subject` | Optional `{ type, id }` the event is about |
| `environment` | Always `simulation` |
| `requestId` | Inbound API / webhook request |
| `correlationId` / `causationId` | End-to-end trace |
| `aggregateType` / `aggregateId` / `aggregateSequence` | Ordering |
| `intentId` / `evidenceId` / `jurisdiction` / `cellId` | Existing authority links |
| `schemaRef` | Stored historical prefix (`solstice.…/1`) |
| `payload` / `metadata` | Sensitive keys rejected |

Historical envelopes without the new fields parse with
`producer=sunrey.events`, `environment=simulation`, and null actor /
requestId.

Sensitive payload keys (`password`, `iban`, `pan`, `rawProvider`, …)
still fail closed.

---

## 3. Versioning

`EVENT_COMPATIBILITY_POLICY`:

- New optional field: same version. Consumers ignore unknown keys.
- Breaking payload semantic change: new `eventVersion`. Register it.
- Deprecated versions stay readable.
- Unsupported versions fail closed. No business effect.

Silent semantic change of a published type is forbidden.

---

## 4. Transactional outbox

Already implemented for ledger-domain mutations:

`insertSealedDomainEvent` writes `ledger.domain_event` and
`ledger.outbox` on the same client. `persistOperationWithOutbox`
commits operation state + events together.

`OutboxDispatcher` is at-least-once. A crashed worker does not lose a
committed row. Duplicate publish is expected; consumers must be
idempotent.

A `payment.completed` (or `PaymentSettled`) event cannot post a
journal. Event handlers call `refuseDirectFinancialMutation` /
Kernel `submitIntent` only.

---

## 5. Idempotent consumers

`InboxProcessor` + `withIdempotentHandler` record
`(consumerId, eventId)` in the inbox. A completed row returns
`duplicate` and does not re-run the handler.

Redelivery is normal. Exactly-once delivery is not claimed
(`EXACTLY_ONCE_CLAIMED=false` in the operation fabric).

---

## 6. Job queue

`PersistentJobQueue` + `JobStore`:

- enqueue / scheduled `runAt`
- retry with bounded exponential backoff
- timeout (`JobTimeoutError`)
- attempt count / max attempts
- dead-letter state
- cancel
- internal replay

`InMemoryJobStore.snapshot/restore` and `PostgresJobStore` survive
process restart.

Privileged types are refused:

`ISSUE_EXECUTION_AUTHORITY`, `POST_JOURNAL`, `OPEN_ACCOUNT`,
`AGENT_PRIVILEGED_MUTATION`

`JOB_CAN_ISSUE_EXECUTION_AUTHORITY=false`
`JOB_CAN_POST_JOURNAL=false`

AI cannot enqueue a job that issues Execution Authority.

---

## 7. Workflows

`WorkflowRuntime` is a small persisted state machine, not a BPM
product.

States: `PENDING`, `RUNNING`, `WAITING_HUMAN`, `WAITING_COMPLIANCE`,
`WAITING_PROVIDER`, `COMPENSATING`, `COMPLETED`, `FAILED`, `CANCELLED`.

Each record keeps `workflowId`, type, state, current step, history,
retry/attempt count, timeout, and correlation ids.

Step kinds: `TASK`, `WAIT_HUMAN`, `WAIT_COMPLIANCE`, `WAIT_PROVIDER`,
`COMPENSATE`.

`resume` after a wait or process restart continues from the stored
step. Compensation is a hook, not a journal edit.

Later flows (international transfer, KYC, Agent approval, investment
execution, Exchange withdrawal) register a definition here. They still
go through Kernel + Execution Authority for money movement.

---

## 8. Retry classification

`RETRYABLE` | `NON_RETRYABLE` | `REQUIRES_HUMAN` |
`REQUIRES_PROVIDER` | `REQUIRES_COMPLIANCE`

`INFINITE_RETRY_FORBIDDEN=true`

Rejected financial work (`REJECTED_FINAL`, `INVALID_SIGNATURE`,
`KERNEL_BLOCK`, unsupported version, privileged-job refusal) goes to
dead letter. It is never retried forever.

---

## 9. Dead letters

Failed events, jobs, and outbound webhook deliveries are visible
through `DeadLetterOps`:

- failure / attempts / error class
- last attempt
- correlationId / requestId
- safe reason only

`list` / `inspect` / `replay` require `InternalOperator`
(`role: INTERNAL_OPS`). `refusePublicReplay()` is the public path.

Replay is not exposed on any public HTTP route in this prompt.

---

## 10. Inbound provider webhooks

`InboundWebhookReceiver`:

1. Identify provider
2. Call that provider's `ProviderWebhookVerifier`
3. Reject invalid / stale / unknown
4. Persist receipt (raw **hash**, not raw body)
5. Deduplicate `(providerId, providerEventId)`
6. Acknowledge HTTP 202
7. Process asynchronously (caller enqueues a job)

No fake provider signature is implemented. A later rail / KYC / custody
adapter supplies `verify`.

---

## 11. Outbound SunRey webhooks

`OutboundWebhookService` productizes durable developer/client
deliveries:

- subscription + `secretRef` (not the secret value)
- HMAC `sunrey-webhook-v1` (same scheme as the SDK helper)
- delivery attempts, retry, backoff, logs
- event filter
- disable after `failureThreshold`

Every mutating call requires `authorizeOperator`. This is not a public
unauthenticated API.

The SDK `WebhookDispatcher` remains the in-process developer-platform
helper. Durable product state lives here.

---

## 12. Event families

Implemented namespaces already cover identity, security, account,
payment, fx, card, growth, exchange, custody, chain, compliance.

This prompt registered **only** infrastructure events the new modules
actually emit:

| Type | Namespace |
| --- | --- |
| `WorkflowStarted` / `Completed` / `Failed` | `workflow` |
| `JobEnqueued` / `JobDeadLettered` | `job` |
| `ProviderWebhookAccepted` / `Rejected` | `provider` |
| `OutboundWebhookDelivered` / `Failed` | `webhook` |

Reserved (not invented): `agent`, `pyr`, `notification`, `analytics`.

Convention: `FamilyThingHappened` PascalCase type, stored schemaRef
`solstice.<namespace>.<snake>/1`, display brand SunRey.

---

## 13. Observability

`TraceContext` carries `requestId`, `correlationId`, `causationId`.
`propagateTrace` / `envelopeTraceHints` stamp jobs, workflows, and
webhooks.

A customer transaction is intended to be readable as:

`API request → policy → workflow → provider → Ledger → notification`

without secrets in the trace.

---

## 14. Persistence

Critical state is in the ledger **database** (event-fabric schema), not
in a second ledger:

| Table | Purpose |
| --- | --- |
| `ledger.async_job` | Persistent jobs |
| `ledger.async_workflow` | Persisted workflows |
| `ledger.inbound_webhook` | Provider receipts |
| `ledger.outbound_webhook_subscription` | Developer subscriptions |
| `ledger.outbound_webhook_delivery` | Signed delivery log |
| `ledger.domain_event` | Additive producer / actor / request columns |
| `ledger.dead_letter` | Additive error class / correlation columns |

`environment` is constrained to `simulation`. Job types that would
issue Execution Authority or post journals are rejected by constraint.

---

## 15. Authority boundary

- Events are not financial authority.
- Ledger remains the canonical journal.
- Provider callbacks must be verified and reconciled (Chunk 155
  operation fabric).
- AI cannot submit privileged jobs around Execution Authority.
- Production remains disabled.

---

## 16. Future provider integration

Later prompts may:

1. Bind a real rail / KYC / custody `ProviderWebhookVerifier`.
2. Enqueue `NOTIFY` / `PROVIDER_POLL` jobs from inbound receipts.
3. Drive KYC / transfer / withdrawal workflows from those jobs.
4. Mount authenticated internal ops routes on `DeadLetterOps`.
5. Wire SDK developer webhooks to `OutboundWebhookService`.

They must not create a parallel bus, flip `LIVE_*`, or let a webhook
post a journal.
