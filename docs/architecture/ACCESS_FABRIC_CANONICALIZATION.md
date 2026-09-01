# SunRey Access Fabric Canonicalization

Status: Wave 2 Prompt 5 — architecture canonicalization merged  
Scope: ACCESS-01 through ACCESS-12 integration; Access Economy + Access Fabric + entitlement subledger  
Machine-readable map: `packages/access-economy/src/canonical-ownership.ts`

## Purpose

Engineers must be able to answer **"What package owns this Access concept?"** without ambiguity.
This document is the human-facing mirror of the machine-readable ownership map. It does **not**
redesign the Access Economy; it removes duplicate architectural authority while preserving
intended bounded-context behavior.

There is **no** `packages/access-ledger` or `packages/sunrey-access-ledger`. Entitlement unit
accounting lives at `packages/access-economy/src/funding-solvency/entitlement-ledger.ts` under
the canonical Access Economy owner. The canonical **financial** ledger remains `packages/ledger`.

---

## Canonical bounded context

`packages/access-economy` is the **canonical Human Access Economy domain owner**. It owns the
stable domain vocabulary and lifecycle primitives:

`AccessIntent`, `AccessRight`, `AccessEntitlement`, `PersonalAccessEnvelope`, `CapacityOffer`,
`CapacityWindow`, `CapacityReservation`, `AccessQuote`, `AllocationPolicy`, `AllocationDecision`,
`ExperienceBundle`, `UsageEvent`, `UsageProof`, `DeliveryClaim`, dual-token allocation, settlement
orchestration, provider redemption, and the entitlement subledger.

The following packages are **implementation modules beneath that bounded context**, not competing authorities:

| Package | Role | Capability (manifest) |
|---|---|---|
| `packages/access-fabric` | Entitlement evaluation, policy eligibility, reservation lifecycle, holds, waitlists, settlement-intent handoff | `sunrey-access-entitlement-engine` |
| `packages/sunrey-access` | Deterministic scarcity evaluation, quote methodology, mechanism-based allocation selection | (engine module) |
| `packages/sunrey-access-fabric` | Productive-capacity discovery + composite experience composition | `sunrey-access-fabric` |
| `packages/human-access-economy` | Consumer-facing simulation / BFF projection adapter | (consumer adapter) |
| `packages/sunrey-chain/src/access` | Chain commitments for non-ownership access rights, reservations, usage, delivery, settlement evidence | `sunrey-access-rights-commitments` |
| `packages/sunrey-chain/src/access-fabric` | Chain-side grant/reservation/usage/delivery workflow adapter | (extends chain owner) |
| `packages/sunrey-exchange/src/access-fabric` | Productive-capacity markets, RFQ, auctions, dual-economy clearing | `sunrey-exchange-capacity-access` |
| `packages/sunrey-economics/src/access-economy` | ACCESS-13 simulation / qualification only | `sunrey-access-economy-simulation` |
| `packages/agent/src/access-fabric` | Non-executable agent access-intent proposals | (agent layer) |
| `packages/sunrey-agent/src/access` | ProposalGate → Kernel `ActionIntent` conversion | (agent gate) |
| `services/api/src/consumer/access.ts` | HTTP dispatch to `human-access-economy` | (BFF orchestration) |

---

## Ownership table

| Concept | Canonical owner | Canonical path |
|---|---|---|
| Access request / registry intent | `packages/access-economy` | `src/types.ts` |
| Access intent (domain) | `packages/access-economy` | `src/types.ts` |
| Eligibility (what may be requested now) | `packages/access-fabric` | `src/engine.ts` |
| Entitlement (registry record) | `packages/access-economy` | `src/types.ts` |
| Policy (access-domain eligibility) | `packages/access-fabric` | `src/policy.ts` |
| Capability / productive discovery | `packages/sunrey-access-fabric` | `src/productive-capacity/port.ts` |
| Allocation (epoch / TWAB / dual-token) | `packages/access-economy` | `src/dual-token-allocation/engine.ts` |
| Resource availability / reservation | `packages/access-fabric` | `src/capacity-source.ts` |
| Pricing / scarcity quote | `packages/sunrey-access` | `src/scarcity/engine.ts` |
| SunRey allocation | `packages/access-economy` | `src/dual-token-allocation/engine.ts` |
| MoonRey allocation | `packages/access-economy` | `src/dual-token-allocation/engine.ts` |
| Settlement orchestration | `packages/access-economy` | `src/settlement/orchestrator.ts` |
| Entitlement ledger event | `packages/access-economy` | `src/funding-solvency/entitlement-ledger.ts` |
| Financial ledger mutation | `packages/ledger` | `src/journal.ts` (via EA + clearing ports) |
| Access identity (subject) | `packages/identity` | `src/capability.ts` (ActorContext; not Access-owned) |
| HIN attribution bridge | `packages/access-economy` | `src/hin-access/contract.ts` |
| Provider / redemption fulfillment | `packages/access-economy` | `src/providers/redemption/types.ts` |
| Consequential authorization | `packages/kernel` | `src/kernel.ts` |
| Expiration (operational TTL) | `packages/access-fabric` | `src/lifecycle.ts` |
| Revocation (registry lifecycle) | `packages/access-economy` | `src/lifecycle.ts` |
| Audit trail | `packages/evidence` | `src/vault.ts` |

