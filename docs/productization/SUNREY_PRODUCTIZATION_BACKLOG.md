# SunRey productization backlog

Phase A Prompt 2 companion to
[`SUNREY_CANONICAL_IMPLEMENTATION_INVENTORY.md`](./SUNREY_CANONICAL_IMPLEMENTATION_INVENTORY.md).

This is engineering truth, not a feature wishlist. Items exist because the
current tree cannot honestly present a single product backend, cannot survive
restart on the public path, or cannot connect a regulated provider without
lying about authority.

`ENVIRONMENT` stays `simulation`. `LIVE_*` stays `false` until a later,
explicitly authorized prompt. This backlog does **not** authorize those
changes.

---

## P0 — blocks productization

These prevent Phase B from exposing a truthful product surface. If Phase B
ships the current `/v1` gateway as “the API,” it will encode the wrong
authority.

| ID | Finding | Why it blocks | Canonical owner to extend | Do not |
| --- | --- | --- | --- | --- |
| P0-1 | Public `/v1` mutates `DevelopmentPlatform` Maps, not Kernel → `services/accounts` → `Ledger` | Callers would treat fixture chain/exchange state as books | `packages/sunrey-sdk` gateway **or** a new facade that only fronts existing services | Invent a second ledger or EA issuer |
| P0-2 | `services/accounts`, identity, payments, cards have no HTTP | The only complete money path is a library/demo | `services/accounts` + Phase B gateway | Copy banking into the SDK platform |
| P0-3 | Exchange `settleTrade` writes synthetic `journalId`s via `InMemoryCoinPort` / `InMemoryFiatPort` | Exchange balances can diverge from the ledger | `packages/sunrey-exchange` ports → ledger/custody adapters | Delete the ports; they are the seam |
| P0-4 | `UserAgentMandateEngine.requestExecution` stops at Kernel status + a receipt | Agent ALLOW is not execution; productizing it as automation would be false | `packages/sunrey-agent` must hand a verified human path to a gated service | Let the agent call `postJournal` or `AuthorityIssuer` |
| P0-5 | Three live state machines for “the chain” (Rust+redb, TS wallet `height++`, SDK platform) | Phase B cannot pick a source of chain truth from filenames | Rust node for protocol; SDK must not remain a third chain | Merge chain balances into bank balances |
| P0-6 | Default gateway, exchange, agent, and holds lose all state on restart | A product process that forgets orders, mandates, and holds is not productizable | Wire existing PG/file adapters; add missing hold/agent stores | Invent a fifth database engine |
| P0-7 | Custody Kernel-gates but never `postJournal`s | Custody positions are not books | `packages/custody` through existing journal API | Treat custody Maps as balances |
| P0-8 | `/v1/accounts` (chain account) vs banking `AccountsService` name collision | Phase B will ship the wrong “account” unless this is decided first | Document and split routes; banking uses the Kernel path | Silently alias them |

P0 is **not**: missing Grok, missing live banks, explorer polish, or renaming `@solstice/*`.

---

## P1 — required before a production release candidate

Required for an honest **simulation production-candidate** (durable, wired,
contract-complete) while flags remain false.

| ID | Finding | Notes |
| --- | --- | --- |
| P1-1 | Wire Exchange `FiatPort` / `CoinPort` to Kernel-gated ledger and/or `SunReyCoinService` + custody | Keep ports; replace in-memory implementations |
| P1-2 | After agent Kernel ALLOW, only a human-gated financial service may consume EA | ProposalGate stays conversion-only |
| P1-3 | Durable agent mandate/proposal store | No DB migration exists today |
| P1-4 | PostgreSQL (or accepted durable) adapter for holds | `HoldStore` is memory-only |
| P1-5 | Either use Exchange V025 SQL or mark it unused-and-reserved | Schema without writers is a lie |
| P1-6 | Wire `db/explorer` into the migrator **or** delete the claim that explorer PG exists | Rebuildable projection; do not make explorer authoritative |
| P1-7 | Map OpenAPI → one HTTP surface with auth, idempotency, and `ApiErrorEnvelope` | Developer `/v1/developer/*` is CLI-only today |
| P1-8 | Decide HIN consent vs `packages/consent` | Bridge or document as a separate context |
| P1-9 | Implement or explicitly refuse `SunReyCoinService.chainAdapter` | Today `implemented: false` |
| P1-10 | Replace `UnwiredNativeAssetSettlementAdapter` with a real simulation adapter that still does not mint | `ADAPTER_UNWIRED` is a typed hole |
| P1-11 | Persist HTTP idempotency keys | Journal keys already survive restart; RPC keys do not |
| P1-12 | Growth Orchestrator is demo-only | Either a facade or an explicit “lab, not product path” label |

