# ACCESS Incident Runbook

Operator guide for Access production incidents. Access runs in simulation; this runbook applies to staging rehearsal and future production activation.

## Incident categories

| Category | Examples | Primary runbook |
|----------|----------|-----------------|
| Reconciliation drift | Booking/payment mismatch | [ACCESS_RECONCILIATION_RUNBOOK.md](./ACCESS_RECONCILIATION_RUNBOOK.md) |
| Provider outage | Search/quote/booking unavailable | This document §Provider outage |
| Payment rail outage | Card issuer unavailable | This document §Payment outage |
| Funding exhaustion | Pool at zero | This document §Funding exhaustion |
| Treasury pause | `NEW_REDEMPTIONS_PAUSED` active | This document §Treasury pause |
| Security | Webhook forgery, SSRF attempt | [ACCESS_SECURITY_HARDENING.md](./ACCESS_SECURITY_HARDENING.md) |
| Double-spend suspicion | Duplicate booking/capture | Reconciliation + this document §Double-spend |

## Severity levels

| Level | Criteria | Response time |
|-------|----------|---------------|
| SEV-1 | Active treasury exposure or duplicate capture confirmed | Immediate |
| SEV-2 | Reconciliation backlog growing; provider-wide outage | &lt; 1 hour |
| SEV-3 | Single-provider degradation; elevated failure rate | &lt; 4 hours |
| SEV-4 | Informational; no user impact | Next business day |

## Alerting conditions

Configure alerts (avoid alert storming — use sustained thresholds):

| Alert | Condition | Action |
|-------|-----------|--------|
| Settlement failure rate elevated | &gt; 5% over 15 min | Check payment rail health |
| Booking failure rate elevated | &gt; 10% over 15 min | Check provider health |
| Reconciliation backlog | &gt; 50 open issues or age p95 &gt; 1h | Start reconciliation sweep |
| Funding near exhaustion | Available &lt; 10% of pool | Treasury review |
| Duplicate payment detected | Any DUPLICATE_PAYMENT issue | SEV-1 investigation |
| Provider quarantine | Risk monitor quarantine event | Notify provider ops |
| Refund backlog | &gt; 20 pending refunds over 1h | Check provider refund API |
| Financial ledger mismatch | Invariant check failure | SEV-1 — halt new redemptions |

## Observability dashboard

Operators should monitor:

- Access transaction state counts by status
- `reconciliation_required` count
- Booking success/failure rate
- Settlement success/failure rate
- Funding utilization (bps)
- Entitlement utilization (bps)
- Provider health scores
- Payment rail health
- Refund backlog depth
- Reconciliation backlog age

**Do not** use PII (user email, name) as metric labels.

Harness helpers: `packages/access-economy/src/chaos/metrics.ts`

## Provider outage

### During search / quote

- Return `PROVIDER_UNAVAILABLE` to client
- Entitlements and history remain visible
- No funding or entitlement mutation

### During reservation / booking

- In-flight transactions: use reconciliation status poll
- Do not blind-retry booking without idempotency key
- Compensate reservations if booking cannot be confirmed

### During cancellation / reconciliation

- Queue cancel/reconcile for retry when provider recovers
- Historical bookings remain visible offline

### All commercial providers down

- Platform remains available
- Entitlements and allocations intact
- New fulfillment shows temporarily unavailable
- Not a platform-wide outage

**Validated in:** chaos tests `17`, `19`

## Payment issuer outage

- If strategy requires payment before booking: do not book
- If booking already exists: activate cancel/reconcile strategy
- No unfunded settlement promise

**Validated in:** chaos test `18`

## Funding exhaustion

- Entitlements remain visible and valid
- New funded checkout unavailable (`canReserveFunding` false)
- No fake Access coverage
- Funding available never negative

**Validated in:** chaos test `20`

## Treasury pause

Activate `NEW_REDEMPTIONS_PAUSED` via funding pool suspend:

- New funded checkout blocked
- Existing bookings, refunds, reconciliation, history continue

**Validated in:** chaos test `21`

## Provider quarantine

When `ProviderRiskMonitor` quarantines a provider:

- Stop new bookings for that provider
- In-flight transactions: allow status, cancel, reconcile paths
- Do not abandon users mid-transaction

**Validated in:** chaos test `22`

## Double-spend response

If duplicate booking or capture suspected:

1. **Immediately** pause new redemptions for affected pool/provider if exposure unclear
2. Identify all transactions sharing provider reference
3. Run invariant suite
4. Void/refund duplicate capture if confirmed
5. Cancel orphan booking if confirmed
6. Create reconciliation issue with CRITICAL severity
7. Do not restore entitlement until refund policy confirms

## Refund incidents

| Situation | Expected behavior |
|-----------|-------------------|
| Full refund | Access funding + user portion restored per policy |
| Partial refund | Configured allocation policy applies |
| Duplicate refund | Second refund rejected; no double restoration |
| Non-refundable cancel | No automatic funding/entitlement restore |
| No-show | Ledger settled per terms; no auto-refund |

**Validated in:** chaos tests `27`–`32`

## Blockchain independence

Access provider or payment outages must **not** halt SunRey Chain consensus. Access is application-layer; chain regression tests run independently.

## Post-incident

1. Document root cause in reconciliation issue record
2. Update chaos test if new failure mode discovered
3. Verify invariant suite passes
4. Review whether alert thresholds need tuning

## Prompt 42 recommendation

Before production activation:

- Wire observability metrics to operator dashboard
- Connect alerting to on-call rotation
- Add BFF-level HTTP chaos tests for idempotency headers
- Full Compliance Kernel integration test in funded checkout path
- Periodic reconciliation sweep job in staging
