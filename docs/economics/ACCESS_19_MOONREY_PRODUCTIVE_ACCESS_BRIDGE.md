# ACCESS-19: MoonRey Productive Capacity to Access Bridge

Classification: engineering simulation on current `main`. This document describes
how verified productive capacity flows into Access capacity pools without
conflating MoonRey issuance, provider settlement, and Access delivery. It is not
legal advice and does not activate production.

## Mission

Close the productive-side economic loop:

```
Productive Asset
  → Verified Productive Capacity / Output / Delivery
  → MoonRey Productive Economy
  → MR compensation / governed issuance where permitted

Verified available capacity
  → Access Capacity Pool
  → Human Access
  → Delivery
  → Settlement
  → Evidence
```

## Critical distinction

Productive contribution that justifies MoonRey issuance is **not** the same thing
as Access capacity committed to users.

| Concern | Owner | ACCESS-19 behavior |
|---------|-------|-------------------|
| Productive contribution evidence | `packages/sunrey-chain/src/productive` | Verified via Chunk 44 engine |
| MoonRey issuance | Chunk 44 `evaluateIssuance` | Governed productive rules only |
| Provider settlement | ACCESS-14 funding router pattern | FIAT / SR / MR per contract |
| Capacity commitment | `AccessCapacityCommitment` | Commits verified capacity to Access |
| Access delivery | Bridge consumption + evidence | Meters pool units, seals delivery |

## AccessCapacityCommitment

Canonical type: `packages/access-economy/src/productive-access-bridge/types.ts`

Fields:

- `providerRef` / `productiveObjectRef`
- `category`, `capacityType`, `canonicalUnit`, `quantity`
- `availabilityWindow`, `geography`, `qualityClass`
- `settlementTerms`, `evidenceRefs`, `oracleRefs`
- `expiration`, `revocationPolicy`, `status`

A commitment of existing productive capacity. **It does not mint MoonRey.**

## Productive examples (simulation)

Deterministic fixtures support:

| Example | Unit |
|---------|------|
| Solar | `kWh` |
| GPU cluster | `GPU_HOUR` |
| Robot fleet | `robot_hour` |
| Autonomous vehicle fleet | `vehicle_hour` / `vehicle_day` |
| Hotel | `room_night` |
| Factory | `production_unit` |
| Food producer | `deliverable_food_unit` |

## MoonRey economics

ACCESS-19 consumes legitimate MR balances (ACCESS-15 pattern) and legitimate
productive capacity in Access pools. It does **not** define:

- `1 productive unit = 1 MR`
- `1 MR = fixed Access quantity`

MoonRey supply changes only through existing governed productive rules, not
Access usage.

## Capacity expansion loop

When productive capacity rises:

1. Verified available capacity rises (Chunk 44 verification)
2. Allocatable Access pool can rise (new commitments bounded by verified capacity)
3. Participant Access can rise (pool publication)

No automatic SR/MR mint from Access activity.

## Provider settlement

A productive provider may receive FIAT, SR, MR, or permitted mixed consideration
according to actual contract / market terms. MoonRey issuance for productive
contribution must not be silently treated as payment for an Access redemption.

## Double-count protections

| Invariant | Statement |
|-----------|-----------|
| `NO_PRODUCTIVE_CAPACITY_DOUBLE_COUNT` | Same capacity not committed beyond verified available |
| `NO_ACCESS_USAGE_MINTS_MOONREY` | Access consumption never issues MoonRey |
| `NO_PROVIDER_SETTLEMENT_EQUALS_MOONREY_ISSUANCE` | Settlement ≠ productive issuance |
| `CAPACITY_COMMITMENT_LE_VERIFIED_AVAILABLE_CAPACITY` | Commitment ≤ verified available |
| `NO_OUTPUT_DELIVERY_DOUBLE_ISSUANCE` | Output + delivery lineage cannot double-mint |
| `NO_PHANTOM_PRODUCTIVE_CAPACITY` | No commitment without verified source |
| `NO_ORACLE_FACT_ALONE_MINTS` | Oracle fact alone insufficient |
| `ONLY_CANONICAL_MR_BALANCE_AFFECTS_MR_TWAB` | Only governed issuance affects MR TWAB |

## Autonomous fleet demo

Scenario:

- **100,000** vehicle-hours total verified capacity
- **10,000** vehicle-hours committed to Access
- Participant consumes **4 vehicle-days** (96 vehicle-hours)
- Provider receives configured simulation consideration (FIAT + MR contract terms)
- Delivery evidence proves service
- Remaining capacity reconciles exactly
- MoonRey supply unchanged by Access usage

Run:

```bash
npm run demo:access-productive-bridge
npm run demo:sunrey-productive-access-bridge
```

## Canonical owners (no parallel engines)

| Component | Owner |
|-----------|-------|
| `AccessCapacityCommitment` | `packages/access-economy` |
| Bridge engine | `packages/access-economy/src/productive-access-bridge` |
| Productive integration | `packages/sunrey-economics/src/productive-access-bridge` |
| Productive economy | `packages/sunrey-chain/src/productive` |
| Access pools (operational) | `packages/access-fabric` |
| Provider gateway | `packages/access-economy/src/providers` |
| Exchange clearing | `packages/sunrey-exchange/src/access-fabric` |
| Evidence Vault | `packages/evidence` |

Do not create `packages/moonrey`, `packages/access-ledger`, or a second
MoonRey issuance engine.

## Tests

```bash
node --experimental-strip-types --disable-warning=ExperimentalWarning --test \
  packages/access-economy/src/productive-access-bridge/productive-access-bridge.test.ts \
  packages/sunrey-economics/src/productive-access-bridge/productive-access-bridge.test.ts
```
