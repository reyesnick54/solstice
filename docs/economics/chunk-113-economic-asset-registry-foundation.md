# Chunk 113 — Canonical SunRey Dataset & Economic Asset Registry Foundation

This chunk creates **one master metadata, rights, provenance, lineage,
and policy registry** for datasets and economic evidence assets across
the SunRey / MoonRey architecture.

It sits **above** source-specific systems. It does not replace them.

Canonical owner: `packages/economic-asset-registry`.

Capability `sunrey-economic-asset-registry` is `IMPLEMENTED`.

## Purpose

`EconomicAssetRegistry` describes:

- what the asset is
- who controls it, holds rights, custodians it, operates it, or is
  the subject
- where it came from
- which rights, consent, purpose, license, and usage references apply
- which jurisdiction applies
- how sensitive it is
- how good and how fresh it is
- its lineage
- where the authoritative source lives
- which economic use is permitted
- where its blockchain commitment is anchored

It does **not** normally store raw datasets.

```
Raw / protected source data
        ↓
Canonical source-specific system
        ↓
Economic Asset Descriptor
        ↓
Rights / provenance / lineage / quality metadata
        ↓
Commitments / chain anchors
        ↓
Human or productive economic workflows
```

## What this registry is not

It is not:

- HIN (`packages/information-market`)
- PDV (`packages/personal-data-vault`)
- PEG (`packages/personal-economic-graph`)
- the Human Economic Contribution Registry
  (`packages/human-economic-contribution`)
- the Oracle Network (`packages/sunrey-chain/src/oracle`)
- the Productive Object or Claim registries
  (`packages/sunrey-chain/src/productive`)
- the Native Asset Supply Book / monetary constitution
  (`packages/sunrey-chain/src/economics`)

Those owners remain authoritative for their own records. This registry
holds **references** to them.

## Roles are not ownership

Controller, rights holder, custodian, operator, and subject are
modeled separately. None is legal ownership unless an explicit rights
record establishes it. Data subject ≠ owner. Controller ≠ owner.
Operator ≠ owner.

`canonicalOwner` is the **canonical system package** that owns the
source record, not a legal-title claim.

## Storage and privacy

Typical storage classes:

- `OFF_CHAIN_PROTECTED` — raw sensitive personal data
- `OFF_CHAIN_RESTRICTED` — factory / MES / SCADA telemetry
- `OFF_CHAIN_PUBLIC_REFERENCE` — public reference datasets
- `ON_CHAIN_COMMITMENT_ONLY` — hashes, proofs, rights references
- `ON_CHAIN_PUBLIC_METADATA` — public descriptor metadata
- `DERIVED_REBUILDABLE` — projections rebuilt from sources

Blockchain should generally hold hashes, commitments, proofs, rights
references, usage references, verified economic facts, and
settlement/issuance evidence — not raw sensitive datasets.

Registry metadata must not leak protected content.

## Valuation and minting

`EconomicAssetDescriptor.permittedValuationMethodRefs[]` is metadata
only. A registry entry does not become monetizable because it exists.

`VERIFIED` means registry metadata/provenance passed registry policy.
It does not mean issuance eligible.

SunRey Coin and MoonRey Coin native supply remain outside this
registry.

## Lifecycle

- `register`
- `get`
- `updateMetadata` (versioned supersession)
- `supersede`
- `correct`
- `query`
- `snapshot` / `restore`
- `rebuildProjections`

No destructive historical mutation. Corrections are new records.

## Commands

```
npm run demo:sunrey-economic-asset-registry
```

The demo prints:

```
RAW_DATA_STORED=false
AUTOMATIC_VALUATION=false
AUTOMATIC_SUNREY_MINT=false
AUTOMATIC_MOONREY_MINT=false
```

## Later chunks

Chunk 115 adds the cross-domain integration fabric and
`EconomicAssetRegistryPort`. Source-domain adapters live in HIN, the
Human Contribution Registry, the Oracle Network, and the productive
economy. This chunk remains the canonical registry model. The registry
does not become the source of truth for those domains.