---

## Canonical domain types

Import domain vocabulary from `packages/access-economy` (`src/types.ts`, `src/index.ts`):

- `AccessRight`, `AccessIntent`, `AccessEntitlement`, `AccessQuote`
- `AllocationPolicy`, `AllocationDecision`
- `CapacityOffer`, `CapacityWindow`, `CapacityReservation`
- `PersonalAccessEnvelope`, `ExperienceBundle`
- `UsageEvent`, `UsageProof`, `DeliveryClaim`

V1 consumer-domain extensions live under `packages/access-economy/src/domain/`.
Dual-token allocation types live under `packages/access-economy/src/dual-token-allocation/`.

---

## Named duplicate types (intentional layering)

Only **accidental** duplicates (classification F) should be eliminated. Legitimate bounded-context
representations may share names.

| Type | Canonical (A) | Also defined in | Classification |
|---|---|---|---|
| `AccessIntent` | `access-economy/types.ts` | `human-access-economy/types.ts`, `agent/access-fabric/types.ts`, `sunrey-sdk/consumer-bff/types.ts` | A / B / E / B |
| `AccessEntitlement` | `access-economy/types.ts` | `access-fabric/types.ts`, `human-access-economy/types.ts`, `access-economy/domain/types.ts` | A / D / B / A |
| `AllocationDecision` | `access-economy/types.ts` | `sunrey-access/scarcity/types.ts` | A / D |
| `AccessRight` | `access-economy/types.ts` | `sunrey-access-fabric/types/access-right.ts` | A / D (composer slice) |
| `AccessRequest` | — | `sunrey-economics/access-economy/types.ts` | C (simulation only) |
| `Settlement*` | `access-economy/settlement` | `sunrey-exchange/access-fabric`, `payments`, `treasury` | A / D (rail-specific) |

Classification key: **A** canonical · **B** transport DTO · **C** simulation · **D** adapter · **E** agent proposal · **F** accidental (remove)

---

## Package responsibilities

### `packages/access-economy` — domain registry + economic rules

- Owns ACCESS-01 domain vocabulary and lifecycle
- Owns dual-token allocation (ACCESS-15), HIN bridge orchestration (ACCESS-18), provider gateway (ACCESS-14/21)
- Owns settlement orchestration and entitlement subledger (non-cash units)
- Does **not** post financial journals, issue Execution Authority, or mint coins

### `packages/access-fabric` — entitlement + reservation engine

- Answers **what a subject may currently request** and manages capacity holds/confirmations
- Policy eligibility via `AccessPolicyPort` (may only deny or defer; never override Kernel)
- Hands off settlement **intent** via ports; does not settle balances

### `packages/sunrey-access` — scarcity + mechanism selection

- Scarcity bands, quote methodology, mechanism-based `AllocationDecision`
- Distinct from epoch/TWAB allocation in `access-economy`

### `packages/sunrey-access-fabric` — discovery + experience composition

- Read-only productive-capacity port; composes experience bundles
- Simplified `AccessRight` slice for composer workflows (not the canonical governed right)

### `packages/human-access-economy` — consumer adapter

- Frontend-safe simulation projections; delegates canonical decisions at redemption (ACCESS-17)
- Must not fabricate live capacity, pricing, or settlement truth

### Chain / Exchange submodules

- `sunrey-chain/src/access` — privacy-safe on-chain commitments (ACCESS-08)
- `sunrey-chain/src/access-fabric` — workflow + evidence anchoring (ACCESS-10/11)
- `sunrey-exchange/src/access-fabric` — capacity markets + dual-economy clearing (ACCESS-09)

---

## Allowed dependency directions

