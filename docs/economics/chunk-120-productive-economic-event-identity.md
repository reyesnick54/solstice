# Chunk 120 — Canonical Productive Economic Event Identity and Attribution Graph

Canonical owner: `packages/sunrey-chain`.

Capability `moonrey-economic-event-attribution` is `IMPLEMENTED` at
`packages/sunrey-chain/src/productive/policy-governance/attribution`.

This chunk extends the existing Chunk 74 policy-governance owner. It
does **not** create `packages/moonrey-attribution`,
`packages/economic-event-graph`, `packages/deduplication-engine`, or
`packages/productive-attribution-v2`.

Chunk 74 fingerprints remain historical and unchanged:

- `contributionFingerprint` (v1)
- `governedContributionFingerprint` (v2)
- `crossCategoryEventFingerprint` (v2)
- `capacityOutputEventFingerprint` (v2)

This chunk **strengthens** them with event fingerprint v3
(`SUNREY_MOONREY_EVENT_V3`).

## Why this exists

Duplicate controls already catch obvious same-object / same-window
repeats. The broader risk is the **same real economic output** being
represented through different objects, controllers, categories, or
stages.

Example:

```
robot manufactures Product X
→ MANUFACTURING claim
→ AUTOMATED_MACHINE_OUTPUT claim
→ GOODS claim
→ LOGISTICS claim
```

Those are not automatically four independent units of economic
creation. Some may be genuinely separate services. Others are
alternate descriptions of one underlying event.

## Claim vs event

A **claim** is an assertion about an economic event.

A **ProductiveEconomicEvent** is the underlying productive occurrence.

Multiple claims may share one `eventId`. This chunk establishes
identity only. It does **not** decide allocation.

## Event classes

Event class is not the same as `ProductiveCategory`. Candidate
mappings exist, but factory manufacturing and robot telemetry of the
same transformation share `MANUFACTURING_TRANSFORMATION_EVENT`.

## Cross-object identity

The same event may be observed through a factory line object, a robot
object, and a manufactured-good batch object. Identity uses hashed
references (lots, transformation refs, alternate-view groups,
measurement windows, geography). It does not rely solely on
`objectId` equality.

Raw industrial payloads are rejected.

## Relation types

`SAME_UNDERLYING_EVENT` implies duplicate-value risk.

`INPUT_TO` / `OUTPUT_OF` describe flow and do **not** imply duplicate
value. Logistics `TRANSPORTS` / `DELIVERS` a goods batch. Storage
`STORES` it. Those are distinct service events.

## Linkage confidence

```
AUTHORITATIVE_LINK
VERIFIED_LINK
STRONG_EVIDENCE
POSSIBLE_MATCH
UNRELATED
```

Only `AUTHORITATIVE_LINK` and `VERIFIED_LINK` may establish
`SAME_UNDERLYING_EVENT`. Weak similarity generates review. It cannot
silently merge events.

## Attribution graph

`ProductiveAttributionGraph` is a rebuildable projection / index. It
is not a ledger and not a monetary authority. It cannot mint.

## Economic Asset Registry

Optional lineage references may be projected as metadata-only
`ECONOMIC_ATTESTATION` records. The registry remains an index. Event
identity cannot authorize issuance.

## Authority boundary

```
EVENT_IDENTITY_AUTHORIZES_MOONREY=false
RAW_INDUSTRIAL_DATA=false
CROSS_OBJECT_IDENTITY_SUPPORTED=true
PRODUCTION_ACTIVE=false
```

No live sources. No valuation-function implementation. No tokenomics
changes. Chunk 71 remains the issuance authority.
