# ACCESS-22: Full Dual-Economy Access Economic Qualification

Classification: **engineering simulation** on current `main`. This document records
ACCESS-22 qualification results for the SunRey Human Access Economy. It is not
legal advice, not macroeconomic proof, and does not activate production.

## Mission

ACCESS-22 performs the most rigorous qualification yet of the entire SunRey
Human Access Economy dual-economy mechanism. It tests whether the economic
mechanism survives scale, scarcity, abundance, token volatility, provider
failure, oracle failure, liquidity shocks, whale behavior, Sybil behavior, mass
redemptions, and automation growth — using the canonical laboratory at
`packages/sunrey-economics/src/dual-economy-access-stress`.

Simulation results are **not forecasts**.

## Architecture

```
Human Information (HIN) ──► SunRey holdings ──┐
                                              ├──► ACCESS-15 allocation formula
Productive Contributions ──► MoonRey holdings ┘         │
                                                      ▼
Access capacity ◄── ACCESS-16 solvency ◄── ACCESS-17 runtime
       │
       ├── ACCESS-18 HIN participation (simulated)
       ├── ACCESS-19 productive bridge (Chunk 75 macro)
       ├── ACCESS-20 Personal Economy Agent (proposal-only)
       └── ACCESS-21 provider sandbox (ACCESS-14 adapters)
```

Canonical owners consumed (never reimplemented):

| Plane | Owner |
|-------|-------|
| Dual-economy macro | `packages/sunrey-economics` (Chunk 75) |
| Access allocation scenarios | `packages/sunrey-economics/src/access-economy` (ACCESS-13) |
| Economic stress bridge | `packages/sunrey-economics/src/stress` (Chunk 76) |
| Entitlement evaluation | `packages/access-fabric` |
| Provider redemption | `packages/access-economy/src/providers` (ACCESS-14) |
| Evidence | `packages/evidence` |

ACCESS-22 extends the existing laboratory. It does **not** create a second
simulation system.

## Formulas

### Dual-economy access weight (ACCESS-15 allocation)

For participant `i` with SunRey holdings `SR_i` and MoonRey holdings `MR_i`
(integer minor units):

```
w_sr(i) = sqrt( SR_i / max(SR) ) × 10_000
w_mr(i) = sqrt( MR_i / max(MR) ) × 10_000
w(i)    = w_sr(i) + w_mr(i) + dual_bonus(i)
```

where `dual_bonus(i) = 1_500 bps` when both `SR_i > 0` and `MR_i > 0`, else `0`.

Allocation:

```
alloc(i) = floor( w(i) / Σ w(j) × allocatable_capacity )
```

with a small-holder floor of `1` unit when capacity permits, and deterministic
tie-breaking when rounding would overshoot capacity.

**Token market price does not enter `w(i)`.** Price paths are observed for
liquidity diagnostics and invariants only.

### Capacity

```
allocatable_capacity = f(macro_productive_output, shocks, provider_state, oracle_state)
Σ alloc(i) ≤ allocatable_capacity
```

### Solvency

```
confirmed_external_liability ≤ funded_reserve
```

## Deterministic scenario framework

Every scenario includes:

| Field | Description |
|-------|-------------|
| `scenarioId` | Stable ACCESS22-* identifier |
| `seed` | Deterministic RNG seed |
| `policyVersions` | Pinned allocation/solvency/entitlement policy refs |
| `participantCount` | Requested population |
| `providerCount` | Simulated provider cardinality |
| `capacityState` | Allocatable units and category breakdown |
| `tokenDistribution` | Generated per participant at runtime |
| `tokenPricePath` | SR/MR price observation (not allocation input) |
| `reserveState` | Coverage and refund-wave parameters |
| `oracleState` | Degradation, staleness, controller concentration |
| `providerState` | Outage, collapse, phantom-capacity flags |
| `exchangeState` | Halt, illiquidity, spread |
| `expectedInvariants` | All 17 formal property invariants |

## Scale levels

| Level | Effective participants | Sampled participants | CI default |
|-------|------------------------|----------------------|------------|
| `SCALE_1K` | 1,000 | 1,000 | yes |
| `SCALE_100K` | 100,000 | 100,000 | heavy only |
| `SCALE_1M` | 1,000,000 | 50,000 | heavy only |
| `SCALE_10M_SAMPLED` | 10,000,000 | 25,000 | heavy only |
| `SCALE_100M_AGGREGATE` | 100,000,000 | 5,000 | heavy only |

Heavy scales run via `npm run stress:access22-heavy` (not default CI).

## Scenarios (45)

