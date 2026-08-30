# ACCESS-16 — Access Capacity Reserve and Solvency

ACCESS-16 makes the SunRey Human Access Economy economically solvent. SunRey must
never promise more redeemable Access than it either possesses as committed native
productive capacity, or can actually fund through approved external-provider
settlement reserves.

**Core principle:** Access Allocation ≠ Provider Funding.

If a user holds five room-night entitlements and the room is supplied by Expedia,
SunRey must possess sufficient settlement capacity to pay Expedia. Unfunded
entitlement liabilities are forbidden.

Production remains off. All values in this document are simulation and
engineering-governance only unless explicitly activated through governed
production ceremony.

## Canonical owners

ACCESS-16 does not create a second Ledger. Reserve state is reference and
aggregation only. Authoritative money remains on:

| Owner | Role |
|-------|------|
| `packages/ledger` | Canonical ledger |
| `packages/treasury` | Protocol Treasury |
| `packages/custody` | Custody settlement |
| `packages/payments` | External provider settlement rails |
| `packages/sunrey-exchange` | Exchange settlement |

Implementation: `packages/access-economy/src/solvency/`.

## Capacity tranche model

Each `AccessCapacityPool` traces allocatable capacity to one or more backing
tranches. Tranches are never merged silently.

| Tranche kind | Meaning |
|--------------|---------|
| `NATIVE_COMMITTED_CAPACITY` | Committed MoonRey productive capacity with provider agreement |
| `EXTERNAL_FUNDED_CAPACITY` | Fiat-funded external provider capacity |
| `SPONSORED_CAPACITY` | Third-party sponsored settlement |
| `EMPLOYER_FUNDED_CAPACITY` | Employer-funded benefit capacity |
| `GOVERNMENT_FUNDED_CAPACITY` | Government-funded benefit capacity |
| `PROMOTIONAL_PROVIDER_CAPACITY` | Promotional provider capacity |

Native MoonRey productive capacity does not require the same fiat reserve
treatment when the provider explicitly accepts permitted native settlement.
Still required: capacity commitment, consideration terms, provider agreement,
delivery evidence. MoonRey productive issuance is never automatic provider
payment.

## Provider settlement liability

`ProviderSettlementLiability` records external provider obligations:

| Field | Description |
|-------|-------------|
| `providerRef` | Provider identifier |
| `reservationId` | Linked reservation |
| `currency` | Denomination (isolated) |
| `quotedAmount` | Quoted minor units |
| `reservedAmount` | Reserved minor units |
| `maximumExposure` | Maximum exposure cap |
| `expiration` | Liability expiry |
| `settlementState` | Lifecycle state |
| `evidenceRefs` | Supporting evidence |

Lifecycle:

```
QUOTED → RESERVED → COMMITTED → CAPTURED → REFUNDED
              ↘ RELEASED
COMMITTED → DEFAULT_REVIEW → RELEASED | CAPTURED
```

## Solvency equations

Solvency is computed per denomination **d** across dimensions:

- currency
- jurisdiction
- provider
- category
- epoch

**Denominations are never combined** unless an actual quoted conversion exists.
USD, SAR, EUR, SR, and MR each maintain independent slices.

For denomination **d**:

```
SolvencyRatio_d = AvailableSettlementReserve_d / CommittedExternalLiability_d
```

Where:

- `AvailableSettlementReserve_d` — sum of `AVAILABLE` reserve positions in
  denomination d for the slice (aggregated from canonical owners)
- `CommittedExternalLiability_d` — sum of `RESERVED` and `COMMITTED` external
  liabilities in denomination d for the slice

Policy may define `targetSolvencyRatio >= 1.0` in simulation. Production
targets remain unconfigured.

**Minimum invariant:** confirmed liability must never exceed available reserve.

Reserve position states (reference only, not authoritative balances):

- `AVAILABLE`
- `RESERVED`
- `COMMITTED`
- `CAPTURED`
- `RELEASED`

## Risk haircuts (simulation only)

Versioned policy haircuts may reduce effective allocatable external capacity:

```
EffectiveAllocatableExternalCapacity = FundedCapacity × ∏(1 - haircut_i)
```

Supported haircut kinds:

- provider quote volatility
- FX exposure
- cancellation risk
- refund risk
- provider failure
- settlement delay

No arbitrary production defaults.

## Pool admission

A capacity tranche enters an Access pool only when all of the following hold:

1. Capacity exists (`allocatableUnits > 0`)
2. Price / settlement terms exist where required
3. Funding reserve exists where required (external tranches)
4. Provider capability permits booking
5. Policy permits jurisdiction
6. Expiry is valid
7. Evidence is current

Admission fails closed.

## Permanent invariants

| ID | Statement |
|----|-----------|
| `NO_UNFUNDED_EXTERNAL_ACCESS` | External access is never promised without funded settlement |
| `CONFIRMED_EXTERNAL_LIABILITY_LE_RESERVE` | Confirmed liability ≤ available reserve per denomination |
| `NATIVE_CAPACITY_NOT_TREATED_AS_FIAT_RESERVE` | Native capacity is not conflated with fiat reserve |
| `NO_FAKE_COMMON_NUMERAIRE` | No blended USD/EUR/SR/MR numeraire without quoted conversion |
| `NO_DOUBLE_RESERVED_PROVIDER_LIABILITY` | No double reservation for the same provider obligation |
| `FAILED_BOOKING_RELEASES_RESERVE` | Failed booking releases reserved settlement |
| `REFUND_RESTORES_ELIGIBLE_RESERVE` | Refund restores eligible reserve |
| `NO_ENTITLEMENT_ISSUANCE_BEYOND_BACKED_POOL` | Entitlements never exceed backed pool capacity |
| `NO_TREASURY_MINT_FROM_ACCESS` | Access never mints treasury reserves |
| `NO_CUSTOMER_FUNDS_USED_AS_PROTOCOL_RESERVE` | Customer funds are never protocol reserve |

## Stress scenarios

Simulation proves fail-closed behavior before insolvency:

| Scenario | Expected behavior |
|----------|-------------------|
| 10× redemption spike | Blocks when reserve exhausted |
| Provider price +30% | Refuses unfunded liability |
| FX move | Denominations remain isolated |
| Refund wave | Refund lifecycle restores eligibility |
| Provider failure | Consumer posture: Temporarily unavailable |
| Reserve depletion | Refuses new external liability |
| Settlement delay | Haircut reduces effective capacity |
| Hotel shortage | Temporarily unavailable when allocatable = 0 |
| Travel surge | Limited when utilization high |
| Mixed native/external | Native not treated as fiat reserve |

## Consumer BFF surface

User surfaces never expose internal treasury detail. The BFF may expose:

- **Available**
- **Limited**
- **Temporarily unavailable**

Reserve balances, solvency ratios, and provider settlement positions remain
internal.

## Validation

```bash
npm test -- packages/access-economy/src/solvency/access-16.test.ts
npm run ci
```

Tests: `packages/access-economy/src/solvency/access-16.test.ts`,
`tests/access-16-solvency.test.ts`.
