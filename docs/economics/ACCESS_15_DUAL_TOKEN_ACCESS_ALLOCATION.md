# ACCESS-15 — Dual-Token Access Allocation Protocol

Classification: **engineering simulation** on current `main`.

## Economic thesis

SunRey Coin and MoonRey Coin participation in the dual economy can be converted into **recurring, non-cash, non-transferable Access entitlements** backed by **verified productive capacity**.

```
SUNREY_COIN + MOONREY_COIN + VERIFIED PRODUCTIVE CAPACITY = RECURRING HUMAN ACCESS
```

ACCESS-15 does **not**:

- create a third token or Access Coin
- promise fixed goods per token
- treat Access as a cash-equivalent balance
- use market price or fiat to normalize participation
- define a fixed SunRey/MoonRey peg

Canonical owners:

| Concern | Owner |
| --- | --- |
| Protocol types + engine | `packages/access-economy/src/dual-token-allocation/` |
| Entitlement semantics | `packages/access-fabric` |
| Verified capacity references | `packages/sunrey-access` / `packages/sunrey-access-fabric` |
| Native supply reads | `packages/sunrey-chain/src/economics` |
| BFF projection | `packages/human-access-economy` |

## Access epoch

Monthly epochs are supported first (`cadence: MONTHLY`). Architecture also accepts `WEEKLY` and `QUARTERLY` policy versions.

`AccessEpoch` states: `PLANNED → OPEN → SNAPSHOT_PENDING → ALLOCATING → FINALIZED → CLOSED` (or `FAILED`).

An epoch **never alters token supply**.

## Time-weighted average balance (TWAB)

For participant *i* over epoch duration *T*:

```
TWAB_SR_i = (1/T) ∫ SR_balance_i(t) dt
TWAB_MR_i = (1/T) ∫ MR_balance_i(t) dt
```

Implementation:

- piecewise-constant integration from balance checkpoints
- integer arithmetic only
- locked / escrowed treatment is policy-driven (default: liquid only — no double count)
- `TokenParticipationSnapshot` seals `sourceStateCommitment` from canonical supply/custody reads

## Normalization

Do not compare raw SR and MR directly.

```
s_i = TWAB_SR_i / Eligible_SR_Base
m_i = TWAB_MR_i / Eligible_MR_Base
```

Fixed-point:

```
s_i_scaled = (eligibleSunReyTwab * PARTICIPATION_SCALE) / sunReyEligibleBase
m_i_scaled = (eligibleMoonReyTwab * PARTICIPATION_SCALE) / moonReyEligibleBase
```

`PARTICIPATION_SCALE = 1_000_000`.

Eligible bases come from canonical supply / custody state — **not** market capitalization.

## Diminishing returns (anti-whale)

Versioned concave transform (V1):

```
g(x) = sqrt(x)
g_scaled(x_scaled) = isqrt(x_scaled * PARTICIPATION_SCALE)
```

Purpose: more tokens increase Access influence, but `2×` tokens ≠ `2×` shared capacity share. This is a **shared-capacity allocation mechanism**, not wealth punishment.

`ParticipationTransformPolicy` is versioned; production values remain unapproved.

## Dual participation weight

For participant *i* and category *c*:

```
W_i,c = alpha_c * g(s_i) + beta_c * g(m_i) + gamma_c * sqrt(g(s_i) * g(m_i))
```

Coefficients are basis points with invariant `alpha_c + beta_c + gamma_c <= 10_000`.

Simulation examples (`ENGINEERING_SIMULATION_PARAMETERS`):

| Category | Profile |
| --- | --- |
| EXPERIENCES | SunRey-heavy |
| AI_COMPUTE | MoonRey-heavy |
| ENERGY | strongly MoonRey-heavy |
| MOBILITY | balanced dual-economy |

## Capacity pool

`AccessCapacityPool` references verified capacity — it does not create a second productive authority.

Invariant:

```
allocatableCapacity <= verifiedGrossCapacity + fundedExternalCapacity + providerCommittedCapacity - reserved - policyReserved
```

Never invent capacity to satisfy token holders.

## Proportional allocation

For category *c* and epoch *e*:

```
A_i,c,e = C_c,e * W_i,c,e / SUM_j(W_j,c,e)
```

Integer floor plus **largest remainder** distribution with deterministic `subjectRef` tie-break.

Supports policy hooks: minimum / maximum allocation, category caps, geography restrictions, capacity floors, policy reserves.

## Entitlement output

Outputs are existing Access entitlements (examples: `VEHICLE_DAY`, `ROOM_NIGHT`, `MEAL_UNIT`, `GPU_HOUR`, `KWH`).

Properties:

- non-cash, non-withdrawable, non-transferable by default
- non-interest-bearing
- category-, epoch-, and subject-bound
- issued through canonical access-fabric semantics

## Three access modes

1. **INCLUDED_ACCESS** — recurring epoch allocation
2. **ACCESS_PLUS_TOKEN** — included allocation plus permitted SR/MR top-up via Exchange clearing
3. **TOKEN_ONLY_ACCESS** — additional capacity after included Access is exhausted

ACCESS-15 never converts SR to MR.

## Commitment architecture (optional)

`AccessCommitmentPolicy` kinds: `LIQUID`, `90_DAY_COMMITMENT`, `180_DAY_COMMITMENT`, `365_DAY_COMMITMENT`.

Multipliers are versioned, capped, fixed-point, and labeled simulation until governed. Not yield, not interest, not guaranteed appreciation.

## Anti-gaming

Protections (no identity scoring):

- wash / rapid transfer cycling detection
- self-transfer loop suspicion
- epoch-boundary spike detection
- duplicate custody source exclusion
- TWAB integration (no single end-of-month snapshot exploitation)

## Permanent invariants

Seventeen ACCESS-15 invariants are enforced in `packages/access-economy/src/dual-token-allocation/invariants.ts`, including:

- `ACCESS_ALLOCATION_NEVER_EXCEEDS_POOL`
- `NO_MARKET_PRICE_IN_PARTICIPATION_WEIGHT`
- `NO_ACCESS_CASH_BALANCE`
- `NO_CAPACITY_INVENTED_BY_ALLOCATION`
- `ALLOCATION_IS_DETERMINISTIC`

## BFF / SDK surfaces (read-only / preview)

| Method | Path |
| --- | --- |
| GET | `/api/v1/access/epoch` |
| GET | `/api/v1/access/participation` |
| GET | `/api/v1/access/allocation` |
| GET | `/api/v1/access/allocation/categories` |
| GET | `/api/v1/access/allocation/history` |
| POST | `/api/v1/access/allocation/preview` |

User-safe explanation (no human score):

> Your Access is based on your time-weighted SunRey and MoonRey participation and the capacity available this period.

## Simulation parameters

Demo participants (100 SR / 100 MR style):

| Participant | SR | MR |
| --- | ---: | ---: |
| A | 100 | 100 |
| B | 1000 | 10 |
| C | 10 | 1000 |
| D | 400 | 400 |

Stress tests: 1,000 and 100,000 synthetic participants (deterministic LCG seed).

## Known open economic questions

- Production coefficient governance and counsel review for category weights
- Locked / escrowed TWAB inclusion policy per jurisdiction
- Cross-epoch rollover and entitlement expiry harmonization with ACCESS-04 replenishment
- Live custody balance history port wiring (currently simulation checkpoints)
- Provider attestation freshness gates for capacity pools in production

## Production posture

```
ENVIRONMENT=simulation
PRODUCTION_READY=false
PRODUCTION_ACTIVE=false
LIVE_CONNECTIVITY_ENABLED=false
```
