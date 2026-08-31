# Access Allocation Engine

Classification: **engineering simulation** on current `main`.

## Purpose

The Access Allocation Engine converts eligible SunRey Coin (SR) and MoonRey Coin (MR) participation into **non-cash Access entitlements** backed by **real available capacity**.

```
AvailableCapacity(c) × ParticipantShare(i,c) = Access Allocation(i,c)
```

Canonical formula:

```
AccessShare(i,c) = AvailableCapacity(c) × ParticipantWeight(i,c) / SumParticipantWeights(c)
```

Where:

- `i` = participant / user
- `c` = Access category

## Hard architecture rules

The engine **does NOT**:

- establish a fiat redemption value for SR or MR
- sell or liquidate tokens
- guarantee users a dollar amount
- mint or burn tokens
- transfer, lock, or burn SR/MR when allocating Access
- use market price or fiat to normalize participation

**SR/MR ownership influences Access allocation. SR/MR are NOT automatically redeemed for Access.**

Token balances are **read-only**. The engine reads qualified balances via TWAB; it does not own token balances or modify blockchain consensus.

## Canonical owner

| Concern | Owner |
| --- | --- |
| Allocation engine | `packages/access-economy/src/allocation-engine/` |
| TWAB primitives | `packages/access-economy/src/dual-token-allocation/twab.ts` |
| Entitlement issuance | `packages/access-economy/src/dual-token-allocation/entitlement.ts` |
| Entitlement semantics | `packages/access-fabric` |
| Verified capacity | `packages/sunrey-access` / `packages/sunrey-access-fabric` |

## Access allocation equation

For each category `c` and allocation period:

1. Compute time-weighted average balances (TWAB) for SR and MR
2. Normalize against reference balances (not fiat prices)
3. Apply diminishing-returns transform
4. Compute dual-economy participation weight
5. Allocate verified capacity proportionally
6. Apply deterministic rounding without exceeding capacity

## TWAB methodology

Default window: **30 days** (configurable via `AccessAllocationPolicy.twabWindowDays`).

```
SR_TWAB(i) = (1/T) ∫ SR_balance_i(t) dt
MR_TWAB(i) = (1/T) ∫ MR_balance_i(t) dt
```

Implementation:

- piecewise-constant integration from balance checkpoints
- integer arithmetic only (bigint)
- locked / escrowed treatment is policy-driven (default: liquid only)
- reuses `TokenBalanceHistoryPort` / custody reads — does not duplicate blockchain accounting

TWAB reduces last-minute token purchases, temporary wallet transfers, and snapshot manipulation.

## Reference participation parameters

Governance parameters:

| Parameter | Meaning |
| --- | --- |
| `SR_REFERENCE_BALANCE` | Allocation reference quantity for SunRey normalization |
| `MR_REFERENCE_BALANCE` | Allocation reference quantity for MoonRey normalization |

These are **NOT**:

- fiat prices
- redemption values
- token pegs

They exist only to normalize participation scores across the dual economy.

## Diminishing returns

Default transform (versioned, configurable):

```
s_i = sqrt(SR_TWAB(i) / SR_REFERENCE_BALANCE)
m_i = sqrt(MR_TWAB(i) / MR_REFERENCE_BALANCE)
```

Properties:

- balance = 0 → score = 0
- never NaN, Infinity, or negative
- large holders receive sub-linear Access share (anti-whale)

## Dual-economy participation weight

Default coefficients (stored in policy, not hard-coded):

```
ParticipantWeight(i) = 0.40 × s_i + 0.40 × m_i + 0.20 × min(s_i, m_i)
```

| Coefficient | Default | Interpretation |
| --- | --- | --- |
| `srCoefficient` | 0.40 | SunRey participation |
| `mrCoefficient` | 0.40 | MoonRey participation |
| `dualCoefficient` | 0.20 | Dual-economy participation bonus |

Coefficients must sum to 1.00 unless an explicit normalized scheme is configured.

## Category-specific policies

`AccessAllocationPolicy.category` may scope a policy to one category. Unconfigured categories inherit the base policy.

Future-ready profiles (simulation fixtures):

| Category | Profile |
| --- | --- |
| MOBILITY | Balanced SR/MR (40/40/20) |
| AI_COMPUTE | Greater MR weighting |
| EXPERIENCES | Greater SR weighting |

## Capacity constraints

Mandatory invariant:

```
SUM(userAllocatedUnits) <= available allocatable capacity
```

