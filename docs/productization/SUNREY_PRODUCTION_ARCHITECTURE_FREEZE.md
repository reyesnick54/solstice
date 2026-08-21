# SunRey Production Architecture Freeze

Phase A Prompt 3. This document freezes architectural authority
boundaries. It does not authorize production, flip `LIVE_*` flags, or
create a new core.

Posture on this tree:

- `PRODUCTION_READY=false`
- `PRODUCTION_ACTIVE=false`
- `LIVE_CONNECTIVITY_ENABLED=false`
- `ENVIRONMENT=simulation`

## 1. Objective

Freeze the existing SunRey core architecture so future productization
extends canonical components instead of inventing parallel ones.

From this point forward:

- Do not solve implementation problems by creating parallel architectures.
- Do not create duplicate ledgers.
- Do not create duplicate execution systems.
- Do not create a new Agent architecture when the existing Agent
  runtime can be extended.
- Do not create a new Exchange core when the existing Exchange can be
  productized.
- Do not create a new blockchain architecture.
- Do not create a new compliance control plane.

Future work must productize the canonical components named here and in
`docs/architecture/constitution.md`.

## 2. Architecture freeze statement

The consolidated `main` tree is the architectural foundation.

The machine-enforceable constitution remains
`docs/architecture/constitution.md` and
`docs/architecture/manifest.json`. Chunk 168 engineering closure
(`docs/architecture/SUNREY_ENGINEERING_CLOSURE.md`) remains the
engineering-closure report. This freeze does not replace those
documents. It is the productization-facing authority map that future
Cursor Agents and PRs must extend.

### Inventory reconciliation

`docs/productization/SUNREY_CANONICAL_IMPLEMENTATION_INVENTORY.md` and
its machine-readable companion were not present on this tree when this
freeze was written. The freeze is therefore derived from, and checked
against, the code and the existing canonical documents:

- `docs/architecture/constitution.md`
- `docs/architecture/manifest.json`
- `docs/architecture/SUNREY_ENGINEERING_CLOSURE.md`
- `docs/architecture/sunrey-chain-authority-matrix.md`
- `docs/architecture/native-asset-authority-boundary.md`
- `docs/architecture/historical-implementation.md`

If a later Prompt 2 inventory lands, it must not name a second owner
for any domain in `docs/productization/sunrey-authority-map.json`.
Code and the constitution win over stale narrative. Material
conflicts must be resolved before further productization.

Resolved on inspection:

- `packages/agent` (Personal Economy Agent) and
  `packages/sunrey-agent` (user-controlled mandates / ProposalGate)
  are both canonical and specialized. They are not competing Agent
  cores. Do not merge them into a third package.
- Application `SUNREY_COIN` journals (`packages/sunrey-coin`) and
  protocol-native `SUNREY_COIN` / `MOONREY_COIN` (`packages/sunrey-chain`)
  are distinct authorities. Ledger wins for fiat and current
  application coin journals until a later Kernel-gated migration ADR
  is accepted and executed.
- Capability `moonrey-coin` is SUPERSEDED. Do not create
  `packages/moonrey-coin`.
- `apps/explorer` is a projection UI, not an authoritative ledger.
- `packages/persistence` is a PostgreSQL adapter behind existing
  ports, not a second ledger.

## 3. Authoritative subsystem table

