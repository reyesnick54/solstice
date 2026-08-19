# Chunk 128 — Economic Data Provider Certification, Conformance Sandbox, and Source Admission Gate

Canonical owner: `packages/sunrey-chain`.

Implementation: `packages/sunrey-chain/src/oracle/production/certification`.

This chunk extends the existing `sunrey-production-oracles` owner. It does
not create a second oracle registry, provider-registry package, or mint.

Certification means:

> This provider/source/feed satisfies specified admission controls.

It does **not** mean:

- a verified economic fact
- a productive contribution
- economic value
- a MoonRey quantity
- monetary authorization
- production ingestion
- an independent security audit
- a production SLA

`productionAuthorized` is always `false`. There is no `PRODUCTION_APPROVED`
state. Commercial, license, usage-right, and jurisdiction `CONFIRMED` are
never inferred from fixture strings.

## States

`NOT_EVALUATED`, `ENGINEERING_SANDBOX`, `CONFORMANCE_PASSED`,
`CONFORMANCE_FAILED`, `SECURITY_REVIEW_REQUIRED`,
`COMMERCIAL_EVIDENCE_REQUIRED`, `JURISDICTION_REVIEW_REQUIRED`,
`TESTNET_ADMISSIBLE`, `PRODUCTION_CANDIDATE`, `REVALIDATION_REQUIRED`,
`SUSPENDED`, `REVOKED`.

`TESTNET_ADMISSIBLE` requires technical and security engineering checks.
Policy may allow missing commercial production evidence for sandbox/testnet
fixtures.

`PRODUCTION_CANDIDATE` additionally requires the policy-required commercial,
license, usage-right, jurisdiction, and security-review evidence, plus unit
and taxonomy compatibility, quality threshold, and independence. That status
still does not activate production ingestion or MoonRey issuance.

## Conformance

The suite evaluates authentication, approved endpoint profile, response
bounds, content type, schema, identifiers, source timestamp, unit
normalization (Chunk 118/119), source/fact/claim taxonomy (Chunk 116/117),
provenance, security engineering controls, sandbox reliability, and
controller independence.

Generic `compute_s` must declare CPU/GPU resource context. Breaking schema
changes require a new source schema version and a new certification.
Historical certification records are immutable; a new run supersedes.

Runtime health evidence may trigger `REVALIDATION_REQUIRED` or recommend
`SUSPENDED`. AI cannot restore a provider. Restoration uses the existing
governed incident control.

## Economic Asset Registry

Where Chunk 115 is available, certification metadata and provenance
references may be projected into the Economic Asset Registry. Raw provider
responses are not stored.

## What this does not do

No real commercial provider is certified. No contracts, licenses, security
reviews, provider approvals, or legal opinions are fabricated.
