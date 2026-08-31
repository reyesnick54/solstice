# ACCESS Security Hardening (Wave 5 / Prompt 41)

Security controls validated during Prompt 41 chaos testing. No new features were added unless required to fix a discovered defect.

## Server-side authority

All financial splits are computed server-side. Client-supplied values for coverage, user contribution, provider price, funding pool ID, and entitlement ID are ignored or rejected.

**Validated in:** chaos test `35 client tampering`

The canonical quote and domain state always win. The transaction orchestrator reads coverage from `AccessTransactionCoverageEngine` / stored checkout quote, never from request bodies.

## Resource ownership

Users cannot access, cancel, or refund another user's:

- booking
- transaction
- entitlement
- receipt

**Validated in:** chaos test `36 resource ownership`

BFF and orchestrator paths enforce `userId` matching on every mutating operation.

## Idempotency and replay protection

Checkout, confirm, payment, cancel, and refund commands accept idempotency keys. Replayed commands with the same key return the prior outcome without duplicate side effects.

**Validated in:** chaos tests `04`, `37 replay attack`

## Webhook security

The `AccessWebhookOrchestrator` rejects:

| Attack | Expected behavior |
|--------|-------------------|
| Invalid signature | Reject, no state change |
| Missing signature | Reject |
| Old timestamp | Reject |
| Replayed event ID | Idempotent no-op or reject |
| Unknown provider | Reject |
| Malformed payload | Reject |
| Oversized payload | Reject |

**Validated in:** chaos test `38 webhook security`

## SSRF / provider URL safety

Provider integrations use `ProviderTransport` destination parsing from `packages/provider-sdk/src/ssrf.ts`:

- Loopback hostnames blocked
- Private IPv4 ranges blocked
- Link-local and cloud metadata endpoints blocked

**Validated in:** chaos test `39 SSRF controls`

Frontend-supplied URLs must never reach provider transport without server-side allowlisting.

## Virtual card controls

Restricted Access virtual cards enforce:

| Control | Behavior |
|---------|----------|
| Deposit over-authorization | Deposit does not consume Access funding |
| Unrelated merchant | Decline, no ledger change |
| Amount above limit | Decline or controlled `REQUOTE_REQUIRED` |
| Single-use reuse | Decline after first capture |

**Validated in:** chaos tests `23`–`26`

Implementation: `packages/access-economy/src/settlement/card-controls.ts`

## Secret leak prevention

Static scan (`chaos/secret-scan.ts`) checks Access source trees for:

- Provider API keys
- Payment credentials (PAN, CVV)
- BaaS credentials
- Webhook signing secrets
- Private keys and seed phrases

**Validated in:** chaos test `40 secret scan`

No actual secrets belong in source, fixtures, logs, receipts, or test output.

## PII / privacy boundary

Provider booking payloads must contain only necessary travel/booking data. Forbidden fields include HIN, DNA, health data, bank balances, token holdings, and private communications.

**Validated in:** chaos test `41 privacy boundary`

Use `assertProviderPayloadMinimal()` and `scanPayloadForForbiddenPii()` from `chaos/privacy.ts`.

## Compliance Kernel gating

Settlement does not proceed when Compliance returns REVIEW, HOLD, or REJECT. External providers cannot override Kernel decisions.

**Validated in:** chaos test `42 compliance failure` (via `authorizeAccessMutate` proxy)

Production BFF paths submit `ActionIntent` to the Kernel before funded checkout proceeds.

## SR/MR isolation

Under every chaos scenario:

- SunRey Coin balance unchanged
- MoonRey Coin balance unchanged
- No token burn, transfer, or liquidation
- `TokenConversionContribution == 0`

**Validated in:** chaos test `43 SR/MR regression`

## Provider quarantine

`ProviderRiskMonitor` quarantine blocks new bookings while preserving safe status, cancel, and reconcile paths for in-flight transactions.

**Validated in:** chaos test `22 provider quarantine`

## Treasury pause

`NEW_REDEMPTIONS_PAUSED` blocks new funded checkout. Existing bookings, refunds, reconciliation, and history continue.

**Validated in:** chaos test `21 treasury pause`

Implemented via `suspendPool()` on the funding pool service.

## Remaining hardening items (non-critical)

- BFF-level chaos tests for HTTP idempotency headers (orchestrator layer covered)
- Full Compliance Kernel integration test in transaction orchestrator (currently BFF-gated)
- Alerting wiring for sustained failure rates (see incident runbook)
