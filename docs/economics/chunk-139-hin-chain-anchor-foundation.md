# Chunk 139 — Human Information Network → SunRey Chain Anchoring Foundation

This chunk creates the canonical privacy-safe bridge from the Human
Information Network to the existing SunRey Chain simulation trust
layer.

```
Human Information Network
        ↓
Privacy-Safe Anchor Adapter
        ↓
Existing SunReyChainService
        ↓
Existing ChainWriteIntent
        ↓
Existing SunRey Chain
```

It is not a second blockchain.
It is not a second chain service.
It is not another consent ledger.
It is not a second Evidence Vault.

## Owners

| Concern | Owner |
| --- | --- |
| Human Information rights | `packages/information-market` |
| Chain writes, receipts, finality | `packages/sunrey-chain` |
| Capability | `sunrey-hin-chain-anchoring` (`PARTIAL`) |

Do not create `packages/hin-chain`, `packages/information-blockchain`,
`packages/privacy-chain`, `packages/consent-chain`, or
`packages/human-data-ledger`.

## Narrow port

`HumanInformationChainAnchorPort` exposes only:

- `createAnchorIntent`
- `submitAnchor`
- `anchorStatus`
- `reconcileAnchor`

HIN does not gain wallet operations, native asset issuance, validator
administration, governance mutation, or general-purpose chain writes.

## Anchor kinds and existing chain record types

| HIN kind | Chain record type |
| --- | --- |
| `CONSENT_GRANT` | `CONSENT_RECEIPT` |
| `CONSENT_REVOCATION` | `CONSENT_REVOCATION` |
| `INFORMATION_RIGHT_STATE` | `EVIDENCE_ANCHOR` |
| `PURPOSE_GRANT` | `EVIDENCE_ANCHOR` |
| `USAGE_RECEIPT` | `COMPUTATION_RECEIPT` (or `EVIDENCE_ANCHOR` when no computation exists) |
| `CLEAN_ROOM_COMPUTATION` | `COMPUTATION_RECEIPT` |
| `PROVENANCE` | `PROVENANCE` |
| `HUMAN_CONTRIBUTION_PROOF` | `PROOF_OF_CONTRIBUTION` (`doesNotMint: true`) |
| `COMPENSATION_SETTLEMENT_REFERENCE` | `DIGITAL_ASSET_SETTLEMENT` only when a canonical settlement already exists |

No new `ChainRecordType` values are introduced.

## On-chain safe data only

Allowed: cryptographic hashes, commitments, pseudonymous references,
policy versions, purpose/right/usage/computation commitments, settlement
and revocation references.

Forbidden: legal name, email, phone, address, raw financial history,
raw PDV, health or genetic records, private communications, raw device
or behavioral histories, bank information, KYC payload, API credentials,
private keys, and clean-room input rows.

SunRey Chain `classifyWrite` guards are reused and are not weakened.

Subject references use `ScopedSubjectReference` through the existing
chain service. Raw `HumanInformationSubjectId` is not written on chain.

## Rights evidence

Information rights remain authoritative in HIN. A chain anchor is
evidence of a rights-state snapshot.

```
CHAIN_ANCHOR_IS_RIGHTS_EVIDENCE=true
CHAIN_ANCHOR_TRANSFERS_OWNERSHIP=false
```

Historical consent grants, rights, usage receipts, and revocations are
not rewritten. Anchor state is stored separately.

## Contribution and compensation

A contribution proof may be anchored only after the canonical Human
Economic Contribution record exists and is `VERIFIED`. The anchor does
not calculate contribution value, SunRey quantity, or issuance.

HIN compensation remains `mintRequested: false`,
`unrestrictedIssuance: false`, and
`monetaryAuthority: CHUNK_71_MONETARY_CONSTITUTION`. The adapter may
not create a settlement, post a ledger journal, mint, or invent
`settlementRef`.

## Economic Asset Registry

The helper `hinFinalizedAnchorForRegistry` can later attach a
`FINALIZED` chain-anchor reference to `INFORMATION_ASSET`,
`INFORMATION_RIGHT`, or `HUMAN_CONTRIBUTION_EVIDENCE` without storing
raw data. It does not duplicate registry state.

## Lifecycle

Chunk 139 creates schemas and `ChainWriteIntent` records.
Transaction and finality fields may remain null.

Chunk 140 completes submit, finality, reorg, and reconciliation
integration.

## Demo

`demo:sunrey-hin-chain-anchor-foundation`

```
CHAIN_OWNER=packages/sunrey-chain
HIN_RIGHTS_OWNER=packages/information-market
RAW_PERSONAL_DATA_ON_CHAIN=false
ANCHOR_TRANSFERS_OWNERSHIP=false
ANCHOR_MINTS_SUNREY=false
ANCHOR_MINTS_MOONREY=false
PRODUCTION_ACTIVE=false
```
