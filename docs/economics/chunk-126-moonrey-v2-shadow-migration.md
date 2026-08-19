# Chunk 126 — MoonRey Governed Value V2 Shadow Evaluation, Migration, and Economic Stress Hardening

Canonical owner: `packages/sunrey-chain`.

Capability `moonrey-v2-shadow-economics` is `IMPLEMENTED` at
`packages/sunrey-chain/src/productive/policy-governance/shadow-economics`.

This chunk is a simulation-only comparison, migration-readiness, and
adversarial validation layer. It does not delete V1, does not activate
V2 in production, and does not connect live providers.

## Path identities

| Identity | Meaning |
| --- | --- |
| `LEGACY_ENGINEERING_SIMULATION_V1` | Chunk 44 formula: normalized quantity × category / claim / quality |
| `GOVERNED_PRODUCTIVE_VALUE_SIMULATION_V2` | Canonical measurement → event → attribution → Productive Value Function → GPUV → governed shadow conversion → MoonRey candidate |
| Production path | `UNCONFIGURED` |

V2 is never called production merely because the code exists.

## Shadow evaluation

`MoonReyEconomicShadowEvaluator` evaluates V1 and V2 on the same
underlying verified economic event where possible. It does not
double-issue. V2 shadow evaluation does not mutate canonical MoonRey
supply.

`MoonReyValuePathComparison` records scenario, event, and contribution
identity, category, claim type, canonical measurement, both policy
versions, V1 quantity, V2 GPUV, V2 conversion policy, V2 MoonRey
candidate, deltas, attribution share, caps, reason codes, warnings,
and `supplyMutated: false`.

Where V1 or V2 deliberately cannot value a class or state, the
comparison reports that explicitly. Values are not fabricated to force
numerical coverage. Capacity and reserve claims remain unvalued.

## Analysis

Simulation reports cover value/issuance by category, object,
controller, geography, source/provider class, claim type, and
realization state, plus top controller, object, and category
concentration. They are not market forecasts.

Supply-pressure comparison reports V1 issuance pressure and V2
candidate issuance pressure under identical synthetic scenario sets.
Ranges are observations, not promises. There are no future price
projections.

## Hardening

Adversarial catalog: fake scarcity, fake utilization, duplicate
claims, cross-category / object / controller relabeling, batch and
time-window splitting, provider collusion, single-provider dominance,
stale and conflicting references, unit-alias manipulation,
normalization-version mismatch, attribution bypass, value-factor and
conversion cap bypass, revaluation replay, and settlement replay.

Documented invariants:

- lower attribution share cannot produce greater attributed value
- lower verification quality cannot increase value where quality is monotonic
- staler evidence cannot increase freshness
- a stricter cap cannot increase output
- replaying the same event cannot increase canonical attribution
- shadow evaluation cannot change supply
- production inactive remains true

Scarcity and geography are bounded context factors. This chunk does
not claim they are universally monotonic.

Sensitivity analysis varies bounded simulation factors across approved
ranges and flags extreme output jumps. Feedback-loop detection rejects
MoonRey-price → value → issuance → price and issuance-quantity →
scarcity → value → issuance.

## Migration

`MoonReyV2MigrationReadinessReport` records engineering gates.
`productionParametersConfigured` remains `false`.
`productionMigrationApproved` remains `false`.

Passing tests does not activate V2. Production activation requires
later explicit human/governance authorization and configured
production economics. There is no automatic cutover path.

## Legacy V1

V1 remains `LEGACY_ENGINEERING_SIMULATION_V1`. It is not deleted and
is not production economics. Deprecation is a future governance action
with no automatic removal date.

Historic V1 receipts remain reproducible. V2 receipts retain
normalization version, event identity version, attribution policy,
value policy, and conversion policy. Later policy changes do not
rewrite sealed history.

## Demo

```bash
npm run demo:moonrey-v2-shadow-economics
```

```text
SHADOW_MODE=true
CANONICAL_SUPPLY_MUTATED=false
V2_PRODUCTION_ACTIVE=false
LEGACY_V1_REMOVED=false
PRODUCTION_MIGRATION_APPROVED=false
```

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains false.
Do not create `packages/moonrey-shadow`, `packages/value-migration`,
`packages/moonrey-v2-engine`, `packages/shadow-economics`, or
`packages/moonrey-cutover`.
