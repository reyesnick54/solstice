# Chunk 115 — Cross-Domain Economic Asset Registry Integration Fabric

This chunk connects the master Economic Asset Registry to the existing
canonical source domains without making the registry the owner of
their domain state.

Capability `sunrey-economic-asset-registry` remains singular. Chunk 115
does not create a second registry, owner, or capability.

## Direction

```
Canonical Source Domain
        ↓
privacy-safe metadata adapter
        ↓
EconomicAssetRegistryPort
        ↓
master metadata / lineage descriptor
```

This is **not**:

```
Economic Asset Registry
        ↓
reimplement all source domains
```

## Port

`EconomicAssetRegistryPort` is the only cross-domain surface:

- `registerDescriptor`
- `verifyDescriptor`
- `getDescriptor`
- `queryDescriptors`
- `addLineage`
- `supersede` / `correct`
- `restrict` / `suspend`
- `findBySourceRecord`

Internal storage and query indexes stay private. Repeated projection of
the same source + version + content commitment is idempotent. A changed
canonical version supersedes. A same-version content change corrects.

## Adapters

Source-specific adapters live in the source domain and depend on the
public registry contract:

| Source | Adapter | Classes |
| --- | --- | --- |
| HIN | `packages/information-market/src/network/economic-asset-adapter.ts` | `INFORMATION_ASSET`, `INFORMATION_RIGHT` |
| Human Contribution Registry | `packages/human-economic-contribution/src/economic-asset-adapter.ts` | `HUMAN_CONTRIBUTION_EVIDENCE`, `HUMAN_CONTRIBUTION_RECORD`, `ECONOMIC_REFERENCE_DATA` |
| Oracle | `packages/sunrey-chain/src/oracle/economic-asset-adapter.ts` | `ORACLE_SOURCE_DATASET`, `ORACLE_OBSERVATION_SET`, `VERIFIED_ECONOMIC_FACT` |
| Productive economy | `packages/sunrey-chain/src/productive/economic-asset-adapter.ts` | `PRODUCTIVE_ECONOMIC_OBJECT`, `PRODUCTIVE_CLAIM`, `VERIFIED_PRODUCTIVE_CONTRIBUTION` |

`packages/economic-asset-registry` does not import those implementations.

## Source of truth

The registry is an **index / metadata fabric**. It is not authoritative
for:

- consent status
- HIN permission status
- contribution verification
- oracle fact validity
- productive claim validity
- native SunRey / MoonRey supply

`REGISTRY_IS_SOURCE_OF_TRUTH=false` is a structural flag, not a comment.

## Privacy and secrets

Adapters project references, commitments, and method identifiers only.
They must not carry:

- raw HIN or PDV content
- clean-room rows
- legal identity
- API keys, OAuth secrets, private keys
- factory credentials or industrial raw payloads

Oracle authentication stores the **method** only. A `SecretReference`,
if present, remains a reference.

Valuation amounts stay on valuation results. They are never copied into
`automaticValue`. Registry registration does not authorize settlement
or mint either coin.

## Lineage

Cross-domain edges are recorded only when canonical references exist:

```
ORACLE_SOURCE_DATASET
  → DERIVED_FROM / NORMALIZED_FROM
ORACLE_OBSERVATION_SET
  → AGGREGATED_FROM / VERIFIED_BY
VERIFIED_ECONOMIC_FACT
  → VERIFIED_BY
PRODUCTIVE_CLAIM
  → CONTRIBUTED_TO
VERIFIED_PRODUCTIVE_CONTRIBUTION

INFORMATION_ASSET
  → DERIVED_FROM
INFORMATION_RIGHT
  → CONTRIBUTED_TO
HUMAN_CONTRIBUTION_EVIDENCE
  → VERIFIED_BY
HUMAN_CONTRIBUTION_RECORD
```

HIN chain anchors that are still simulation / unfinalized are recorded
as `UNANCHORED`. The fabric does not invent production finality.

## Commands

```
npm run demo:sunrey-economic-asset-fabric
```

The demo prints two parallel lineages and:

```
REGISTRY_IS_SOURCE_OF_TRUTH=false
RAW_PERSONAL_DATA=false
RAW_INDUSTRIAL_PAYLOAD=false
CREDENTIALS_EXPOSED=false
AUTOMATIC_ISSUANCE=false
```