```
services/api → human-access-economy → access-economy | access-fabric | sunrey-access | sunrey-access-fabric
access-economy → domain | money | evidence
access-fabric → domain
sunrey-access → domain
sunrey-access-fabric → domain
sunrey-economics/access-economy → access-fabric | access-economy
sunrey-exchange/access-fabric → ledger (fiat legs, EA required)
sunrey-chain/access → evidence
agent/access-fabric → (proposal only)
sunrey-agent/access → kernel (ProposalGate)
```

**Forbidden today (documented debt):** `access-fabric` ↔ `access-economy` type-level imports.
Engine modules define local adapter shapes until a safe shared-types extraction lands.

---

## Compatibility / re-export strategy

- **Do not** collapse BFF, agent, or engine adapter types into the canonical registry in one PR.
- Import canonical domain types from `packages/access-economy` in orchestrators (`human-access-economy/canonical-runtime.ts` already does this).
- Product-facing types in `human-access-economy/types.ts` remain **simulation projections** (`simulationFixture: true`).
- SDK types in `packages/sunrey-sdk/src/consumer-bff/types.ts` track BFF projections, not the registry.
- New Access work extends existing owners; do **not** create peer packages (`access-ledger`, `access-coin`, etc.).

---

## Canonical request lifecycle

Actual repository flow (not a hypothetical redesign):

```
Human / Agent intent
        ↓
AccessIntent (registry or proposal)
        ↓  packages/access-economy | packages/agent
Identity + session context
        ↓  packages/identity
Policy / eligibility
        ↓  packages/access-fabric
Productive capacity discovery
        ↓  packages/sunrey-access-fabric
Scarcity quote + mechanism selection
        ↓  packages/sunrey-access
Dual-token / epoch allocation
        ↓  packages/access-economy/dual-token-allocation
Capacity reservation hold / confirm
        ↓  packages/access-fabric
Compliance Kernel (consequential only)
        ↓  packages/kernel → Execution Authority
Exchange clearing / fiat settlement
        ↓  packages/sunrey-exchange/access-fabric | packages/access-economy/settlement
Chain access commitment + evidence
        ↓  packages/sunrey-chain/access
Provider fulfillment / redemption
        ↓  packages/access-economy/providers
Entitlement subledger + Evidence Vault audit
        ↓  packages/access-economy/funding-solvency | packages/evidence
HIN participation bridge (optional)
        ↓  packages/access-economy/hin-access
Consumer BFF projection
        ↓  packages/human-access-economy → services/api
```

---

## HIN boundary

HIN (Human Information Network / `packages/information-market`) is **not** an Access catch-all.

| Question | Answer |
|---|---|
| HIN owns identity? | **No** — `packages/identity` |
| HIN owns attribution? | **No** — bridge orchestration in `access-economy/hin-access`; contribution registry in `human-economic-contribution` |
| HIN owns value calculation? | **No** |
| HIN consumes Access events? | **No** — consumes consent/opportunity adapters via ports |
| HIN produces signals? | **Yes** — data-opportunity signals only |
| HIN participates in allocation? | **No** — only settled SunRey compensation may affect TWAB (`onlySettledSunReyAffectsTwab: true`) |

Contract: `packages/access-economy/src/hin-access/contract.ts` (`HIN_ACCESS_BRIDGE_BOUNDARY`).

---

## SunRey / MoonRey dual-token boundary

| Decision | Owner |
|---|---|
| Economic allocation logic | `packages/access-economy/src/dual-token-allocation` |
| Token amounts / eligible supply | `packages/access-economy/src/dual-token-allocation` |
| Denomination (minor units) | `packages/money` |
| Settlement instruction | `packages/access-economy/src/settlement` |
| Financial ledger mutation | `packages/ledger` (via scoped Execution Authority) |
| Exchange clearing legs | `packages/sunrey-exchange/src/access-fabric/clearing.ts` |
| Custody / chain rail movement | `packages/custody` / `packages/sunrey-chain` |
| Minting | `packages/sunrey-chain/src/economics` (simulation; production inactive) |

Economic decision logic must not be duplicated across packages. This prompt does **not** change token economics.

Permanent invariants: no Access Coin · no fixed SunRey/MoonRey peg · no automatic coin issuance from Access queries.

---

## Policy / compliance boundary

| Layer | Owner | Role |
|---|---|---|
| Access domain policy | `packages/access-fabric` | Eligibility at discovery, quote, hold, confirm, activation stages |
| Access regulatory controls | `packages/access-economy/regulatory-controls` | Treasury exposure, funding gates, jurisdiction policy (simulation) |
| Compliance Kernel | `packages/kernel` | Six proofs; issues Execution Authority on ALLOW |
| Regulatory Digital Twin | `packages/regulatory-twin` | Counterfactual simulation only |

