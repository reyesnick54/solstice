# Chunk 106 — Canonical Human Economic Contribution Registry

This chunk makes `packages/human-economic-contribution` the **system of
record for verified human economic contribution records**.

It does not calculate contribution value, mint SunRey Coin, issue
Execution Authority, or replace the ledger, Personal Economic Graph,
Human Information Network, PEVE, Exchange, wallet, or monetary mint.

Canonical owner: `packages/human-economic-contribution`.

Capability `sunrey-human-economic-contributions` remains the singular
owner. Chunk 104 defined the ontology. This chunk extends the same
registry. Do not create `packages/human-contribution-registry` or
another contribution package.

## Purpose

`HumanContributionRegistry` (also exported as
`HumanEconomicContributionRegistry`) owns canonical contribution
records and their lifecycle:

- `submit`
- `verify`
- `reject`
- `supersede`
- `correct`
- `query`
- `snapshot` / `restore`
- `rebuildProjections` / `clearProjections`

Interfaces are deterministic. Other domains use
`HumanContributionRegistryPort` to submit normalized evidence
references and read `VerifiedContributionReference` values without
importing the in-memory store.

## Canonical record

A registered record includes:

- `registryRecordId`
- `contributionId`
- `fingerprint`
- `subjectRef`
- `contributionClass`
- `verifiedMeasurement`
- `measurementUnit`
- `measurementPeriod`
- `jurisdiction`
- `sourceClass`
- `evidenceDigest`
- `evidenceReferences[]`
- `rightsReferences[]`
- `consentReferences[]`
- `purposeReferences[]`
- `provenanceReferences[]`
- `verificationPolicyVersion`
- `verificationTimestamp`
- `status`
- `createdAt`
- supersession / correction lineage (`supersedes`, `supersededBy`,
  `corrects`, `correctedBy`)

No raw personal data, secrets, private keys, or clean-room source rows.

`verifiedMeasurement` is the non-monetary unit count frozen at
verification. It is not a SunRey quantity and not a valuation.

## Lifecycle

Explicit states:

- `SUBMITTED` (and ontology states `OBSERVED` / `VERIFICATION_REQUIRED`)
- `VERIFIED`
- `REJECTED`
- `SUPERSEDED`
- `CORRECTED`

Economic history is not deleted. Corrections are new canonical records
that explicitly reference the prior record. Historical facts are not
edited in place.

## Duplicate control

Active contribution fingerprints are unique. The fingerprint is derived
from the underlying economic event (subject, class, event reference,
period, measurement, jurisdiction, source). The same event cannot be
registered twice. A legitimate correction must reference what it
supersedes, which releases the prior fingerprint.

Submit and verify of the same `contributionId` are idempotent.

## Projections

Query indexes (subject, class, period, jurisdiction, status, source,
fingerprint, evidence) are rebuildable from canonical records.
`clearProjections()` does not delete authoritative history.

Persistence uses `HumanContributionRegistryStore`. CI uses
`InMemoryHumanContributionRegistryStore`. No live database is required
for unit tests.

## Audit

`audit()` reports submitted, verified, rejected, superseded, and
corrected counts; counts by class and jurisdiction; duplicate attempts;
correction count; and verification policy versions in use.

It does not report monetary valuation totals or SunRey totals.

## What this chunk does not do

- Value contributions or implement a valuation engine
- Mint or hold a SunRey quantity
- Issue Execution Authority or mint authority
- Become a second ledger, PEG, HIN, PEVE, Exchange, or wallet
- Store raw personal data
- Enable production

## Commands

```
npm run demo:sunrey-human-contribution-registry
```
