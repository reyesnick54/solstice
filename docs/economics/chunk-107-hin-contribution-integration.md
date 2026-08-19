# Chunk 107 — Human Information Network to Human Economic Contribution Registry

This chunk joins the existing Human Information Network
(`packages/information-market/src/network`) to the canonical Human
Economic Contribution Registry.

It does **not** reimplement the Human Information Network, create
another consent system, create another clean room, or store raw
personal information in the contribution registry.

## Path

```
consented information use
  → usage evidence
  → normalized human contribution evidence
  → contribution verification
  → canonical registry record
```

This is **not**:

```
personal data → automatic SunRey mint
```

## Boundary

| System | Owns | Does not own |
| --- | --- | --- |
| HIN (Chunk 100) | Information rights, consent-scoped use, usage receipts, clean-room authorization | Canonical economic contribution records; monetary issuance |
| Human Contribution Registry (Chunks 104–106) | Canonical verified economic contribution records | Information consent, clean-room execution, PEVE scores |
| PEVE | Personal economic system measurement | Contribution registry; Execution Authority; human worth |
| Chunk 71 | Monetary issuance authority | HIN compensation settlement instructions |

HIN is the source adapter only for `INFORMATION_RIGHT_CONTRIBUTION`
and related consent-scoped information activity. Other contribution
classes from the Chunk 104 ontology (`CREATIVE_PRODUCTION`,
`RESEARCH_PARTICIPATION`, `PROFESSIONAL_EXPERTISE`,
`COMMUNITY_CONTRIBUTION`, and the remaining non-HIN classes) remain
available through their appropriate verified attestation paths. They
are not forced through HIN.

After Chunks 104–106 merge, bind the canonical
`packages/human-economic-contribution` registry with
`bindCanonicalHumanContributionRegistry`. The in-process binding is
only the HIN-side simulation of that same evidence contract.

## Adapter and dependency direction

Canonical owner: `packages/information-market` at
`packages/information-market/src/network/contribution`.

```
HIN  →  HumanContributionRegistryPort
```

The contribution core must not import the HIN engine. The in-process
registry used by tests and the demo is a simulation binding of the
Chunk 104–105 evidence contract, not a second registry package.

## What becomes a contribution

A contribution represents a **realized authorized information use**
(or another explicitly defined realized event).

- Merely owning a descriptor does not create a verified contribution.
- Merely granting consent does not create a SunRey issuance event.

Required HIN evidence includes the existing subject, descriptor,
right, consent grant, purpose grant, permission, usage receipt, and
— where the processing class is a clean-room computation — an
approved computation and completed privacy-safe result.

## Privacy-safe evidence

The registry stores references and hashes only:

- subject pseudonymous ref
- descriptor ID
- right ID
- consent hash/reference
- purpose hash/reference
- usage receipt ID/hash
- approved computation ID/hash
- approved computation result ID when present
- settlement reference when present
- evidence digest

It must not store legal name, email, phone, SSN, passport, raw KYC,
raw PDV data, raw health data, raw location rows, clean-room source
rows, or authentication secrets.

## Fail-closed invariants

The adapter refuses when:

- right missing
- consent missing
- purpose mismatched
- permission inactive
- usage did not occur
- right expired before use
- right revoked before use
- descriptor subject mismatch
- computation not approved
- output class forbidden
- evidence hash tampered

Later revocation blocks future use and does not rewrite a legitimate
historical contribution record.

## Compensation is not minting

`HumanInformationCompensationInstruction` remains:

- `mintRequested: false`
- `unrestrictedIssuance: false`

HIN compensation is a settlement instruction. It is not converted
into new SunRey issuance. Chunk 71 remains the monetary authority
boundary.

## Data-asset linkage

PEG `DATA_ASSET` already supports an optional `contributionId`. The
adapter records canonical contribution IDs on an authorized internal
projection. PEG and HIN are not a second contribution registry. Raw
content is not placed on chain.

## Safety

- `productionActivated` remains `false`
- No live data monetization
- No external network calls
- Unauthorized scraping remains forbidden