| Domain | Owner | Canonical path | Type | Store |
| --- | --- | --- | --- | --- |
| MONEY_REPRESENTATION | `packages/money` | `packages/money/src/money.ts` | ACTIVE_CANONICAL | bigint minor-unit value object |
| LEDGER | `packages/ledger` | `packages/ledger/src/journal.ts` | ACTIVE_CANONICAL | append-only journals |
| BALANCES | `services/accounts` | `services/accounts/src/balances.ts` | ACTIVE_CANONICAL | ledger projection |
| IDENTITY | `packages/identity` | `packages/identity/src/service.ts` | ACTIVE_CANONICAL | identity / ActorContext |
| AUTHENTICATION | `packages/identity` | `packages/identity/src/auth.ts` | ACTIVE_CANONICAL | sessions / credentials metadata |
| AUTHORIZATION | `packages/identity` + `packages/permissions` | `packages/identity/src/capability.ts` | ACTIVE_CANONICAL | actor capabilities + ActionIntent |
| KERNEL_POLICY | `packages/kernel` | `packages/kernel/src/kernel.ts` | ACTIVE_CANONICAL | six proofs + policy packs |
| EXECUTION_AUTHORITY | `packages/permissions` | `packages/permissions/src/execution-authority.ts` | ACTIVE_CANONICAL | signed short-lived authority |
| COMPLIANCE | `packages/kernel` | `packages/kernel/src/compliance/fabric.ts` | ACTIVE_CANONICAL | screening / cases |
| EVIDENCE | `packages/evidence` | `packages/evidence/src/vault.ts` | ACTIVE_CANONICAL | hash-chained vault |
| EVENTS | `packages/events` | `packages/events/src/events.ts` | ACTIVE_CANONICAL | versioned events / outbox |
| PERSISTENCE | `packages/persistence` | `packages/persistence/src/index.ts` | ACTIVE_CANONICAL | PostgreSQL adapter |
| ACCOUNTS | `packages/domain` + `services/accounts` | `packages/domain/src/account.ts` | ACTIVE_CANONICAL | account entities; journals on Ledger |
| PAYMENTS | `packages/payments` | `packages/payments/src/service.ts` | ACTIVE_CANONICAL | payment instructions; journals on Ledger |
| CARDS | `packages/cards` | `packages/cards/src/service.ts` | ACTIVE_CANONICAL | card platform; journals on Ledger |
| FX | `packages/payments` | `packages/payments/src/fx-quote.ts` | ACTIVE_SPECIALIZED | quotes; accept path is Kernel-gated |
| TREASURY | `packages/treasury` | `packages/treasury/src/service.ts` | ACTIVE_CANONICAL | treasury ops; journals on Ledger |
| INVESTMENTS | `packages/investments` | `packages/investments/src/service.ts` | ACTIVE_CANONICAL | paper portfolio; journals on Ledger |
| PERSONAL_ECONOMIC_GRAPH | `packages/personal-economic-graph` | `packages/personal-economic-graph/src/service.ts` | ACTIVE_CANONICAL | derived financial profile |
| GROWTH_ORCHESTRATOR | `packages/platform` | `packages/platform/src/service.ts` | ACTIVE_CANONICAL | growth plans; not books |
| AI_MODEL_GATEWAY | `packages/ai-runtime` | `packages/ai-runtime/src/runtime.ts` | ACTIVE_CANONICAL | inference traces |
| SUNREY_AGENT | `packages/sunrey-agent` | `packages/sunrey-agent/src/engine.ts` | ACTIVE_CANONICAL | mandates / proposals |
| PERSONAL_ECONOMY_AGENT | `packages/agent` | `packages/agent/src/service.ts` | ACTIVE_SPECIALIZED | advisory proposals only |
| AGENT_TOOLS | domain packages via Agent ports | `packages/sunrey-exchange/src/agent-tool.ts` | ACTIVE_SPECIALIZED | read / propose tools |
| AGENT_APPROVALS | `packages/sunrey-agent` | `packages/sunrey-agent/src/policy.ts` | ACTIVE_CANONICAL | human approval records |
| SUNREY_EXCHANGE | `packages/sunrey-exchange` | `packages/sunrey-exchange/src/index.ts` | ACTIVE_CANONICAL | orders / fills |
| MATCHING | `packages/sunrey-exchange` | `packages/sunrey-exchange/src/matching.ts` | ACTIVE_SPECIALIZED | matching engine |
| SETTLEMENT | `packages/sunrey-exchange` via Ledger ports | `packages/sunrey-exchange/src/native-settlement.ts` | ACTIVE_SPECIALIZED | clearing; books on Ledger/Chain |
| CUSTODY | `packages/custody` | `packages/custody/src/index.ts` | ACTIVE_CANONICAL | operational custody state |
| SUNREY_CHAIN | `packages/sunrey-chain` | `packages/sunrey-chain/src/index.ts` | ACTIVE_CANONICAL | protocol-native chain state |
| CONSENSUS | `packages/sunrey-chain` | `packages/sunrey-chain/rust/crates/consensus` | ACTIVE_SPECIALIZED | development BFT |
| NATIVE_ASSET_SUPPLY | `packages/sunrey-chain` | `packages/sunrey-chain/src/economics/supply.ts` | ACTIVE_CANONICAL | AssetSupplyBook |
| SUNREY_COIN | `packages/sunrey-coin` + chain native | `packages/sunrey-coin/src/service.ts` | ACTIVE_CANONICAL | application journals; native units distinct |
| MOONREY_COIN | `packages/sunrey-chain` | `packages/sunrey-chain/src/economics/supply.ts` | ACTIVE_CANONICAL | protocol-native only |
| ORACLES | `packages/sunrey-chain` | `packages/sunrey-chain/src/oracle/engine.ts` | ACTIVE_CANONICAL | signed facts; not money |
| HIN | `packages/information-market` | `packages/information-market/src/network/engine.ts` | ACTIVE_CANONICAL | information rights |
| PERSONAL_DATA | `packages/personal-data-vault` | `packages/personal-data-vault/src/service.ts` | ACTIVE_CANONICAL | subject-bound encrypted store |
| CONSENT | `packages/consent` | `packages/consent/src/service.ts` | ACTIVE_CANONICAL | consent grants / purpose |
| PROVIDER_INTEGRATIONS | existing owner packages | `packages/sunrey-chain/src/providers/production-binding/types.ts` | ACTIVE_SPECIALIZED | adapter records; not SoR |
| OPERATIONS | `packages/sunrey-chain` | `packages/sunrey-chain/src/ops/index.ts` | ACTIVE_CANONICAL | ops / control room |
| DEPLOYMENT | `packages/sunrey-chain` | `packages/sunrey-chain/src/infra/provider.ts` | ACTIVE_CANONICAL | simulation infra posture |
| PLATFORM_API | `services/api` | `services/api/src/app.ts` | ACTIVE_SPECIALIZED | HTTP runtime; not books |

