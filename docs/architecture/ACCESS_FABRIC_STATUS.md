# SunRey Human Access Economy — ACCESS-13R / ACCESS-14 / ACCESS-17 status
# SunRey Human Access Economy — ACCESS-13R / ACCESS-14 / ACCESS-15 status

Classification: engineering simulation on current `main`.

## Engineering state

| State | Value | Who may set it |
| --- | --- | --- |
| `ACCESS_FABRIC_CODE_COMPLETE_CANDIDATE` | **true** (qualification passing on current main) | Engineering, from a passing qualification run |
| `PRODUCTION_READY` | false | Humans plus external gates |
| `LIVE_CONNECTIVITY_ENABLED` | false | Signed provider contracts |
| `PRODUCTION_ACTIVE` | false | Governance authorization ceremony |

A passing qualification run does **not** move any production state. `ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains `false`.

## Canonical ownership (current main)

| Capability | Canonical owner |
| --- | --- |
| ACCESS-01 domain vocabulary and registry | `packages/access-economy` |
| ACCESS-04 entitlements / Personal Access Envelope | `packages/access-fabric` |
| ACCESS-05 verified capacity state | `packages/sunrey-access` |
| ACCESS-06 scarcity / allocation intelligence | `packages/sunrey-access` |
| ACCESS-03 productive capacity discovery | `packages/sunrey-access-fabric` |
| ACCESS-07 capacity reservation (Kernel-gated) | `packages/access-fabric` |
| ACCESS-08 chain access-right commitments | `packages/sunrey-chain/src/access` |
| ACCESS-09 exchange capacity markets / clearing | `packages/sunrey-exchange/src/access-fabric` |
| ACCESS-10/11 experience composer + completion | `packages/sunrey-access-fabric` + `packages/sunrey-chain/src/access-fabric` |
| ACCESS-13 qualification laboratory | `packages/sunrey-economics/src/access-economy` |
| ACCESS-14 provider network + redemption engine | `packages/access-economy/src/providers/` |
| ACCESS-17 canonical redemption orchestrator | `packages/human-access-economy/src/canonical-redemption-orchestrator.ts` |
| ACCESS-15 dual-token access allocation protocol | `packages/access-economy/src/dual-token-allocation/` |
| Consumer BFF projection | `packages/human-access-economy` → `services/api/src/consumer/access.ts` |

## Data flow (simulation)

```
Consumer intent
  → Personal Economic Graph / Agent (proposal only)
  → AccessIntent (access-economy domain registry)
  → entitlement evaluation (access-fabric)
  → productive capacity discovery (sunrey-access-fabric)
  → scarcity / allocation (sunrey-access)
  → capacity reservation + Kernel authority (access-fabric)
  → Exchange clearing where priced (sunrey-exchange/access-fabric)
  → chain access commitment + completion evidence (sunrey-chain/access*)
  → Evidence Vault
  → Consumer BFF projection (human-access-economy)
  → Provider gateway + redemption (access-economy/providers) [ACCESS-14]
  → Canonical redemption orchestrator (ACCESS-17) with Kernel / Exchange / chain
  → Dual-token epoch allocation (access-economy/dual-token-allocation) [ACCESS-15]