| ID | Title |
|----|-------|
| ACCESS22-01 | Baseline balanced economy |
| ACCESS22-02 | Rapid human adoption |
| ACCESS22-03 | Rapid productive automation |
| ACCESS22-04 | Extreme compute abundance |
| ACCESS22-05 | Energy scarcity |
| ACCESS22-06 | Vehicle shortage |
| ACCESS22-07 | Hotel shortage |
| ACCESS22-08 | Food shortage |
| ACCESS22-09 | Mass access redemption |
| ACCESS22-10 | SR price +500% |
| ACCESS22-11 | SR price −80% |
| ACCESS22-12 | MR price +500% |
| ACCESS22-13 | MR price −80% |
| ACCESS22-14 | Both tokens crash |
| ACCESS22-15 | Both tokens rapidly appreciate |
| ACCESS22-16 | Mass fiat → SR purchase |
| ACCESS22-17 | Mass fiat → MR purchase |
| ACCESS22-18 | Mass token sell-off |
| ACCESS22-19 | Whale concentration |
| ACCESS22-20 | Sybil splitting |
| ACCESS22-21 | Snapshot manipulation attack |
| ACCESS22-22 | Provider collapse |
| ACCESS22-23 | Top provider outage |
| ACCESS22-24 | Exchange illiquidity |
| ACCESS22-25 | Exchange halt |
| ACCESS22-26 | Custody outage |
| ACCESS22-27 | Ledger failure |
| ACCESS22-28 | FX shock |
| ACCESS22-29 | Access reserve depletion |
| ACCESS22-30 | Refund wave |
| ACCESS22-31 | Oracle degradation |
| ACCESS22-32 | Oracle collusion / controller concentration |
| ACCESS22-33 | Phantom capacity attack |
| ACCESS22-34 | Double productive claim |
| ACCESS22-35 | Human data contribution surge |
| ACCESS22-36 | Low-quality / fraudulent data surge |
| ACCESS22-37 | Mass consent revocation |
| ACCESS22-38 | Productive contribution surge |
| ACCESS22-39 | Autonomous vehicle abundance |
| ACCESS22-40 | Post-scarcity multi-category economy |
| ACCESS22-41 | Multi-provider Japan trip failure |
| ACCESS22-42 | Global demand spike |
| ACCESS22-43 | Geographic capacity imbalance |
| ACCESS22-44 | Policy change between epochs |
| ACCESS22-45 | Policy change during open reservation |

## Core metrics

Measured per epoch and aggregated:

- Access fill rate
- Access allocation concentration (HHI)
- Capacity utilization
- Unmet demand
- Solvency ratio by denomination
- External provider liability
- Native capacity share
- Provider concentration
- Oracle concentration
- SR holder concentration
- MR holder concentration
- Dual-holder participation
- Redemption completion
- Refund rate
- Settlement failure count
- Allocation volatility
- Epoch-to-epoch access volatility
- Token velocity (observed price-change proxy)
- Exchange liquidity
- Reserve coverage
- Capacity growth
- Productive abundance index

No human desirability scores are computed.

## Mechanism quality tests

| Test | Requirement |
|------|-------------|
| Diminishing returns | Prevent monopoly of shared access |
| Large-holder marginal benefit | Meaningful but not unbounded |
| Small-holder rounding | Non-zero floor when capacity permits |
| Dual-holder bonus | Bounded, sensible vs single-asset holders |
| Capacity expansion | Increases human access |
| Capacity contraction | Reduces promises before insolvency |
| Price independence | Price changes do not alter allocation |
| Data independence | Data quantity does not multiply access |
| Productive bridge | Productive growth does not auto-mint access |
| No access minting | Access does not mint SR/MR |

## Formal property invariants

| ID | Statement |
|----|-----------|
| `SUM_ACCESS_ALLOCATIONS_LTE_ALLOCATABLE_CAPACITY` | Σ allocation ≤ allocatable capacity |
| `CONFIRMED_EXTERNAL_LIABILITY_LTE_FUNDED_RESERVE` | External liability ≤ funded reserve |
| `NO_NATIVE_ASSET_SUPPLY_CREATED_BY_ACCESS` | No SR/MR minted by access activity |
| `NO_FIXED_SR_MR_RATIO` | No fixed SR/MR ratio |
| `NO_FIXED_TOKEN_GOODS_REDEMPTION` | No fixed token-goods redemption price |
| `NO_HUMAN_WORTH_SCORE` | No human-worth score |
| `NO_DATA_TO_ACCESS_DIRECT_MULTIPLIER` | No data→access multiplier |
| `NO_PRODUCTIVE_DOUBLE_COUNT` | No productive double-count |
| `NO_DOUBLE_REDEMPTION` | No double redemption |
| `NO_DOUBLE_SETTLEMENT` | No double settlement |
| `NO_DOUBLE_ENTITLEMENT_CONSUMPTION` | No double entitlement consumption |
| `NO_PROVIDER_CAPACITY_OVERSELL` | No provider oversell |
| `NO_AI_SELF_APPROVAL` | Agent cannot self-approve |
| `NO_SIMULATION_ACTIVATES_PRODUCTION` | Simulation stays simulation |
| `NO_PRICE_FEEDBACK_TO_ISSUANCE` | Price does not feed issuance |
| `NO_ACCESS_FEEDBACK_TO_NATIVE_MINT` | Access does not mint native assets |
| `EVERY_CONSEQUENTIAL_STATE_RECONSTRUCTABLE` | Evidence chain reconstructs state |

## Economic stability classifications

Engineering diagnostics (not forecasts):