Machine-readable companion: `docs/productization/sunrey-authority-map.json`.

## 4. Financial authority rules

The Ledger (`packages/ledger`, `Ledger.postJournal`) is the sole
authoritative financial journal for fiat and current application
account state.

- No UI, Agent, provider, operational database, PEG, explorer, or
  Exchange matching book may independently establish authoritative
  fiat or account balances.
- Balances are read from the ledger. An Account must not store a
  balance field.
- Persistence may durably store journals that the Ledger already
  accepted. Persistence is not a second journal authority.
- Provider movement of external money does not make the provider the
  SunRey system of record.
- Corrections are new compensating entries. Journals are not edited
  or deleted.
- Money is integer minor units. Never floating-point.

Regulated financial mutation requires Kernel evaluation and a
verified Execution Authority before `openAccount` or
`Ledger.postJournal`.

## 5. AI authority rules

AI (model gateway, Personal Economy Agent, SunRey Agent, tools) may:

- analyze
- explain
- predict
- recommend
- call read-only tools
- construct proposals
- request approval

AI may not:

- approve itself
- sign with master financial keys
- mint assets outside governance
- bypass the Kernel
- bypass compliance
- post arbitrary Ledger entries
- activate providers
- activate production

A model response is never authorization. Conversion of an
`AgentProposal` to an `ActionIntent` happens only at a ProposalGate
that verifies a signed capability token and required human approval
before the Kernel sees the intent. Agent-originated Kernel ALLOW
means "fit for a human to consider" unless a separate verified
Execution Authority is later issued on the approved path.

`packages/agent` must not import Execution Authority issuance, Kernel,
or Ledger. `packages/sunrey-agent` may import intent types and submit
through ProposalGate; it must not construct `AuthorityIssuer` or call
`postJournal`.

## 6. Frontend authority rules

Frontend clients (`apps/*` and any future BFF-served UI) may:

- authenticate users
- collect intent
- display data
- submit requests
- present proposals
- capture approvals

Frontend clients may not:

- calculate authoritative balances
- write directly to the Ledger
- bypass BFF / API / security boundaries
- directly call privileged internal services
- hold production master keys
- import `packages/ledger`, `packages/kernel`, Execution Authority
  issuance, or key-material modules

`apps/explorer` is a rebuildable projection. Indexed heights and
displayed balances are not books.

## 7. Provider authority rules

Providers provide external capabilities.

Providers do not become the internal SunRey system of record merely
because they move external money.

- Future external providers implement SunRey interfaces.
- SunRey domain logic must not be rewritten around one vendor API.
- Provider adapters record evidence and reconciliation; they do not
  post journals except through the already-authorized domain path.
- Provider lifecycle states (frozen as an architectural rule, not
  implemented as a universal runtime in this prompt):

  `SIMULATED` → `SANDBOX` → `CERTIFICATION` → `PREPRODUCTION` →
  `LIMITED_LIVE` → `PRODUCTION`

- No adapter may skip to `PRODUCTION` by flag, comment, or test hook.
  Production remains disabled.

## 8. Exchange authority rules

The Exchange (`packages/sunrey-exchange`) owns orders, matching, and
fills. It must not create an independent uncontrolled balance
universe disconnected from custody and canonical financial records.

- Settlement journals stay on the canonical Ledger via `CoinPort` /
  `FiatPort`.
- Native-asset settlement uses SunRey Chain state where the asset is
  protocol-native, then reconciles. It is not a second fiat ledger.
- Agents cannot execute Exchange orders as a hidden write path.
- Market-surveillance alerts are derived projections, not freezes.