```

The BFF adapter registers domain intents and runs redemptions through
`CanonicalAccessRedemptionOrchestrator` while preserving the frontend-safe simulation
contract (`productionReady=false`, `capacityKnown=false` unless explicitly matched).

See `docs/architecture/ACCESS_17_CANONICAL_RUNTIME.md`.

## Implemented qualification

- **18** Access Economy scenarios in `packages/sunrey-economics/src/access-economy/catalog.ts`
- **23** permanent invariants in `packages/sunrey-economics/src/access-economy/invariants.ts`
- **18** ACCESS stress scenarios in the Chunk 76 laboratory (`access-economy` campaign)
- E2E flows: Mustang consumer intent, Japan 14-day experience composer, household food access

## Test surface (representative)

| Suite | Location |
| --- | --- |
| ACCESS-01 domain | `packages/access-economy/src/*.test.ts` |
| ACCESS-04/07 | `packages/access-fabric/src/*.test.ts` |
| ACCESS-06 | `packages/sunrey-access/src/access-06.test.ts` |
| ACCESS-08/11 chain | `packages/sunrey-chain/src/access*.test.ts` |
| ACCESS-09 exchange | `packages/sunrey-exchange/src/access-fabric/*.test.ts` |
| ACCESS-10 composer | `tests/access-10-experience-composer-e2e.test.ts` |
| ACCESS-13 qualification | `packages/sunrey-economics/src/access-economy/*.test.ts` |
| ACCESS-13 integration | `tests/access-13-access-economy-qualification.test.ts` |
| ACCESS-13R E2E | `tests/access-economy-e2e-qualification.test.ts` |
| ACCESS-14 provider network | `packages/access-economy/src/providers/access-14-e2e.test.ts` |
| ACCESS-14 BFF integration | `tests/access-14-provider-network.test.ts` |
| ACCESS-17 canonical runtime | `tests/access-17-canonical-runtime.test.ts` |
| ACCESS-15 dual-token allocation | `packages/access-economy/src/dual-token-allocation/access-15.test.ts` |
| ACCESS-15 BFF integration | `tests/access-15-dual-token-allocation.test.ts` |
| Consumer BFF | `services/api/src/consumer-access.test.ts` |

## ACCESS-14 provider network (simulation)

| State | Value |
| --- | --- |
| `ACCESS-14 provider-network foundation` | **implemented** on current main |
| `LIVE_PROVIDER_CONNECTIVITY` | **false** |

Provider adapters: Expedia (simulated), Turo, DoorDash, Amazon, Airbnb (partner-gated simulation scaffolds).

See `docs/architecture/ACCESS_PROVIDER_NETWORK.md`.

## ACCESS-15 dual-token allocation (simulation)

| State | Value |
| --- | --- |
| `ACCESS-15 dual-token allocation protocol` | **implemented** on current main |
| `PRODUCTION_READY` | **false** |
| `LIVE_CONNECTIVITY_ENABLED` | **false** |

Converts time-weighted SunRey + MoonRey participation into non-cash Access entitlements backed by verified capacity pools. No third token. No fixed goods per token.

See `docs/economics/ACCESS_15_DUAL_TOKEN_ACCESS_ALLOCATION.md`.

## Remaining simulation-only components

- Live provider capacity, pricing, and settlement rails (provider adapters are simulation/partner-gated only)
- Production chain finality and live Exchange connectivity

## Resolved in ACCESS-17

- Full Kernel → Exchange → chain wiring through BFF redemption and legacy reservation confirm paths
- Agent `AccessIntent` mapping to domain `AccessFabricIntent` at ProposalGate
- BFF legacy quote/reservation paths route through provider gateway + canonical orchestrator (fixtures remain seed-only)

## Remaining real provider dependencies

- Verified vehicle, hospitality, travel, food, energy, and compute providers
- Independent capacity attestation / oracle proof for production admission
- Exchange market-data and clearing connectivity for priced access

## Remaining legal and regulatory gates

- Corridor-specific access entitlement policy (`RESEARCH_REQUIRED`)
- Counsel-confirmed eligibility and purpose-bound access rules
- Production operating scope and provider licensing per jurisdiction
- Independent regulatory-evidence binding before live access activation

## Unresolved architecture decisions

- Consolidation of overlapping `sunrey-access-fabric` capability naming across ACCESS-01 and ACCESS-09/10 modules (see `ACCESS_FABRIC_CANONICALIZATION.md`)

## Remaining technical debt

- Duplicate `sunrey-access-fabric` capability naming across ACCESS-01 and ACCESS-09/10 modules (documented in `ACCESS_FABRIC_CANONICALIZATION.md`)

## Production posture

```
ENVIRONMENT=simulation
PRODUCTION_READY=false
LIVE_CONNECTIVITY_ENABLED=false
PRODUCTION_ACTIVE=false
ACCESS_FABRIC_CODE_COMPLETE_CANDIDATE=<set by passing qualification only>
LIVE_PROVIDER_CONNECTIVITY=false
```
