# Chunk 140 — Human Information Chain Anchor Finality

This chunk completes the HIN → SunRey Chain evidence lifecycle:

```
HIN Evidence
  → ChainWriteIntent
  → submission
  → chain operation
  → receipt
  → finality
  → reconciliation
  → HIN anchor projection
```

It does not create a second finality model. Blocks, consensus,
validators, the transaction pool, signing, state roots, and reorg
algorithms remain SunRey Chain responsibilities.

## Owner

`packages/information-market/src/network/chain-anchor`

Capability: `sunrey-hin-chain-anchoring` (`IMPLEMENTED`)

Do not create `packages/hin-chain-anchor`, `packages/hin-finality`,
`packages/information-chain-node`, or `packages/hin-blockchain`.

## Coordinator

`HumanInformationAnchorCoordinator` prepares, submits, refreshes
finality, reconciles, and projects. It talks only to the narrow
`HumanInformationChainAnchorPort`, which wraps
`SunReyChainService.submit`, `reconcile`, and finality reads.

HIN domain logic must not call `SimulationChainAdapter` directly.

## Lifecycle

HIN projections preserve existing chain operation states:

`CREATED`, `QUEUED`, `SUBMITTED`, `ACCEPTED`, `PENDING_FINALITY`,
`FINALIZED`, `REJECTED`, `UNKNOWN`, `REORG_OBSERVED`, `FAILED`.

A HIN anchor is never marked `FINALIZED` before chain finality.
Finalized anchors capture transaction id, receipt id, block
reference, confirmation count, payload commitment, and finalized
state. HIN wall-clock time is not used as a block height.

## Consent and revocation

Consent remains valid according to HIN consent policy.
`CHAIN_FINALITY_IS_NOT_LEGAL_CONSENT_AUTHORITY=true`.

Revocation takes effect immediately under HIN policy. A
`CONSENT_REVOCATION` anchor is prepared and submitted as evidence.
If the chain is unavailable, future HIN use stays blocked. A failed
revocation anchor never reactivates consent.

After finalized revocation, the projection records the prior consent
commitment, revocation commitment, transaction, block, and finality.
The historical consent anchor remains immutable. Projected consent
state becomes inactive.

## Usage receipts

`HumanInformationUsageReceipt.chainHeight` on v1 receipts is not
mutated. Chunk 140 adds `HumanInformationUsageAnchorProjection`
(`schemaVersion: 2`) with `receiptId`, `anchorId`, `chainHeight`,
`transactionId`, and `finalized`.

## UNKNOWN and reorg

`UNKNOWN` / `unknownAfterBroadcast` requires
`HIN_ANCHOR_RECONCILIATION_REQUIRED`. HIN does not blindly create a
second intent.

`REORG_OBSERVED` changes anchoring evidence status only. Consent,
usage history, revocation, and contribution records are preserved.
The outcome is `REANCHOR_REVIEW_REQUIRED`. Financial and legal state
are not rewritten.

## Reconciliation

`SunReyChainService.reconcile` outcomes map to
`HumanInformationAnchorReconciliation`:

| Chain | HIN |
| --- | --- |
| `MATCHED` | `MATCHED` |
| `PENDING` | `PENDING` |
| `REORG_OBSERVED` | `REANCHOR_REVIEW_REQUIRED` |
| `HASH_MISMATCH`, `SUBMISSION_UNKNOWN`, `INVESTIGATION_REQUIRED`, `DUPLICATE_EXTERNAL` | `REVIEW_REQUIRED` |
| `MISSING_CHAIN_RECORD`, `MISSING_INTERNAL_RECORD` | `FAILED` |

`autoFixed` is always `false`. Hash mismatches are never auto-fixed.

## Retry

| State | Action |
| --- | --- |
| `INTENT_CREATED` / `CREATED` | submit the same intent |
| accepted / pending | refresh status |
| `FINALIZED` | return the existing finalized anchor |
| `UNKNOWN` | reconcile before anything else |
| `REORG_OBSERVED` | review / reconciliation |
| `REJECTED` | do not create a duplicate HTTP retry |

## Engine integration

Business actions succeed according to HIN policy. An anchor request
is recorded as `PENDING_ANCHOR` and tracked independently. Temporary
chain unavailability does not reactivate forbidden use.

Contribution anchors use `PROOF_OF_CONTRIBUTION` and do not authorize
SunRey issuance. Settlement evidence anchors are not a ledger, balance,
or mint.

## Economic Asset Registry

When an anchor is `FINALIZED`, optional chain-anchor metadata may be
projected onto the corresponding registry asset. Anchoring does not
mark the asset `VERIFIED`.

## Surfaces

Control Center and requester portal expose privacy-safe
`FINALIZED` / `PENDING` / `REVIEW_REQUIRED` status plus transaction
and block references. Subject `internalRef` is not exposed. A
requester sees only its own authorized anchors.

Rights audit v2 adds created / submitted / finalized / pending /
reconciliation-required / reorg-observed counters.

Health is operational evidence (`chainAvailable`, `pendingAnchors`,
`unknownSubmissions`, `reconciliationFailures`, `reorgCount`,
`oldestPendingAge`). It is not a human score.

## Failure codes

- `HIN_ANCHOR_OPERATION_NOT_FOUND`
- `HIN_ANCHOR_SUBMISSION_UNKNOWN`
- `HIN_ANCHOR_RECONCILIATION_REQUIRED`
- `HIN_ANCHOR_HASH_MISMATCH`
- `HIN_ANCHOR_REORG_OBSERVED`
- `HIN_ANCHOR_FINALITY_PENDING`
- `HIN_ANCHOR_REJECTED`
- `HIN_ANCHOR_FINALITY_UNAVAILABLE`
- `HIN_ANCHOR_SCOPE_MISMATCH`

## Demo

```
npm run demo:sunrey-hin-chain-finality
```

Prints:

```
CONSENT_SOURCE_OF_TRUTH=HIN
CHAIN_ANCHOR_IS_EVIDENCE=true
REVOCATION_REQUIRES_CHAIN_TO_BLOCK_FUTURE_USE=false
FINALIZED_ANCHORS=<count>
RAW_PERSONAL_DATA_ON_CHAIN=false
ANCHOR_MINTS_ASSET=false
PRODUCTION_ACTIVE=false
```
