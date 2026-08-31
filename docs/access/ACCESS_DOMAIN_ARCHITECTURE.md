# SunRey Access Domain Architecture

**ACCESS Wave 1 / Prompt 28** — foundational backend domain models for governed
productive-capacity access.

## What Access Is

Access is a **governed right to use real productive capacity**, including:

- Mobility
- Lodging
- Experiences
- Food
- AI / compute
- Energy
- Transportation
- Robotics
- Future productive capacity

Access records are **unitized**. A quantity always names an explicit unit such
as `VEHICLE_DAY`, `ROOM_NIGHT`, or `GPU_HOUR`. The domain never stores bare
numbers without unit context.

## What Access Is Not

Access is **not**:

- A third currency
- Cash or a bank balance
- A stablecoin
- A user deposit
- A guaranteed fiat redemption instrument
- SunRey Coin or MoonRey Coin

SunRey Coin and MoonRey Coin ownership may influence Access allocation in later
prompts, but **Prompt 28 defines domain models only**. No SR/MR allocation
formula is implemented here.

### Access Entitlement

```
Access Entitlement ≠ Cash
Access Entitlement ≠ Token
Access Entitlement ≠ Deposit
Access Entitlement ≠ Guaranteed Redemption
```

Every `AccessEntitlement` carries explicit `nonCash` boundary flags that must
remain false for monetary interpretations.

## Canonical Owner

| Concern | Location |
|--------|----------|
| Wave 1 domain models | `packages/access-economy/src/domain/` |
| Public export | `@solstice/access-economy/domain` |
| Entitlement engine | `packages/access-fabric` |
| Verified capacity / scarcity | `packages/sunrey-access` |
| Chain commitments | `packages/sunrey-chain/src/access` |
| Evidence sealing | `packages/evidence` |
| Consumer projection | `packages/human-access-economy` |

Do not create parallel `packages/access-*` owners.

## Domain Model

### AccessCategory

Governed productive-capacity taxonomy:

`MOBILITY`, `LODGING`, `EXPERIENCES`, `FOOD`, `AI_COMPUTE`, `ENERGY`,
`TRANSPORTATION`, `ROBOTICS`, `OTHER`

Each category supports metadata: `id`, `name`, `description`, `enabled`,
`defaultUnit`, `allocationPolicyId`, `fundingPoolId`, `createdAt`, `updatedAt`.

Categories do not embed commercial provider identities.

### AccessUnit

Canonical units include:

`VEHICLE_HOUR`, `VEHICLE_DAY`, `ROOM_NIGHT`, `ADMISSION`, `MEAL`,
`FOOD_BASKET`, `GPU_HOUR`, `INFERENCE_UNIT`, `KWH`, `ROBOT_HOUR`, `RIDE`,
`TRIP`, `OTHER`

### AccessProduct

Catalog offering: category, name, unit, optional provider references,
geography, terms reference, metadata. Provider-agnostic by design.

### AccessCapacity

Real available capacity for a period:

- `totalUnits`, `reservedUnits`, `consumedUnits`, `availableUnits`
- `capacitySource` (e.g. `TREASURY_FUNDED`, `NATIVE_PRODUCTIVE_CAPACITY`)
- `evidenceReference` to the canonical Evidence Vault

Funding orchestration is out of scope for Prompt 28.

### AccessEntitlement

Non-cash right held by a user:

- `allocatedUnits`, `reservedUnits`, `consumedUnits`, `remainingUnits`
- Status lifecycle: `PENDING`, `ACTIVE`, `PARTIALLY_USED`, `EXHAUSTED`,
  `EXPIRED`, `CANCELLED`

### AccessAllocation

Records **why** an entitlement was created. Prompt 29 will populate allocation
inputs and SR/MR formulas. Prompt 28 stores policy references and evidence only.

### AccessQuote

Structural quote model with provider amounts in integer minor units. No live
provider quoting in Prompt 28.

### AccessReservation

Holds reserved entitlement units and optional funding hold. No provider
reservation API in Prompt 28.

