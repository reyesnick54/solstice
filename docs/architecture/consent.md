# Consent Ledger and Purpose Firewall

Canonical owner: `packages/consent`.

Consent is an append-only authorization-history ledger. It is not the
canonical financial ledger and does not issue Execution Authority.

The Purpose Firewall defaults to DENY. A valid consent for one purpose
version does not authorize another. Internal service identity is not
sufficient by itself.

Chunk 100 binds Human Information consent grants to this ledger. Consent
is not ownership transfer. See
[`../information/consent-and-purpose.md`](../information/consent-and-purpose.md).

Short-lived DataUsePermits are HMAC-signed through the canonical
`KeyProvider` purpose `DATA_USE_PERMIT_SIGNING`. Revocation blocks new
permits immediately. Historical access audit is retained.

Personal Data Vault keeps `VaultAccessBroker` and
`DataUseAuthorizationPort`. This package implements that port.

Data-contribution consent does not execute external sharing. Clean Room
remains unimplemented.

This is not GDPR, CCPA, or PDPL legal approval.

## Productization (Phase H Prompt 2)

`ConsentDataRightsEngine` at `packages/consent/src/product/engine.ts`
is the customer control plane: purpose catalog, granular grants,
receipts, revocation workflow, `mayAccessData`, Agent mandate + consent
dual gate, licensee scopes, data-rights requests, HIN participation,
and access audit without raw values.

It wraps this ledger. It is not a second consent system.
`OPTIONAL_COMPENSATED` purposes are never defaulted on.
Withdrawing optional HIN participation does not close financial
services.

## Concurrency

In-memory and PostgreSQL adapters serialize permit issuance and
revocation per `consentId` (`store.acquire` before evaluation;
SQL writes are transactional). Ordering:

1. A committed revocation is visible to the next `issuePermit`.
2. A permit issued before the revocation commit remains in the
   historical audit and is rejected on later `verifyPermit` when
   the bound consent is REVOKED.
3. Duplicate confirm/revoke requests with the same idempotency key
   do not create a second active grant or a second revocation row.

There is no window in which a later caller can issue a new permit
after revocation has been committed.
