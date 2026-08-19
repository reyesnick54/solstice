# Chunk 108 — Canonical Human Contribution to SunRey Monetary Evidence Bridge

Canonical owner: `packages/sunrey-chain/src/economics/human-contribution-bridge`.

Capability `sunrey-human-contribution-monetary-bridge` is `IMPLEMENTED`.

This chunk is a **fail-closed evidence bridge**. It is not a second mint
and not a second monetary authority.

## Authority chain

```
Human Contribution Registry
  → verification
  → versioned valuation / settlement authorization
     (LEGACY_DEVELOPMENT_FIXTURE or ENGINE_VALUATION_SIMULATION)
  → privacy-safe HumanEconomicEvidence
  → existing Chunk 71 MonetaryIssuanceAuthority
  → native AssetSupplyBook
```

`MonetaryIssuanceAuthority` remains the **only** canonical native
monetary issuance gate. Chunk 112 extends this bridge with an
engineering-implemented valuation path. Production valuation remains
inactive. The legacy fixture path remains simulation-only.

## What this chunk implements

- Privacy-safe adapter `VerifiedHumanEconomicContribution`
- Intermediate `HumanContributionMonetaryEvidenceCandidate`
- Deterministic contribution-class → `HumanEvidencePurposeClass` mapping
- `HumanContributionSettlementAuthorization` port
- DEVELOPMENT/SIMULATION authorization fixtures only
- Replay key `fingerprint + authorizationId`
- Protected-trait / human-worth / raw-personal-data firewall
- Explicit supersession/correction handling without clawback

## Valuation paths

Chunk 108 originally treated the valuation engine as unavailable and
supported DEVELOPMENT/SIMULATION fixture quantities only.

Chunk 112 adds a versioned `ENGINE_VALUATION_SIMULATION` path. It does
not flip the production boolean. `VALUATION_ENGINE_IMPLEMENTED`
remains `false`. Engineering availability is a separate constant.

A fixture may still carry an explicit DEVELOPMENT/SIMULATION quantity
on the legacy path. Production valuation remains unavailable.

## What this chunk does not implement

**Chunk 108 does not become a second mint.** Quantity is never inferred
here from PEVE, HIN, consent, clean-room results, or AI output.
Engineering valuation lives at
`packages/human-economic-contribution/src/valuation` and still cannot
mint. Production valuation remains unavailable.

This chunk also does not:

- create a second mint or monetary authority
- automatically issue SunRey from a verified contribution
- accept HIN consent, HIN usage receipts, or clean-room results as mint authority
- accept PEVE composite scores as SunRey quantity
- allow AI or Financial Agent authorization
- store or price raw personal data or protected traits
- configure production issuance, mainnet maximum supply, or genesis distribution
- implement arbitrary clawback of customer assets

## Fail-closed rule

A contribution may enter the monetary layer only as privacy-safe
fields (id, fingerprint, class, verification digest, measurement
basis/unit/period, jurisdiction/policy refs, settlement/valuation
refs, quantity basis, evidence hash).

Issuance additionally requires:

1. a verified contribution
2. a valid settlement/valuation authorization
3. existing Chunk 71 monetary authority checks

Missing quantity authorization fails closed.

## Purpose-class mapping

The mapping is not an issuance authorization
(`mappingIsIssuanceAuthorization = false`).

| Contribution class | `HumanEvidencePurposeClass` |
| --- | --- |
| `INFORMATION_RIGHT_CONTRIBUTION` | `CONSENT_SCOPED_INFORMATION_RIGHT_SETTLEMENT` |
| `COMMUNITY_CONTRIBUTION` | `VERIFIED_COMMUNITY_CONTRIBUTION` |
| other eligible verified classes | `VERIFIED_HUMAN_ECONOMIC_CONTRIBUTION` |
| `GOVERNED_PARTICIPATION_EVENT` | `AUTHORIZED_ECONOMIC_PARTICIPATION_EVENT` |

## Commands

```
npm run demo:sunrey-human-contribution-monetary-bridge
```

The demo prints:

```
PRODUCTION_ACTIVATED=false
PEVE_USED_AS_TOKEN_FORMULA=false
RAW_PERSONAL_DATA=false
AI_AUTHORIZED=false
```