## 9. Blockchain authority rules

SunRey Chain is canonical for protocol-native blockchain state.

Financial application state and blockchain state must not be casually
conflated.

- Fiat deposits, payments, investment cash, and current application
  SunRey Coin journals: Ledger wins.
- Protocol-native `SUNREY_COIN` and `MOONREY_COIN` units: SunRey Chain
  `AssetSupplyBook` / consensus state.
- These supplies are not the same. Development native units start at
  zero and are not a premine of application balances.
- Silent dual-authority is forbidden.
- Do not create a second chain, consensus engine, or mint package.
- Oracles produce signed facts. Facts are not money.

See `docs/architecture/sunrey-chain-authority-matrix.md` and
`docs/architecture/native-asset-authority-boundary.md`.

## 10. Persistence boundaries

Do not create one giant universal database.

| Category | Authoritative subsystem | Must not |
| --- | --- | --- |
| Fiat / application transaction journal | LEDGER | provider DB, PEG, explorer, chain balances |
| Protocol-native asset state | SUNREY_CHAIN | Ledger as native mint; `packages/moonrey-coin` |
| Exchange orders / fills | EXCHANGE | chain order book; ledger as open-order store |
| Exchange settlement journals | LEDGER via Exchange ports | Exchange matching book as cash |
| External custody confirmation | CUSTODY + reconciliation / EVIDENCE | provider API as ledger |
| Compliance case | COMPLIANCE | AI conversation; Exchange alert as legal finding |
| Policy pack / Kernel decision | KERNEL_POLICY + EVIDENCE | chain ALLOW replacing Kernel |
| Execution Authority | EXECUTION_AUTHORITY | chain signature; model output |
| Identity / KYC metadata | IDENTITY | chain as KYC store; PDV as identity |
| Authentication session | AUTHENTICATION | frontend localStorage as session authority |
| AI conversation / inference | AI_MODEL_GATEWAY / AGENT runtime | Kernel decision store |
| Financial profile | PERSONAL_ECONOMIC_GRAPH | graph as balance |
| Growth plan | GROWTH_ORCHESTRATOR | plan as ledger |
| Consent | CONSENT | chain as consent DB; PDV as consent |
| Raw personal data | PERSONAL_DATA | chain; evidence payloads; PEG nodes |
| Provider payload / evidence | EVIDENCE + provider integration records | provider payload as books |
| HIN rights | HIN | chain as CLOB |
| Operational telemetry | OPERATIONS | ops DB as financial SoR |
| Deployment / infra plan | DEPLOYMENT | infra plan as production activation |

`packages/persistence` implements ports for existing stores. It does
not own financial meaning.

## 11. Regulated mutation sequence

Default regulated action path:

```
CLIENT
  → API / BFF
  → authentication
  → request validation
  → domain service
  → Kernel
  → compliance / risk
  → proposal / approval where required
  → Execution Authority
  → provider / internal execution
  → Ledger / Chain as appropriate
  → Evidence
  → Events
  → response / webhook
```

Not every read request requires every step.

Any regulated mutation must have an explicit authority path. HOLD,
BLOCK, DEFER, and REQUIRE_MANUAL_REVIEW post nothing and still seal
evidence. On ALLOW the Kernel may issue a signed Execution Authority.
Callers verify that authority before `openAccount` or
`Ledger.postJournal`.

Do not catch a Kernel refusal and proceed anyway.

## 12. Agent sequence

```
USER
  → SUNREY AGENT
  → AI MODEL GATEWAY
  → AGENT TOOL
  → STRUCTURED PROPOSAL
  → POLICY / RISK
  → USER APPROVAL WHEN REQUIRED
  → EXECUTION AUTHORITY
  → DOMAIN SERVICE
  → LEDGER / CHAIN
  → EVIDENCE
```

The model response itself must never be treated as authorization.

`packages/agent` remains proposal-only. Mandates may only narrow
token authority; limits are not inferred from a prompt.

## 13. Exchange sequence

```
CLIENT
  → Exchange API
  → identity / eligibility
  → compliance
  → order validation
  → matching
  → fills
  → clearing / settlement
  → custody
  → Ledger / Chain
  → reconciliation
  → evidence
```

The Exchange must remain connected to custody and canonical financial
records.

## 14. Provider adapter principles

1. SunRey owns the interface. The vendor implements the adapter.
2. Domain types (Money, ActionIntent, Execution Authority, journals)
   do not change to match a vendor payload.
3. Adapters are injected / fake / sandbox until an authorized
   production-activation task says otherwise.
4. Lifecycle states listed in section 7 are the only legal promotion
   vocabulary. This prompt does not implement the universal provider
   runtime.
