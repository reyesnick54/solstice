# ACCESS-08 — SunRey Blockchain access rights, reservations, and commitments

Capability: `sunrey-access-rights-commitments`
Owner: `packages/sunrey-chain`
Path: `packages/sunrey-chain/src/access`

ACCESS-08 gives Access Fabric economic rights an authoritative
representation on the **existing** SunRey Chain. It is not a new
blockchain, a side ledger, or a generic token wrapper. It extends the
canonical chain owner and writes through the existing
`SunReyChainService`, so classification, signing, evidence sealing,
finality, and reconciliation remain where they already live.

## What the chain records

| Access event | Chain record type | Meaning |
| --- | --- | --- |
| `ACCESS_RIGHT_CREATED` | `EVIDENCE_ANCHOR` | A non-ownership right over a productive object exists |
| `ACCESS_RIGHT_REVOKED` | `EVIDENCE_ANCHOR` | The right no longer grants future access |
| `RESERVATION_COMMITTED` | `EVIDENCE_ANCHOR` | Capacity is held against the right |
| `RESERVATION_CONFIRMED` | `EVIDENCE_ANCHOR` | The counterparty accepted the hold |
| `RESERVATION_EXPIRED` | `EVIDENCE_ANCHOR` | The hold elapsed and capacity returned |
| `RESERVATION_CANCELLED` | `EVIDENCE_ANCHOR` | The hold was released before use |
| `USAGE_COMMITTED` | `EVIDENCE_ANCHOR` | Capacity was actually consumed |
| `DELIVERY_COMMITTED` | `ATTESTATION` | A counterparty attests the access was delivered |
| `SETTLEMENT_EVIDENCE_REFERENCE` | `DIGITAL_ASSET_SETTLEMENT` | A journal the canonical ledger already recorded |

Each kind reuses an existing `ChainRecordType`. ACCESS-08 adds no record
type, no transaction family, and no consensus rule.

## Ownership is not access

`AccessRightClass` is `ACCESS`, `USE`, `LEASE`, or `RESERVATION`, and
each projects onto the canonical protocol `RightType` in
`packages/sunrey-chain/src/protocol/rights.ts`. `RESERVATION` is a
scheduled `ACCESS` claim, not a distinct protocol right.

The ownership classes `OWN`, `CONTROL`, and `TRANSFER` are refused with
`ACCESS_OWNERSHIP_RIGHT_REFUSED`. Title-conveying operations
(`TRANSFER_TITLE`, `CONVEY_OWNERSHIP`, `SELL_ASSET`, `ENCUMBER_TITLE`,
`MORTGAGE`, `PLEDGE_TITLE`, `MINT`, `ISSUE`, `BURN`) are refused with
`ACCESS_OWNERSHIP_OPERATION_REFUSED`. Every projection and record
carries `conveysOwnership: false`. There is no sequence of access
commitments that transfers title.

An access right may be marked transferable — a lease can be assigned —
but transferring a lease is still not transferring the asset.

## Target productive object

An `AccessRight` points at a `ProductiveEconomicObject` resolved through
`AccessProductiveObjectPort`. The productive registry stays the owner of
those objects. A right is refused when the object is unknown
(`ACCESS_TARGET_UNKNOWN`), not active for the block height and time
(`ACCESS_TARGET_INACTIVE`), measured in a different unit schema
(`ACCESS_TARGET_UNIT_MISMATCH`), or granted zero or negative capacity
(`ACCESS_TARGET_QUANTITY_INVALID`).

## Authorization

Actors resolve through `AccessActorRegistryPort` against the existing
identity/actor registry and are described by the protocol
`ActorDescriptor`. Each commitment kind requires a capability reference
on that descriptor, and creating or revoking a right additionally
requires the actor to be a recognised rights authority for that specific
productive object.

This is registry authority, not Execution Authority. The chain package
neither issues nor verifies Execution Authority, and ACCESS-08 does not
change that.

## Deterministic state and replay

`applyAccessEvent` is a pure function of prior state and the committed
event. It reads no clock, no random source, and no chain state, so two
nodes that replay the same log reach the same result.

- Events carry a monotonic `sequence`; a gap is `ACCESS_SEQUENCE_INVALID`.
- A commitment key already applied is `ACCESS_DUPLICATE_COMMITMENT`.
- `replayAccessEvents` orders by sequence, so out-of-order delivery
  converges on the same state.
- `accessStateCommitment` is the canonical value two nodes compare.

Right expiry is derived from block time rather than stored, so an
expired right needs no event and cannot drift between nodes.

## Duplicate commitments

Each `(kind, domain identifier)` pair may be committed once.

- An identical resubmission returns the existing record with
  `duplicateOf` set and writes nothing new to the chain.
- A resubmission with different content is `ACCESS_COMMITMENT_CONFLICT`.

## Privacy boundary

Only commitments, rights identifiers, policy and consent references,
provenance, timestamps, state, and evidence references reach a chain
payload.

The boundary is structural rather than a content filter. Caller-supplied
labels, codes, and references must match `ACCESS_LABEL_SHAPE`: a short
controlled token with no whitespace. Free-text itineraries, addresses,
names, and preference prose cannot take that shape, so they cannot be
committed even as a hash — a commitment over personal prose is still
personal data. On top of that, `ACCESS_FORBIDDEN_PAYLOAD_KEYS` rejects
itinerary, travel-history, health, preference, precise-location, and
payment-credential field names, and the chain's own `classifyWrite`
gate runs afterwards.

Holders bind through a pseudonymous `ScopedSubjectReference`. A raw
subject identifier never appears in a payload.

## No new minting pathway

- `ACCESS_COMMITMENT_MINTS_ASSET` is `false`; there is no Access Coin
  and no access-denominated unit.
- No SunRey or MoonRey issuance is triggered by any access event.
- `SETTLEMENT_EVIDENCE_REFERENCE` may only reference a journal the
  canonical internal ledger already recorded, resolved through
  `AccessSettlementEvidencePort`. An unknown reference is
  `ACCESS_SETTLEMENT_NOT_CANONICAL`.
- Every chain write intent keeps `economicValueMovement: false`.

## Finality and state synchronization

`synchronizeFinality` re-reads the chain operation state for every
commitment and projects `PENDING`, `FINAL`, `REVIEW_REQUIRED`,
`REJECTED`, or `UNKNOWN`. A reorg marks records `REVIEW_REQUIRED` and
never rewrites access state: every projection carries
`applicationStateRewrittenByChain: false`, and the state commitment is
unchanged by a reorg because access state is derived from the committed
log, not from chain confirmations.

## Tests

`packages/sunrey-chain/src/access-chain-rights.test.ts` covers
unauthorized right creation, expired rights, revocation, duplicate
commitments, invalid target productive objects, the privacy boundary,
deterministic replay, finality and state synchronization, the ownership
boundary, capacity limits, reservation holds, and canonical settlement
references.

## Demo

```
npm run demo:access-rights --workspace @solstice/sunrey-chain
```