### AccessRedemption

Fulfillment record. Failed bookings must be capable of reversing entitlement
consumption (`REVERSED` status).

### AccessSettlement

Canonical settlement breakdown:

- `providerAmount`, `accessPoolContribution`, `userFiatContribution`
- `tokenConversionContribution` defaults to **zero** at launch
- Payment execution is Prompt 35

### AccessTransaction

Lifecycle anchor linking quote, reservation, redemption, and settlement.
Full state-machine orchestration is Prompt 37.

## Geography

Access reuses governed geographic references via `AccessGeography`:

| Scope | Meaning |
|-------|---------|
| `GLOBAL` | Worldwide |
| `COUNTRY` | ISO 3166-1 alpha-2 jurisdiction |
| `REGION` | Opaque region reference |
| `CITY` | Opaque city reference |
| `FACILITY` | Opaque facility reference |
| `COORDINATE_BOUNDED` | Privacy-safe location commitment — never raw lat/long |

## Provider Identity

Domain records reference providers through opaque `ProviderRef` values
(`aceprv_*`). Provider catalog slugs are translated at adapter boundaries in
`packages/access-economy/src/providers`. Domain models do not import
provider-specific SDK classes.

## Evidence / Audit

Lifecycle records carry `AccessEvidenceRef` (`acew1ev_*`) references suitable
for sealing in `packages/evidence`. Access does not duplicate the Evidence
Vault or maintain a parallel audit chain.

Evidence kinds expected in later prompts:

- Capacity evidence
- Allocation evidence
- Quote evidence
- Provider booking evidence
- Fulfillment evidence
- Settlement evidence

## Business Invariants

| Invariant | Rule |
|-----------|------|
| Non-negative units | All unit counters `>= 0` |
| Entitlement balance | `reserved + consumed <= allocated` |
| Remaining units | `remaining = allocated - reserved - consumed` |
| Capacity balance | `reserved + consumed <= total` |
| Available capacity | `available = total - reserved - consumed` |
| Non-negative amounts | Quote and settlement minor-unit fields `>= 0` |
| Non-cash entitlement | `nonCash` flags must remain false for monetary claims |
| Token conversion | `tokenConversionContribution` defaults to `0` |

## Domain Services (Prompt 28)

Minimal read interfaces only — no booking or payment execution:

- `AccessCatalogService` — `getCategories()`, `getProducts()`
- `AccessCapacityService` — `getCapacity(...)`
- `AccessEntitlementService` — `getEntitlements(userId)`
- `AccessTransactionService` — `getTransaction(transactionId)`

Implemented as in-memory simulation helpers in `services.ts` for tests and
future application facades.

## Authority Boundaries

| Component | May change financial state? |
|-----------|----------------------------|
| Access domain (Prompt 28) | No |
| Compliance Kernel | Decides via six proofs |
| Execution Authority | Required for ledger posting |
| Evidence Vault | Seals all outcomes |
| Exchange / custody | Separate owners |

## Relationship to Earlier ACCESS Chunks

Earlier ACCESS chunks (`ACCESS-01` rights/intents, `ACCESS-08` chain
commitments, `ACCESS-15` dual-token allocation simulation) remain in place.
Prompt 28 adds the **Wave 1 lifecycle vocabulary** without replacing those
owners.

Import guidance:

- Lifecycle orchestration models: `@solstice/access-economy/domain`
- Legacy `AccessEntitlement` (rights/basis model): `@solstice/access-economy`

## Prompt 29 Recommendation

Prompt 29 should:

1. Implement SR/MR allocation formulas against `AccessAllocation`
2. Populate `inputSnapshotReference` from token participation snapshots
3. Issue `AccessEntitlement` records from verified `AccessCapacity`
4. Bind allocation policies per `AccessCategory.allocationPolicyId`
5. Continue to treat entitlements as non-cash and non-transferable
6. Seal allocation decisions in the Evidence Vault before entitlements activate

Do not add provider integrations, payment rails, or BFF endpoints in Prompt 29
unless explicitly scoped.
