# SunRey Human Access Economy — ACCESS-13R status

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
```

The BFF adapter now registers domain intents through `packages/human-access-economy/src/canonical-runtime.ts` while preserving the frontend-safe simulation contract (`productionReady=false`, `capacityKnown=false` unless explicitly fixture-matched).

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
| Consumer BFF | `services/api/src/consumer-access.test.ts` |

## Remaining simulation-only components

- Consumer quote/reservation fixtures in `packages/human-access-economy` for non-fixture requests
- Full Kernel → Exchange → chain wiring through the BFF (orchestrator registers domain state only)
- Live provider capacity, pricing, and settlement rails

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

- Full BFF orchestration through canonical reservation, Exchange clearing, and chain commitment (domain intent registration exists; quote/reservation paths remain fixture-backed for most requests)
- Agent `AccessIntent` mapping to domain `AccessFabricIntent` at ProposalGate
- Consolidation of overlapping `sunrey-access-fabric` capability naming across ACCESS-01 and ACCESS-09/10 modules (see `ACCESS_FABRIC_CANONICALIZATION.md`)

## Remaining technical debt

- Duplicate `sunrey-access-fabric` capability naming across ACCESS-01 and ACCESS-09/10 modules (documented in `ACCESS_FABRIC_CANONICALIZATION.md`)
- BFF still uses fixture-backed quotes for most requests; canonical reservation engine not yet exposed on all `/api/v1/access/*` routes
- Agent `AccessIntent` model not yet mapped to domain `AccessFabricIntent` at ProposalGate

## Production posture

```
ENVIRONMENT=simulation
PRODUCTION_READY=false
LIVE_CONNECTIVITY_ENABLED=false
PRODUCTION_ACTIVE=false
ACCESS_FABRIC_CODE_COMPLETE_CANDIDATE=<set by passing qualification only>
```