---

## P2 — required before live launch

These require counsel, commercial contracts, and flag changes that this
repository currently forbids. Listed so they are not mistaken for Phase B
work.

| ID | Finding | Constraint |
| --- | --- | --- |
| P2-1 | Real bank / payment-rail / FX adapters | `LIVE_PAYMENTS_ENABLED` / `LIVE_BANKING_RAILS` stay false until authorized |
| P2-2 | Real KYC / AML / case-management vendors | `LIVE_EXTERNAL_KYC` stays false; Kernel remains the decision layer |
| P2-3 | Real Travel Rule network | Fixture candidate must not replace `TravelRuleNetworkPort` by sneak |
| P2-4 | Production HSM / KMS (not `DevelopmentHsmSimulator`) | `PORT_ONLY` / `SIMULATION` today |
| P2-5 | Oracle HTTP only with licensed data rights and fail-closed transport | `NodeExternalHttpTransport` must not be enabled in FIXTURE/SANDBOX |
| P2-6 | Exchange commercial liquidity / market-data vendors | `commercialPricing: false` today |
| P2-7 | Production signing of Execution Authority and chain keys | Simulation key provider is not a launch key |
| P2-8 | Counsel-confirmed corridors and policy rules | Do not mark `CONFIRMED_BY_COUNSEL` in this backlog |
| P2-9 | WebAuthn RPID and legal-entity display names | Currently simulation.solstice.local / Solstice UK Ltd (simulation) |
| P2-10 | Mainnet / LIVE money | Chunk 143–167 rehearsal path exists; `mainnetEnabled=false` is correct |
| P2-11 | Network-enabled S3M (if used at all) | Inference remains advisory; never EA |
| P2-12 | Operator auth stronger than local token / header presence | Current consumer auth is not an identity proof |

---

## P3 — post-launch enhancement

| ID | Finding | Why it is not a blocker |
| --- | --- | --- |
| P3-1 | Grok provider (`GROK_NOT_IMPLEMENTED`) | Reserved Chunk 103; S3M-primary is enough |
| P3-2 | Differential privacy in clean-room | Typed `NOT_IMPLEMENTED`; not required to productize the spine |
| P3-3 | `agentic-capital-mesh` service facade | Near-orphan lab |
| P3-4 | Cosmetic `@solstice/*` / GitHub `solstice` rename | `API_COMPATIBILITY_DO_NOT_CHANGE_YET` / `INTERNAL_SAFE_TO_KEEP` |
| P3-5 | Explorer HA beyond Chunk 93 rehearsal | Projection UI |
| P3-6 | Dual-economy laboratory UX | `packages/sunrey-economics` is not the mint |
| P3-7 | Public ticker assignment | `NOT_ASSIGNED` is correct |
| P3-8 | Stale constitution sentence “Do not create `packages/sunrey-economics`” | Clarify in a later docs pass; lab already exists |

---

## Explicitly out of scope (not backlog)

- Reimplementing Money, Kernel, Execution Authority, Evidence Vault, ledger, or account classes
- Turning on `LIVE_*` or changing `ENVIRONMENT`
- Connecting real banks, FX, or payment providers in this phase
- Building the final API Gateway (Phase B)
- Mass rename of solstice identifiers
- Deleting Exchange ports, agent isolation, or simulation adapters because they look like duplicates

---

## Suggested Phase B entry conditions

Phase A Prompt 3 / Phase B may start when:

1. This inventory is accepted as repository truth.
2. P0-8 (account namespace) has an explicit decision.
3. Phase B is specified as **fronting** `services/accounts` + Kernel, not `DevelopmentPlatform`.
4. Production remains disabled.

Prompt 2 does not start Prompt 3.