For every category/period. The engine never creates more Access entitlement units than verified capacity allows.

Residual capacity after rounding remains unallocated (deterministic largest-remainder method).

## Participant caps

`maximumAllocationShareBps` limits the maximum percentage of category capacity one participant may receive. Example: `5000` = 50%.

## Rounding policy

| Mode | Categories | Behavior |
| --- | --- | --- |
| `WHOLE` | MOBILITY, STAY, etc. | Integer units (vehicle-days, room-nights) |
| `FRACTIONAL_MILLI` | AI_COMPUTE, etc. | Milli-unit precision (GPU hours) |

Rounding never causes total allocations to exceed capacity.

## Policy versioning

Every allocation references:

- `policyId`
- `policyVersion`

Historical allocations remain reproducible from stored evidence.

`AccessAllocationPolicy` fields:

- `policyId`, `version`, `category` (optional)
- `twabWindowDays`
- `srReferenceBalance`, `mrReferenceBalance`
- `srCoefficient`, `mrCoefficient`, `dualCoefficient`
- `diminishingReturnFunction`
- `minimumEligibility`
- `maximumAllocationShareBps` (optional)
- `expirationDays`
- `rolloverPolicy` (`NO_ROLLOVER`, `LIMITED_ROLLOVER`, `FULL_ROLLOVER`)
- `unitRoundingMode`
- `enabled`, `effectiveFrom`

## Allocation snapshot architecture

`AccessAllocationSnapshot` lifecycle:

| Status | Meaning |
| --- | --- |
| `CALCULATING` | Preview — not authoritative |
| `FINALIZED` | Committed allocation |
| `CANCELLED` | Aborted |
| `SUPERSEDED` | Replaced by newer snapshot |

Fields: `snapshotId`, `category`, `periodStart`, `periodEnd`, `capacityId`, `totalCapacity`, `eligibleCapacity`, `participantCount`, `totalParticipantWeight`, `policyId`, `policyVersion`, `generatedAt`, `inputLedgerSnapshotReference`, `status`.

## Participant allocation evidence

Each user's record retains sufficient evidence to reproduce calculation:

- SR TWAB, MR TWAB
- normalized SR score, MR score
- dual score
- participant weight
- total category weight
- available capacity
- final allocated units
- policy ID/version
- snapshot ID

Other participants' balances and weights are **not** exposed through public APIs.

## Preview vs finalization

| Mode | Creates entitlements | Snapshot status |
| --- | --- | --- |
| `PREVIEW` | No | `CALCULATING` |
| `FINALIZE` | Yes | `FINALIZED` |

Finalization is **idempotent** — the same snapshot ID and idempotency key cannot issue duplicate entitlements.

## Entitlement creation

After finalization, `AccessEntitlement` records are created with:

- `allocationId`, `allocationSnapshotId`
- `policyVersion`
- effective period and expiration
- non-transferable, non-cash semantics

Once an allocation period is finalized, entitlements do not disappear when token balances change later. Future periods use updated TWAB.

## Expiration and rollover

`expirationDays` drives policy-driven expiration. Default rollover: `NO_ROLLOVER`. Future-ready support for `LIMITED_ROLLOVER` and `FULL_ROLLOVER`.

## Anti-gaming controls

- TWAB over configurable window (default 30 days)
- Anti-gaming hooks via `evaluateAntiGaming()` (rapid cycling, duplicate custody sources)
- Suspicious behavior flags for downstream risk infrastructure

## Token authority boundary

| Action | Allowed |
| --- | --- |
| Read SR/MR balances | Yes |
| Compute TWAB | Yes |
| Issue Access entitlements | Yes (non-cash) |
| Mint/burn/transfer SR/MR | **No** |
| Set fiat peg | **No** |
| Modify blockchain consensus | **No** |

## Service API

`AccessAllocationEngine` methods:

- `calculateParticipantWeight(...)`
- `calculateCategoryAllocation(...)`
- `generateAllocationSnapshot(...)`
- `finalizeAllocationSnapshot(...)`
- `createEntitlements(...)`
- `previewUserAllocation(...)`

## Related documentation

- [ACCESS-15 Dual-Token Access Allocation](../economics/ACCESS_15_DUAL_TOKEN_ACCESS_ALLOCATION.md)
- [ACCESS Fabric Canonicalization](../architecture/ACCESS_FABRIC_CANONICALIZATION.md)
