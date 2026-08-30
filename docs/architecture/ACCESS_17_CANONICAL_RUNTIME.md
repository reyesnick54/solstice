# ACCESS-17 — Canonical Access Runtime Wiring

Classification: engineering simulation on current `main`.

## Mission

Wire the complete Access transaction path through canonical SunRey authorities while
preserving simulation mode and stable Consumer BFF routes.

## Canonical orchestrator

**Owner:** `packages/access-economy/src/providers/redemption/orchestrator.ts`

`CanonicalAccessRedemptionOrchestrator` is the single application orchestrator. It
coordinates existing modules and does not create a parallel domain owner.

| Module | Canonical owner | Role in pipeline |
| --- | --- | --- |
| Domain intent registry | `packages/access-economy` | Registers `AccessFabricIntent` on preview/start |
| Scarcity / allocation | `packages/sunrey-access` | Capacity hold before human confirmation |
| Entitlement hold | `packages/access-economy/providers/redemption` | Hold / release / consume governed units |
| Capacity reservation | `packages/access-fabric` | Simulation capacity engine ports |
| Funding router | `packages/access-economy/providers` | Emits intents toward payments / custody / access-fabric |
| Compliance Kernel | `packages/kernel` | Issues scoped Execution Authority on confirm |
| Exchange clearing | `packages/sunrey-exchange/src/access-fabric` | Financial hold and settlement capture |
| Provider gateway | `packages/access-economy/providers` | Search, quote, reserve, book, cancel |
| Chain commitment | `packages/sunrey-chain/src/access` | Access-right and reservation commitments |
| Evidence Vault | `packages/evidence` | Seals every consequential step |

Simulation world bootstrap: `packages/access-economy/src/providers/redemption/simulation-world.ts`

## Order of operations

Safe sequencing enforced by `CANONICAL_REDEMPTION_PIPELINE`:

1. `QUOTE` — provider gateway quote
2. `ELIGIBILITY` — redemption engine coverage decision
3. `ENTITLEMENT_HOLD` — governed entitlement units held
4. `CAPACITY_HOLD` — scarcity / allocation hold
5. `FINANCIAL_HOLD` — Exchange clearing reservation (skipped when fully entitlement-covered)
6. `HUMAN_CONFIRMATION` — explicit user approval when required
7. `EXECUTION_AUTHORITY` — Kernel ALLOW + verified authority
8. `PROVIDER_RESERVATION` — provider gateway reserve
9. `CLEARING_COMMITMENT` — clearing evidence sealed
10. `CHAIN_COMMITMENT` — access-right + reservation chain record
11. `FULFILLMENT` — provider booking
12. `DELIVERY_PROOF` — delivery evidence sealed
13. `SETTLEMENT_CAPTURE` — settlement evidence sealed
14. `ENTITLEMENT_CONSUMPTION` — entitlement units consumed once
15. `COMPLETION` — terminal redeemed state

No orphan state: each hold is released or consumed through compensating intents on failure.

## Compensating transactions

| Failure | Compensation |
| --- | --- |
| Provider booking failed after funds held | Release financial hold, cancel provider reservation, release entitlement |
| Funding failed after entitlement hold | Release entitlement and capacity hold |
| Chain submission failed after booking | Booking and clearing remain; chain step is best-effort in simulation |
| Provider cancelled | Cancel booking + refund clearing + reinstate entitlement policy |
| Partial delivery | Exchange refund intent for undelivered remainder |
| User cancellation | `cancel()` releases entitlement and cancels clearing reservation |
| Settlement timeout | Entitlement not consumed (`FAILED_SETTLEMENT_DOES_NOT_CONSUME_ENTITLEMENT`) |

Ledger and chain history are never rewritten. Corrections are new compensating intents.

## Idempotency

End-to-end idempotency keys survive:

- BFF (`idempotencyKey` on intents, quotes, redemptions)
- Orchestrator (`start` / `confirm` replay)
- Provider gateway (`reserve_*`, `book_*`, `cancel_*` keys)
- Exchange clearing (reservation id)
- Chain (commitment key deduplication)

Duplicate confirmation returns the existing `REDEEMED` record without double booking,
payment, or entitlement consumption.

## Agent intent mapping

**Bridge:** `packages/access-economy/src/agent-intent-bridge.ts`

**ProposalGate:** `packages/sunrey-agent/src/access/gate.ts` + `demand-engine.ts`

```
Agent AccessIntent
  → ProposalGate (toProposeAccessActionIntent)
  → agentAccessIntentToDomainInput
  → AccessFabric.proposeIntent (domain AccessFabricIntent)
```

Agents remain proposal-only. They cannot confirm, reserve consequential capacity, issue
Execution Authority, move funds, consume entitlement, book providers, or settle.

## BFF integration

Public routes are unchanged. Fixture ownership was removed from production-shaped runtime
paths in `packages/human-access-economy/src/service.ts`:

| Legacy route | Canonical path |
| --- | --- |
| `POST /api/v1/access/quotes` (Mustang) | Provider search + quote via gateway |
| `POST /api/v1/access/reservations` | Orchestrator `start` with entitlement hold |
| `POST /api/v1/access/reservations/:id/confirm` | Orchestrator `confirm` with Kernel + clearing |
| `POST /api/v1/access/redemptions/*` | `CanonicalAccessRedemptionOrchestrator` |
| `POST /api/v1/access/experiences/*` | Multi-provider bundle orchestration |

Sandbox entitlements in `fixtures.ts` remain for seed data only.

## Invariants

| ID | Statement |
| --- | --- |
| `NO_BFF_ECONOMIC_AUTHORITY` | BFF projects; orchestrator coordinates canonical owners |
| `NO_AGENT_EXECUTION_AUTHORITY` | Agent path stops at proposal + domain intent registration |
| `NO_PROVIDER_BOOKING_WITHOUT_REQUIRED_APPROVAL` | `confirm` requires human approval when contribution required |
| `NO_DUPLICATE_SETTLEMENT` | Idempotent confirm + clearing step keys |
| `NO_DUPLICATE_ENTITLEMENT_CONSUMPTION` | Entitlement store rejects double consume |
| `NO_ORPHAN_PROVIDER_BOOKING` | Failed booking triggers cancel + compensate |
| `NO_ORPHAN_FINANCIAL_HOLD` | `cancel` and compensate release clearing reservations |
| `NO_ORPHAN_CAPACITY_HOLD` | Scarcity hold released on compensate |
| `CHAIN_RECORD_DOES_NOT_REPLACE_LEDGER_TRUTH` | Chain commitments reference settlement; ledger unchanged |
| `EVERY_CONSEQUENTIAL_STEP_RECONSTRUCTABLE` | `CanonicalRedemptionTrace` + Evidence Vault seals |

## Tests

| Suite | Location |
| --- | --- |
| ACCESS-17 E2E | `tests/access-17-canonical-runtime.test.ts` |
| ACCESS-14 provider network | `tests/access-14-provider-network.test.ts` |
| Agent ProposalGate | `packages/sunrey-agent/src/access-demand.test.ts` |
| Consumer BFF | `services/api/src/consumer-access.test.ts` |

## Production posture

Unchanged. `ENVIRONMENT=simulation`, all `LIVE_*` flags `false`, `LIVE_PROVIDER_CONNECTIVITY=false`.
