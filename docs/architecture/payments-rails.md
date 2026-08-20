# Canonical bank rail adapter framework

This document describes the **simulation / sandbox** provider-connectivity
layer under the Chunk 9 payment orchestrator. It is not a claim of live
network membership, regulatory approval, or production access to ACH,
FedNow, RTP, SWIFT, SEPA, Saudi Central Bank infrastructure, or UAE
payment systems.

```text
Payment Orchestrator
        ↓
Route Selection
        ↓
Canonical RailAdapter
        ↓
Simulated Rail Adapter
        ↓
Provider acknowledgement
        ↓
Settlement updates
        ↓
Reconciliation
```

## Canonical rail interface

Every adapter implements `RailAdapter` in `packages/payments/src/rail-port.ts`:

- `validateRoute`
- `submitPayment`
- `queryPayment`
- `cancelPayment`
- `acknowledge` / `applyStatusUpdate` / `applyReturn`
- `retrieveSettlementReport`
- `health`

Requests and responses are strongly typed. Provider-specific payloads stay
inside the adapter. The payments domain consumes `CanonicalRailStatus` only.

## Adapter responsibilities

An adapter may:

- talk to a simulated provider
- normalize provider status strings
- honor a stable provider idempotency key
- report health and capability

An adapter must not:

- decide regulatory eligibility
- post ledger journals
- issue or fabricate Execution Authority
- store plaintext credentials
- invent a second payment state machine

## Orchestration vs adapter

`PaymentsService` remains the only financial mutator. It revalidates stale
compliance facts, selects a compliant route, builds a `RailSubmission`, and
hands the adapter an `AuthorizedRailCommand` that already carries an
authority **reference**. Journals are posted only through
`postPaymentJournal` after a verified Execution Authority.

## Rail types

Rail class and provider are separate:

| Rail class | Example simulated provider |
| --- | --- |
| `US_BATCH` | `SIMULATED_PROVIDER_US_BATCH` |
| `US_INSTANT` | `SIMULATED_PROVIDER_US_INSTANT` |
| `EU_SEPA` | `SIMULATED_PROVIDER_SEPA` |
| `INTERNATIONAL_CORRESPONDENT` | `SIMULATED_PROVIDER_GCC` / `SIMULATED_PROVIDER_CORRESPONDENT` |
| `SA_DOMESTIC` | `SIMULATED_PROVIDER_SA` |
| `AE_DOMESTIC` | `SIMULATED_PROVIDER_AE` |

Capabilities default **disabled** unless explicitly simulation-enabled.
`LIVE_*` flags stay false.

## Status normalization

Provider strings such as `ACK`, `NACK`, or `IN_FLIGHT` are mapped inside
the adapter to:

`ACCEPTED`, `REJECTED`, `PENDING`, `PROCESSING`, `SETTLED`, `RETURNED`,
`CANCELLED`, `UNKNOWN`, `SUBMISSION_UNKNOWN`.

Payment states remain the existing machine in `payment.ts`, extended only
with `SUBMISSION_UNKNOWN`.

## Retries

| Class | When |
| --- | --- |
| `SAFE_TO_RETRY` | queries, health checks |
| `SAFE_WITH_IDEMPOTENCY` | submit when no unknown execution |
| `DO_NOT_RETRY_WITHOUT_QUERY` | `SUBMISSION_UNKNOWN` |
| `PERMANENT_FAILURE` | reject / settle / return / cancel |

Generic HTTP retry must not be applied to payment submission.

## Unknown-submission handling

If a request was sent and acceptance is unknown, the payment enters
`SUBMISSION_UNKNOWN`. Funds stay reserved. A retry without `queryPayment`
is refused (`DO_NOT_RETRY_WITHOUT_QUERY`). Reconciliation or an
authenticated callback may resolve the state.

## Webhooks

`ProviderCallbackIngestor` requires:

- registered provider identity
- HMAC signature via `SecretReference`
- timestamp / replay window
- schema version
- provider event idempotency
- payload hash (never raw provider bodies in events or evidence)
- dead-letter on verification failure

An unverified callback cannot change payment state. Callbacks never post
journals directly.

## Settlement and returns

Simulated adapters emit deterministic settlement reports (gross/net,
integrity hash). Returns reference the original payment, use canonical
reason codes, and post **compensating** journals. Original settlement
journals are never edited.

Distinguish:

- `PRE_SUBMISSION_REJECTION` — no provider execution
- `PROVIDER_REJECTION` — submitted then rejected
- `POST_SETTLEMENT_RETURN` — settled then returned

## Reconciliation

`reconcileRail` compares Payment ↔ Rail Submission ↔ Provider Status ↔
Settlement Report ↔ Ledger journals.

Results: `MATCHED`, `PENDING`, `MISMATCH`, `MISSING_EXTERNAL`,
`MISSING_INTERNAL`, `DUPLICATE_EXTERNAL`, `INVESTIGATION_REQUIRED`.

A mismatch never auto-corrects the ledger.

## Security

Provider authentication ports support future API keys, OAuth, mTLS, signed
messages, and webhook signatures. Configuration stores `SecretReference`
only. Simulation adapters use mechanism `NONE`.

## Chunk 151 production candidates

Provider-neutral banking, rail, and FX **candidate** profiles live at
`packages/payments/src/production-candidate`. They inject
`FixturePaymentTransport` / `ScriptedSandboxTransport` only. Candidate
adapters implement this same `RailAdapter` contract. A provider
callback still cannot post a journal.

`PAYMENT_RAIL` and `FX_LIQUIDITY` were added to the existing
`packages/sunrey-chain/src/providers` acceptance taxonomy.
`BANKING_REFERENCE` remains the banking / BaaS relationship domain.

## Future live-provider checklist

Do **not** treat this chunk as permission to go live. A later authorized
chunk must still:

1. Keep `ENVIRONMENT=simulation` and every `LIVE_*` flag false until counsel
   and licensing exist.
2. Obtain documented network membership and corridor legal review.
3. Mark no policy rule `CONFIRMED_BY_COUNSEL` without counsel.
4. Resolve credentials only through `SecretProvider`.
5. Keep regulatory compatibility a hard filter, not a score.
6. Preserve Kernel → Execution Authority → PaymentsService → adapter order.
7. Never let an adapter post journals or issue authority.
