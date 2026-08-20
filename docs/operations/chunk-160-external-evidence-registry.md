# Chunk 160 — External production evidence registry

This chunk extends the existing mainnet readiness control plane at
`packages/sunrey-chain/src/mainnet`. It does **not** create a second
legal, license, audit, or evidence-vault package.

Capability `sunrey-external-production-evidence` is `IMPLEMENTED` under
the existing `packages/sunrey-chain` owner. The submodule lives at
`packages/sunrey-chain/src/mainnet/external-evidence`.

## What this is

A registry for **references** to external security reviews, counsel
opinions, licenses, regulatory approvals, provider agreements, HSM
attestations, and named human authorizations.

It can:

- register a document reference, secure-repository reference, or content digest
- verify that reference with an appropriate **human** role
- expire, revoke, or supersede it
- bind the verified reference into mainnet readiness, provider acceptance,
  and the Chunk 143 activation firewall

It cannot:

- fabricate an audit, license, or counsel opinion
- treat an engineering test as external evidence
- store confidential legal or audit documents in Git
- put raw contract or audit contents on-chain
- let AI, S3M, Grok, or automation verify
- activate production or flip `LIVE_*` flags

The Evidence Vault remains the sealing authority. Only safe metadata
and commitment hashes are sealed.

## Verification states

`NOT_PROVIDED`, `PROVIDED_UNVERIFIED`, `UNDER_REVIEW`,
`VERIFIED_ENGINEERING_FIXTURE`, `VERIFIED_EXTERNAL`, `REJECTED`,
`EXPIRED`, `REVOKED`, `SUPERSEDED`.

There is no `VERIFIED_FOR_PRODUCTION` state. A fixture may become
`VERIFIED_ENGINEERING_FIXTURE` only. Production eligibility requires a
current, unrevoked `VERIFIED_EXTERNAL` record whose scope matches the
query.

## Scope

Evidence is not globally reusable unless its scope is genuinely global
and empty of jurisdiction, activation-domain, and provider-domain
constraints. A `PAYMENT_RAIL` contract in one jurisdiction does not
authorize FX, custody, KYC, or another country.

Changing scope, jurisdiction, subject, digest, or expiration invalidates
the previous verification. History is preserved on revoke or supersede.

## Commands

```
npm run demo:sunrey-external-evidence-registry
```

## Expected current result

```
FIXTURE_COUNTS_AS_EXTERNAL=false
AI_CAN_VERIFY_EXTERNAL_EVIDENCE=false
VERIFIED_EVIDENCE_SCOPE_BOUND=true
EXPIRED_EVIDENCE_COUNTS=false
REVOKED_EVIDENCE_COUNTS=false
CONFIDENTIAL_DOCUMENT_ON_CHAIN=false
PRODUCTION_ACTIVE=false
```

A verified registry reference can update an external readiness
dimension. Expiry or revocation returns that dimension to blocked.
Production remains inactive.