Rules:

- Access policy may **only get stricter**; it must not override a Kernel REFUSE.
- Compliance must **not** directly own economic allocation unless architecture explicitly requires it (it does not today).
- Interface: `AccessPolicyPort.check` → eligibility · `Kernel.submit` → EA for consequential mutation.

---

## Consumer BFF rule

`/api/v1/access/*` remains the only application-facing Access API (`services/api/src/consumer/access.ts`).
The BFF orchestrates through `packages/human-access-economy`; it does not own capacity truth, pricing truth,
reservation authority, settlement balances, or blockchain state.

Simulation fixtures are permitted only while `ENVIRONMENT=simulation`. Missing canonical state must return
unavailable/disabled rather than fabricated live values.

---

## Architecture regression tests

| Test file | Enforces |
|---|---|
| `packages/access-economy/src/canonical-ownership.test.ts` | Ownership map completeness, forbidden packages, boundary constants |
| `tools/architectural-linter/src/access-canonicalization.test.ts` | Manifest alignment, BFF routing, settlement boundaries, no circular imports |
| `packages/access-economy/src/architecture-guards.test.ts` | ACCESS-01 isolation |
| `packages/access-fabric/src/architecture-guards.test.ts` | No ledger/EA/mint |
| `packages/sunrey-access-fabric/src/architecture-guards.test.ts` | No productive registration / EA |
| `tools/architectural-linter/src/access-08-constitution.test.ts` | Chain access-rights owner |
| `tools/architectural-linter/src/access-09-constitution.test.ts` | Exchange clearing owner |
| `packages/sunrey-economics/src/access-economy/architecture-guards.test.ts` | ACCESS-13 simulation consumes canonical owners |

---

## Permanent safety invariants

- no Access Coin
- no human-worth or social-credit score
- no automatic SunRey Coin issuance
- no automatic MoonRey Coin issuance
- no fixed SunRey/MoonRey peg
- no raw sensitive personal information on-chain
- no productive capacity created by a query
- no capacity overselling
- no AI self-approval
- no reservation confirmation without required authority
- no second balance ledger inside Exchange or Access
- no simulation path may activate production

---

## Known remaining debt

1. **Type-level consolidation:** `access-fabric`, `sunrey-access`, and `sunrey-access-fabric` define local
   adapter types instead of importing `access-economy` (avoids circular dependency today). Follow-on: extract
   shared `access-economy-types` surface or invert dependency via ports-only boundary.

2. **ACCESS-13 branch reconciliation:** Original ACCESS-13 work on stale branch; port qualification scenarios
   onto current `main` rather than force-merge.

3. **`sunrey-agent` broken import:** `packages/sunrey-agent/src/tools/ports.ts` references missing
   `packages/consent/src/access-fabric/index.ts`; canonical agent types live at `packages/agent/src/access-fabric/`.

4. **Naming overload:** The word "Access Fabric" appears in five packages with different owners. Use this
   document and `canonical-ownership.ts` to disambiguate; do not merge packages.

5. **Engine ↔ domain semantic drift:** `AccessEntitlement` and `AllocationDecision` names appear in multiple
   layers with different fields. Intentional until shared-type migration; monitor via architecture tests.

---

## Naming and migration rule

Do not create additional top-level Access packages. Existing implementation modules remain in place until
imports can be migrated without breaking tests or architecture boundaries. New Access work should use
`packages/access-economy` as the domain vocabulary and extend the existing specialized modules instead of
creating another peer package.

---

## Authority rules

The Access Fabric never becomes a second Ledger, Exchange, custody system, Compliance Kernel, Execution
Authority, oracle network, monetary issuance authority, Productive Economy, Personal Economic Graph, or blockchain.

Canonical economic flow:

Human intent → Personal Economic Graph / Personal Economy Agent → AccessIntent → Access Economy domain →
entitlement and policy evaluation → productive-capacity discovery → scarcity/allocation → capacity reservation →
Compliance Kernel / Execution Authority where consequential → SunRey Exchange / canonical settlement rails →
SunRey Chain access commitment → usage/delivery evidence.

---

## ACCESS-13 qualification note

The original ACCESS-13 work was built on an older ACCESS-04 branch and therefore cannot be merged onto current
`main` without reconciling later ACCESS-05 through ACCESS-12 changes. Its scenario and invariant work should
be ported onto current `main` as a fresh qualification commit rather than force-merging the stale branch and
 risking loss of newer Access code.