`HEALTHY_SIMULATION`, `CAPACITY_STRESS`, `ACCESS_ALLOCATION_STRESS`,
`PROVIDER_CONCENTRATION`, `TOKEN_CONCENTRATION`, `LIQUIDITY_STRESS`,
`SOLVENCY_STRESS`, `ORACLE_DEPENDENCY`, `RESERVE_STRESS`, `DEMAND_IMBALANCE`,
`PRODUCTIVE_CONCENTRATION`, `ACCESS_VOLATILITY`, `SYSTEMIC_PROVIDER_FAILURE`

## 100 SR + 100 MR benchmark

Permanent participant `benchmark-100sr-100mr` runs through:

- Baseline
- Rapid automation
- Energy shortage
- 10× user growth
- 10× capacity growth (post-scarcity)
- Token price crash
- Token price surge

**Result:** token market price alone does not directly change allocation.
Productive capacity and relative participation do.

## Post-scarcity test

Scenario `ACCESS22-40-post-scarcity-multi-category` models:

| Category | Capacity multiplier |
|----------|-------------------|
| AI compute | +100× |
| Vehicles | +50× |
| Food | +20× |
| Energy | +30× |
| Housing | +10× |

**Result:** allocatable access rises without printing access money, automatic
SR issuance, automatic MR issuance, or fixed-price guarantees.

## Agent stress

Personal Economy Agent tested under market crash, token crash, access shortage,
liquidity shortage, two vacation goals, high token concentration, and provider
outage.

**Result:** agent may recommend; agent must not self-execute (`selfExecutions = 0`).

## Qualification results

Run: `sunrey-economics access22 qualify --seed 22022`

| Metric | Result |
|--------|--------|
| Scenarios | 45 / 45 pass at `SCALE_1K` |
| Invariants | 17 / 17 hold |
| Mechanism tests | pass |
| Benchmark tests | pass |
| Agent stress | pass |
| Post-scarcity | pass |
| Monte Carlo (seeded) | 0 violations |
| ACCESS-13 regression | pass |
| Chunk 76 access campaign | pass |

### Engineering qualification flag

When all engineering tests pass:

```
ACCESS_DUAL_ECONOMY_ENGINEERING_QUALIFIED=true
```

This flag does **not** change:

- `PRODUCTION_READY`
- `PRODUCTION_ACTIVE`
- `LIVE_CONNECTIVITY_ENABLED`
- Economic production activation

## Failure modes observed (simulation)

| Mode | Behavior |
|------|----------|
| Capacity exhaustion | Deterministic refusal; no oversell |
| Provider collapse | Capacity contraction; systemic failure classification |
| Oracle staleness | Fail-closed; capacity not assumed |
| Exchange halt | No fallback pricing or peg |
| Reserve depletion | Solvency stress classification; liability capped at reserve |
| Whale concentration | Diminishing returns limit allocation share |
| Sybil splitting | No aggregate weight gain vs honest distribution |

## Parameter sensitivities

- **Dual-holder bonus (1_500 bps):** increases dual-holder share modestly; does not dominate whale weight.
- **Small-holder floor (1 unit):** prevents zeroing when capacity ≥ participant count.
- **Provider outage (−30% capacity):** reduces allocatable units before allocation.
- **Oracle degradation (−5% capacity):** conservative fail-closed haircut.

## Known unknowns

- Real-world holder distribution vs simulated Pareto/log-normal mixes
- Cross-corridor regulatory variation in access refusal messaging
- Live provider SLA adherence under compound stress
- Long-horizon token velocity effects on participation (observed only, not modeled as allocation input)

## Production blockers

1. Certified provider inventory feeds (Chunk 128 gate)
2. Counsel review per corridor (`RESEARCH_REQUIRED` corridors stay disabled)
3. Live Exchange and custody bindings under signed Execution Authority
4. Production economic activation firewall (Chunk 143) — remains inactive
5. Human review for `services/accounts` mutations

## Recommended economic research

1. Empirical calibration of diminishing-returns curvature
2. Cross-corridor elasticity between productive shocks and fill rates
3. Dual-holder bonus sensitivity under shifting SR/MR mixes
4. Provider concentration diagnostics vs certified admission rates
5. Exchange liquidity stress interaction with redemption completion at 100k+ scale

## Remaining regulatory requirements

- Consumer-protection review of refusal reason codes
- Data-protection review of stress evidence at scale
- Non-discrimination review of policy priority bands
- Confirmation access entitlements are not payment instruments per corridor

## Remaining provider dependencies

- Chunk 128 provider certification
- Per-location inventory freshness SLAs
- Settlement rails on canonical ledger/custody
- ACCESS-14 sandbox adapters for multi-leg travel

## Commands

```bash
# CI qualification (SCALE_1K, 45 scenarios)
sunrey-economics access22 qualify --seed 22022

# Smoke campaign (7 scenarios)
sunrey-economics access22 campaign --smoke

# Heavy scale qualification (not CI)
npm run stress:access22-heavy

# Demo
npm run demo:sunrey-dual-economy-access-stress
```

## What this document does not claim

- Proven macroeconomic success
- Guaranteed stability
- Guaranteed token appreciation
- Post-scarcity achieved in production

---

*Generated by ACCESS-22 qualification laboratory. Engineering simulation only.*
