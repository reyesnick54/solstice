# Chunk 104 — Canonical SunRey Human Economic Contribution Ontology

This chunk defines **what a human economic contribution is**.

It does not calculate SunRey Coin quantities, invent a contribution
valuation formula, mint, issue Execution Authority, move money, or post
ledger journals.

Canonical owner: `packages/human-economic-contribution`.

Capability `sunrey-human-economic-contributions` is `IMPLEMENTED`.

## Purpose

A Human Economic Contribution is an attributable economic contribution
or participation event. Later chunks may attach policy, settlement, or
issuance decisions to these records. Those decisions are not implied by
the existence of a taxonomy value.

The record is reference-safe and privacy-bounded:

- `subjectRef` is a pseudonymous canonical reference
- evidence, consent, purpose, rights, usage receipts, PEG, ledger,
  payment, card, clean-room, and attestation links are IDs or hashes
- raw Personal Data Vault contents are never the canonical record
- raw clean-room rows are never the canonical record

## Taxonomy

Versioned taxonomy `sunrey-human-economic-contribution-taxonomy`
(`schemaVersion` 1, `taxonomyVersion` 1) includes:

- `INFORMATION_RIGHT_CONTRIBUTION`
- `VERIFIED_KNOWLEDGE_CONTRIBUTION`
- `CREATIVE_PRODUCTION`
- `RESEARCH_PARTICIPATION`
- `PROFESSIONAL_EXPERTISE`
- `ECONOMIC_PARTICIPATION`
- `COMMUNITY_CONTRIBUTION`
- `EDUCATION_SKILL_ATTESTATION`
- `MODEL_TRAINING_PARTICIPATION`
- `HUMAN_SERVICE_DELIVERY`
- `ENTREPRENEURIAL_ACTIVITY`
- `CREATOR_ROYALTY_EVENT`
- `OTHER_GOVERNED_HUMAN_CONTRIBUTION`

These are economic contribution categories. They are **not** measures of
a person's worth.

Adding a class does **not** make it:

- settlement eligible
- SunRey issuance eligible
- production enabled
- legally approved

Eligibility remains policy-controlled. Default class policy is
`settlementEligibleByDefault=false`, `issuanceEligibleByDefault=false`,
`productionEnabledByDefault=false`, `legallyApprovedByDefault=false`.

## Source classes

Provenance is explicit and is not silently upgraded:

- `HUMAN_INFORMATION_NETWORK`
- `PERSONAL_ECONOMIC_GRAPH_REFERENCE`
- `CANONICAL_LEDGER_EVENT_REFERENCE`
- `PAYMENT_EVENT_REFERENCE`
- `CARD_EVENT_REFERENCE`
- `VERIFIED_INSTITUTIONAL_ATTESTATION`
- `VERIFIED_COMMUNITY_ATTESTATION`
- `VERIFIED_PROFESSIONAL_ATTESTATION`
- `VERIFIED_RESEARCH_ATTESTATION`
- `USER_DECLARED`
- `DERIVED`
- `MODEL_INFERENCE`
- `OTHER_GOVERNED_SOURCE`

`USER_DECLARED`, `DERIVED`, and `MODEL_INFERENCE` never become
authoritative by themselves. Model output alone cannot constitute a
verified economic contribution.

## Provenance and quality

Verification vocabulary:

- `AUTHORITATIVE_REFERENCE`
- `VERIFIED`
- `ATTESTED`
- `USER_DECLARED`
- `DERIVED`
- `INFERRED`

Lifecycle / data-quality vocabulary:

- `CURRENT`
- `STALE`
- `CONFLICTED`
- `INCOMPLETE`
- `SUPERSEDED`

Contribution lifecycle is separate from settlement eligibility:

- lifecycle: `OBSERVED`, `SUBMITTED`, `VERIFICATION_REQUIRED`,
  `VERIFIED`, `REJECTED`, `SUPERSEDED`
- eligibility: `NOT_EVALUATED`, `NOT_SETTLEMENT_ELIGIBLE`,
  `SETTLEMENT_REVIEW_REQUIRED`, `SETTLEMENT_ELIGIBLE_BY_POLICY`

`SETTLEMENT_ELIGIBLE_BY_POLICY` still does not mint, value, or issue
SunRey Coin. It requires an explicit policy decision reference.

Superseded events remain historically traceable.

## Privacy boundary

Canonical contribution records carry structural flags:

- `containRawPersonalData: false`
- `humanWorthScore: false`
- `socialCreditScore: false`
- `creditScore: false`
- `automaticMintAuthority: false`

Information-involving classes can require consent, purpose,
information-right, and usage-receipt references. Protected personal
traits cannot be ranking or valuation inputs.

## Relationship to PEG

`packages/personal-economic-graph` remains the canonical Personal
Economic Graph. This ontology may store a `PegEventRef`. It does not
reimplement PEG, execute from PEG, or treat a graph projection as
authoritative money.

## Relationship to HIN

`packages/information-market` remains the canonical Human Information
Network. This ontology may store Human Information right, consent, and
usage-receipt references. It does not create a second marketplace,
consent ledger, or compensation engine.

## Relationship to PEVE

`packages/platform/src/value` remains the canonical Personal Economic
Value Engine.

**PEVE != contribution valuation.**

PEVE describes a person's economic system. A Human Economic
Contribution records an attributable contribution or participation
event. PEVE scores are not contribution value and are not token value.

## Relationship to Chunk 71 monetary constitution

Chunk 71 (`packages/sunrey-chain/src/economics`) remains the monetary
constitution for SunRey Coin and MoonRey Coin. This chunk does not
create another monetary authority, issuance engine, or supply book.

**Contribution measurement != SunRey Coin quantity.**

Measurement examples are unit counts: verified research sessions,
approved creative assets, verified professional hours, consent-scoped
information uses, community contribution units, or service-delivery
units. Unlike units are not economically equivalent.

## Why this is not a human-worth score

The ontology forbids human-worth, social-credit, credit,
employability, political, and general ranking scores. Protected traits
cannot be used to rank people. A contribution event describes
participation, not intrinsic human value.

**Human economic contribution != human worth.**

## Why contribution measurement is not token valuation

Measurement is a governed non-monetary count. The event has
`sunReyQuantity: null`, `issuanceEligible: false`, and no valuation
formula. A contribution cannot authorize minting or financial
execution.

## Commands

```
npm run demo:sunrey-human-contribution-ontology
```

## What this chunk does not do

- Calculate SunRey Coin quantities
- Create a contribution valuation formula
- Use PEVE as token valuation
- Mint SunRey Coin
- Issue Execution Authority
- Move money or post ledger journals
- Create another consent system, PEG, PEVE, HIN, or monetary authority
- Connect to live external providers
- Turn on production flags
