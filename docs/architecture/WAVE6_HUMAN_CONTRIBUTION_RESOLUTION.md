# Wave 6 Human Contribution Resolution

**Version:** 1.0.0-wave6  
**Status:** Simulation implementation  
**Owner:** `packages/human-economic-contribution/src/resolution`  
**Companion:** `docs/architecture/WAVE3_ECONOMIC_CLAIMS_AND_DEDUPLICATION.md`

---

## 1. Problem statement

The Human Economy now has ontology, pseudonymous identity, Sybil controls,
attestations, verification, rights, consent, and purpose. Wave 6 prevents
duplicate monetization of the same underlying human contribution.

SunRey economic input must not inflate because of:

- duplicate submissions
- multiple data sources
- multiple wallets
- multiple accounts
- multiple attestations
- retries
- aliases
- republication
- credential duplication

**Core invariant:**

```
MULTIPLE RECORDS OF ONE HUMAN CONTRIBUTION ≠ MULTIPLE HUMAN CONTRIBUTIONS
```

---

## 2. Task 1 — existing uniqueness controls

See `packages/human-economic-contribution/src/resolution/audit.ts` for the
machine-readable audit (`HUMAN_ECONOMY_UNIQUENESS_CONTROLS`).

| Control | Human economy scope | Wave 6 extension |
| --- | --- | --- |
| `contributionId` | Per registry record | Superseded at monetization boundary by `canonicalEventId` |
| `eventReference` | Per-submission provider record | Feeds observation replay keys only |
| `fingerprintEconomicEvent` | Registry `DUPLICATE_FINGERPRINT` | Extended by keyed `contributionResolutionFingerprint` |
| `receiptId` / `usageReceiptId` | HIN `DUPLICATE_USAGE_RECEIPT` | Committed as `authoritativeIdCommitment` |
| `hinReplayKey` | HIN value engine | Aligned via `monetizationKeyOf` at claim boundary |
| `replayKeyOf` | Monetary bridge settlement | Consumed through monetization lock |
| `canonicalEventId` | Wave 3 economic-proof adapter | Derived by `CanonicalHumanContributionEvent` |
| `monetizationLock` | Wave 3 proof lattice | `HumanContributionMonetizationStore` |
| `subjectRef` / `subjectId` | Per-path pseudonym | Resolved to `humanEconomicIdentityId` |
| Transaction replay | Proof-bound consumption | `DUPLICATE_MONETIZATION_KEY` |

---

## 3. Canonical human contribution event

`CanonicalHumanContributionEvent` (`resolution/canonical-event.ts`) formalizes
event identity from:

- `humanEconomicIdentityId` — wallet-agnostic economic identity
- `contributionClass`
- `authoritativeIdCommitments` — DOI, receipt, credential, job commitments
- optional `issuerCommitment`
- optional `projectWorkIdentifier`
- quantized time interval (class-specific; not timestamp-only)
- `contentCommitment` — evidence digest, never raw personal data
- optional `contributorRole`

`canonicalEventId` (`hcce_` prefix) is derived from committed material.
Timestamps alone cannot define identity.

---

## 4. Contribution fingerprint

`contributionResolutionFingerprint` (`hcrf_` prefix) uses keyed HMAC domain
separation (`sunrey-human-contribution-resolution-v1`).

Material includes economic identity and authoritative commitments — never raw
personal identifiers or wallet bindings. Predictable identity values must be
pre-committed through `deriveActorCommitment` before fingerprinting.

---

## 5. Cross-source resolution

Multiple evidence observations from publisher, research registry, university,
researcher profile, or aggregator resolve to:

- multiple `EvidenceObservation` records (one per source)
- one `CanonicalHumanContributionEvent`
- one `ResolutionCluster`

`resolutionStatus` becomes `RESOLVED` when corroborating source classes are
present. Provider record ids detect replays only — they do not define the
canonical event.

---

