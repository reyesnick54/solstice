# ACCESS-18 — Human Information to SunRey to Access Bridge

Classification: engineering simulation on current `main`. This document describes the
canonical integration that closes the human-side economic loop without letting personal
data directly influence access participation weighting. It is not legal advice and does
not activate production.

## Mission

Close the complete human-side economic loop:

```
Human Information Opportunity
  → Consent
  → Purpose-Limited Data Use
  → Clean Room / Approved Computation
  → Verified Human Economic Contribution
  → Valuation / Compensation
  → SunRey settlement or governed issuance path
  → actual SR balance
  → ACCESS-15 participation snapshot
  → future Access allocation
```

## Critical rule

Personal data itself must **never** directly increase Access weight.

Correct path:

```
data participation
  → legitimate economic compensation
  → actual SR balance
  → future Access participation (TWAB)
```

Forbidden path:

```
data fields → hidden score → Access multiplier
```

## Canonical ownership

| Concern | Owner |
|--------|--------|
| ACCESS-15 participation snapshot / SR TWAB | `packages/access-economy/src/participation/` |
| ACCESS-18 bridge engine | `packages/access-economy/src/hin-access/` |
| HIN-side adapter | `packages/information-market/src/network/access-integration/` |
| Consumer BFF projections | `packages/human-access-economy/src/hin-access.ts` |
| BFF dispatch | `services/api/src/consumer/hin-access.ts` |

No competing ledger, mint, consent ledger, or access engine is introduced.

## Compensation paths

| Path | Description | Mint? |
|------|-------------|-------|
| `EXISTING_SR_TRANSFER` | Requester/market treasury transfers existing SR via `SunReyCoinService.transfer` | No |
| `FIAT_PAYMENT` | Fiat credit where product/legal structure permits | No |
| `GOVERNED_SUNREY_ISSUANCE` | Only via Chunk 71 `MonetaryIssuanceAuthority` with explicit human-contribution authorization | Governed only; simulation refuses without authorization |

Never:

- raw data → mint
- consent → mint
- clean-room result → mint
- AI valuation → mint

## Data minimization (ACCESS-15)

Access participation snapshots consume **only** settled SunRey balance history:

- `SrBalanceObservation.balanceMinor`
- observation timestamps
- settlement source references

They do **not** consume:

- data categories
- health information
- preferences
- identity traits
- research participation labels

## Revocation

Consent revocation affects **future** data use only. Already-finalized compensation remains
auditable. There is no retroactive Access clawback solely because consent was later
revoked, unless an explicit fraud/correction policy governs it.

## Deterministic demo

Automotive company funds **250,000 SR** for vehicle preference research. A participant
opts in, clean-room computation succeeds, a verified contribution is produced, and the
participant receives **5 SR** from an existing SR transfer (not mint).

On the next Access epoch, TWAB incorporates only the additional settled SR balance for
the time it was held. **No direct data bonus exists.**

Run:

```bash
npm run demo:access-18-human-information-to-access
```

## Permanent invariants

| ID | Statement |
|----|-----------|
| `NO_RAW_DATA_IN_ACCESS_FORMULA` | Personal data fields cannot enter participation weighting |
| `NO_CONSENT_EQUALS_MINT` | Consent alone cannot mint SunRey |
| `NO_DATA_RECORD_EQUALS_MINT` | A PDV record alone cannot mint SunRey |
| `NO_CLEAN_ROOM_RESULT_EQUALS_MINT` | A clean-room result alone cannot mint SunRey |
| `NO_HUMAN_WORTH_SCORE` | Human-worth scores are forbidden |
| `NO_PROTECTED_TRAIT_ACCESS_MULTIPLIER` | Protected traits cannot multiply access weight |
| `ONLY_ACTUAL_SETTLED_SR_AFFECTS_SR_TWAB` | TWAB uses settled SR balance history only |
| `NO_DUPLICATE_HUMAN_CONTRIBUTION_REWARD` | One verified contribution cannot settle twice |

## Consumer BFF surfaces

| Surface | Route | Notes |
|---------|-------|-------|
| Data Opportunities | `GET /api/v1/data/opportunities` | No raw PDV |
| Opportunity detail | `GET /api/v1/data/opportunities/{id}` | Purpose-bound terms |
| Opt in | `POST /api/v1/data/opportunities/{id}/opt-in` | Explicit consent path |
| Decline | `POST /api/v1/data/opportunities/{id}/decline` | No settlement |
| Participation History | `GET /api/v1/data/participation/history` | No data-weighting flags |
| Compensation History | `GET /api/v1/data/compensation/history` | `minted: false` always |
| Consent Status | `GET /api/v1/data/consent/status` | No vault contents |

## Tests

| Suite | Path |
|-------|------|
| ACCESS-18 domain + abuse tests | `packages/access-economy/src/hin-access/access-18.test.ts` |
| BFF integration | `tests/access-18-human-information-to-access.test.ts` |

## Related chunks

- Chunk 100 — Human Information Network (`packages/information-market`)
- Chunk 107 — HIN → Human Contribution Registry adapter
- Chunk 108 — Human contribution monetary bridge (`packages/sunrey-chain/src/economics/human-contribution-bridge`)
- ACCESS-14 — Provider network pattern (domain in `access-economy`, façade in `human-access-economy`)
- ACCESS-15 — Participation snapshot / SR TWAB (`packages/access-economy/src/participation`)