5. No direct provider-to-Ledger shortcut. Journals are posted only
   through authorized domain paths already listed in the architectural
   linter (`Ledger.postJournal` from money-movement, payments/cards/
   treasury/investments/sunrey-coin/information-market journals).
6. Raw credentials never enter domain configuration
   (`packages/security` credential plane).

## 15. Deprecation policy

Allowed lifecycle states for implementations:

| State | Meaning |
| --- | --- |
| ACTIVE_CANONICAL | Sole owner for that domain. Extend it. |
| ACTIVE_SPECIALIZED | Canonical but scoped (matching, FX, Personal Economy Agent). Do not promote it into a second core. |
| DEPRECATED | Must not gain new dependents. |
| COMPATIBILITY_ONLY | Alias or leftover name. Do not build features on it. |
| MIGRATION_PENDING | Dual-read allowed only under an explicit ADR. |
| TEST_ONLY | Test fixtures / range. Not product surface. |
| SIMULATION_ONLY | Legal to run; not live. Current default for the tree. |
| REMOVE_AFTER_MIGRATION | Scheduled deletion after the migration ADR completes. |

Classified leftovers on this tree:

| Item | State | Notes |
| --- | --- | --- |
| capability `moonrey-coin` / `packages/moonrey-coin` | DEPRECATED | SUPERSEDED; package must not exist |
| capabilities `blockchain-node`, `blockchain-network` | DEPRECATED | placeholders; use `packages/sunrey-chain` |
| npm scope `@solstice/*` | COMPATIBILITY_ONLY | package identity is SunRey; do not add a second scope as a new core |
| `SOLSTICE_*` env prefix | COMPATIBILITY_ONLY | official legacy alias of `SUNREY_*` |
| `SolsticeIdentityId` | COMPATIBILITY_ONLY | deprecated alias of `SunReyIdentityId` |
| historical PRs #12, #16, #17, #18, #19, #52 | DEPRECATED | not automatically canonical; salvage only per `historical-implementation.md` |
| `apps/explorer` displayed balances | TEST_ONLY / projection | not books |
| `packages/sunrey-range` | TEST_ONLY | adversarial range; not a second ledger |
| `packages/sunrey-economics` | SIMULATION_ONLY | dual-economy lab; not production policy |
| EVM / WASM runtime capability | MIGRATION_PENDING / MANUAL_REVIEW | do not treat as a second chain |
| application vs native SunRey Coin | MIGRATION_PENDING | dual authority until a Kernel-gated ADR |

No future code may begin depending on DEPRECATED implementations
without an explicit exception (section 18).

## 16. Prohibited architecture patterns

- A second Ledger, Kernel, Execution Authority issuer, Evidence Vault,
  or Money type
- A second Agent runtime that can execute
- A second Exchange matching core
- A second blockchain, consensus, or mint package
- A second compliance / KYC / AML control plane
- Frontend or Agent writing journals or holding master keys
- Provider adapter becoming the books
- Conflating PEG, PEVE, explorer, or ops databases with balances
- Percentage-return, blended yield, APY, or APR fields on balance /
  growth paths
- Catching a Kernel refusal and continuing
- Flipping `ENVIRONMENT` or any `LIVE_*` flag
- Creating `packages/moonrey-coin`, `packages/ledger-v2`,
  `packages/kernel-v2`, `packages/sunrey-exchange-v2`,
  `packages/sunrey-chain-v2`, `packages/agent-v2`, or other competing
  paths already forbidden by the architectural linter

## 17. Future productization rules

Before adding a component, follow
`docs/productization/SUNREY_PRODUCTIZATION_ENGINEERING_RULES.md`.

Productization means extending the owners in section 3: APIs, BFF,
authn hardening, provider adapters behind existing ports, Exchange
product surfaces, Agent tools, custody reconciliation, and
documentation. It does not mean a new core.

Production gates stay closed unless the task explicitly concerns
authorized production activation. Even then, this freeze does not
itself authorize activation.

## 18. Exception process

An exception is allowed only when all of the following are true:

1. The change cannot extend an existing canonical owner.
2. A written exception is added under `docs/architecture/` (ADR or
   chunk declaration) naming the domain, the rejected canonical path,
   the risk, and the expiry.
3. `docs/productization/sunrey-authority-map.json` is updated in the
   same PR.
4. The architectural linter is updated in the same PR so the exception
   is mechanical, not tribal knowledge.
5. Human review is recorded. AI may not grant the exception.

Silent bypass, `// exception`, or a test-only import of a DEPRECATED
package into production source is not an exception.
