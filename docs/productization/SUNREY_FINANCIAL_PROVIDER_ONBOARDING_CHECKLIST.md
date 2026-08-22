# SunRey financial provider onboarding checklist

Use this checklist when a real bank, payment rail, FX desk, or card
processor is selected. Completing a row is not production
authorization. `ENVIRONMENT` stays `simulation` and every `LIVE_*`
flag stays `false` until an independent go-live decision.

Canonical contracts: `packages/payments/src/production-adapters` and
`packages/cards/src/production-adapters`.

## Commercial agreement

- [ ] Executed commercial agreement with the provider
- [ ] Licensed activity matches the intended SunRey product
- [ ] Data-processing / residency terms reviewed
- [ ] Liability, SLA, and audit-rights terms reviewed
- [ ] Counsel has not been asked to mark `CONFIRMED_BY_COUNSEL` in this tree

## Technical credentials

- [ ] Credentials stored only as `SecretReference` (Chunk 149 plane)
- [ ] No plaintext API keys in domain configuration or repository
- [ ] Separate sandbox and production credential descriptors
- [ ] Rotation and revocation path tested in sandbox
- [ ] Missing credential reference fails closed

## Sandbox

- [ ] Adapter implements the canonical contract (not a vendor domain rewrite)
- [ ] Sandbox environment isolated from production invocation
- [ ] Vendor payloads mapped only inside the adapter
- [ ] Sandbox bank / FX / card cannot be invoked as production

## Webhooks

- [ ] Signature, timestamp window, and nonce/replay protection configured
- [ ] Normalized events: `bank.*`, `payment.*`, `fx.*`, `card.*`
- [ ] Duplicate callbacks acknowledged without reprocessing
- [ ] Missing verification prevents callback processing
- [ ] Card webhooks carry no PAN/CVV

## IP allowlists / mTLS

- [ ] Provider IP allowlist documented if required
- [ ] mTLS certificate references stored as secrets, not files in git
- [ ] Mutual TLS is not treated as Execution Authority

## Certification

- [ ] BANK suite passed (if bank/BaaS)
- [ ] PAYMENT suite passed (if rail / remittance)
- [ ] FX suite passed (if liquidity)
- [ ] CARD suite passed (if issuer/processor)
- [ ] Unknown vendor statuses map to `UNKNOWN` / `REQUIRES_RECONCILIATION`
- [ ] Suite pass is recorded as engineering evidence, not production approval

## Reconciliation

- [ ] Balances, transactions, settlements, statements, and fees fetchable
- [ ] Phase C treasury/reconciliation consumes the adapter snapshot
- [ ] Provider balance is not customer Ledger authority
- [ ] Breaks persist; Ledger is never adjusted to force a pass

## Security review

- [ ] PCI scope minimized (cards): provider-hosted / token / iframe / network token
- [ ] No simulated PAN/CVV persisted or logged
- [ ] Adapter cannot post journals or issue Execution Authority
- [ ] Secret scan clean
- [ ] Architectural linter / rail-boundary guards clean

## Preproduction

- [ ] Certification passed
- [ ] Credentials and webhook verification bound
- [ ] Crash/retry: UNKNOWN submission queries before resubmit
- [ ] Consumer API remains provider-neutral

## Operational contacts

- [ ] Provider support contact and escalation path
- [ ] SunRey on-call owner for the adapter
- [ ] Corridor / product owner identified

## Incident process

- [ ] Incident severity and comms path agreed
- [ ] Provider outage does not auto-credit or auto-settle
- [ ] Reconciliation break escalation path agreed

## Limited-live

- [ ] Independent limited-live authorization exists
- [ ] Caps, corridors, and products listed explicitly
- [ ] Rollback / abort path rehearsed
- [ ] This repository still has `PRODUCTION_ACTIVE=false` until that authorization

## Production approval

- [ ] Preproduction evidence complete
- [ ] Regulatory / licensing evidence complete (outside this repository)
- [ ] Card-network / Apple / Google certifications complete where applicable
- [ ] Explicit production approval recorded outside this prompt
- [ ] Do not flip `LIVE_*`, `ENVIRONMENT`, `PRODUCTION_READY`, or `PRODUCTION_ACTIVE` here