## 6. Multiple wallet protection

`humanEconomicIdentityId` (`heid_` prefix) is derived from `actorCommitment`
and optional jurisdiction. Wallet bindings (`wbr_` prefix) map wallet A, B, C
to the same identity.

The resolution fingerprint excludes wallet bindings. Same contribution from
multiple wallets produces one canonical event and at most one monetizable claim.

---

## 7. Contribution splitting

`assessContributionSplitting` applies class-specific rules:

| Class | Splitting signal |
| --- | --- |
| Research | Multiple content commitments for one DOI |
| Compute | Multiple observations for one job receipt |
| Creative | Many authoritative ids for one content commitment |
| General | Many near-duplicate records for one project id |

Legitimate multi-stage work is not collapsed automatically.

---

## 8. Contribution aggregation

`aggregationKeyForClass` distinguishes recurring legitimate work:

| Pattern | Aggregation key |
| --- | --- |
| Employment / service | `employer + day` |
| Compute jobs | `receipt` per job |
| Publications | `doi` per publication |
| Creative assets | `authoritative id + content prefix` |
| Information rights | `receipt` per use |

Recurring classes (`PROFESSIONAL_EXPERTISE`, `MODEL_TRAINING_PARTICIPATION`,
etc.) produce distinct keys per legitimate period or job.

---

## 9. Authorship / contributor relationships

`ContributorRole` (AUTHOR, CO_AUTHOR, DATA_CONTRIBUTOR, RESEARCH_ASSISTANT,
etc.) is metadata for research and creative classes. Roles are required where
methodology demands them. No valuation weights are invented.

---

## 10. Cross-identity claim attack

The same authoritative receipt, credential, or publication claimed by
different `humanEconomicIdentityId` values triggers:

| Condition | Code |
| --- | --- |
| Credential / receipt collision | `FRAUD_SUSPECTED` |
| Publication collision | `MANUAL_REVIEW_REQUIRED` |
| Other authoritative id collision | `CONFLICT` |

Conflicts block silent claim generation.

---

## 11. Claim generation

Only `RESOLVED` clusters (or explicitly forced single-source corroboration)
produce `HumanEconomicClaim` records. Unresolved duplicates, splitting
suspects, and cross-identity conflicts return `CLAIM_NOT_RESOLVED`.

At most one claim exists per `resolutionFingerprint`.

---

## 12. Monetization lock

`HumanContributionMonetizationStore` implements Wave 3-compatible lock
semantics:

```
UNMONETIZED → PROPOSED → AUTHORIZED → CONSUMED
```

`monetizationKeyOf(resolutionFingerprint, contextId)` prevents repeat
monetization through new wallet, API request, evidence bundle, attestation
combination, proposal, restart, snapshot restore, or validator path.

`wave3CompatibleReplayKey` aligns with `HumanContributionMonetaryBridge.replayKeyOf`
at the settlement boundary.

---

## 13. Engine

`HumanContributionResolutionEngine` orchestrates:

1. `bindWalletAndSubmit` / `submitObservation`
2. `resolveAll`
3. `generateClaimForCluster`
4. `attemptMonetization`

---

## 14. Tests

| File | Coverage |
| --- | --- |
| `packages/human-economic-contribution/src/resolution.test.ts` | Adversarial unit cases |
| `tests/wave-6-human-contribution-resolution.test.ts` | Cross-package integration |

Adversarial cases include: four-database publication, receipt replay, compute
job replay, credential replay, multi-wallet binding, cross-identity fraud,
timestamp alteration, legitimate recurring work, multiple publications, and
multiple compute jobs.

---

## 15. Integration boundary

This package does not import `packages/sunrey-chain` (isolation enforced by
`architecture-guards.test.ts`). Wave 3 `buildHumanEconomicClaim` and
`HumanContributionMonetaryBridge` consume resolved claims at the settlement
boundary using compatible fingerprint and replay key material.
