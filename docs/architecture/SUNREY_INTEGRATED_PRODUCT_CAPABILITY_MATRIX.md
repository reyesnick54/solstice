# SunRey Integrated Product Capability Matrix

**Status:** Wave 8 integrated product audit (2026-09-02)  
**Environment:** `ENVIRONMENT=simulation`; all `LIVE_*` flags `false`  
**Scope:** End-to-end product integration across blockchain, proof, awareness, MoonRey, SunRey, policy, identity, wallet, ledger, exchange, agents, vault, API, frontend, and operations.

## Status legend

| Status | Meaning |
| --- | --- |
| **PRODUCTION_CAPABLE** | Core logic suitable for production; blocked by `ENVIRONMENT`, `LIVE_*`, ceremony, or provider gates |
| **SANDBOX_READY** | Runnable sandbox/demo path with explicit simulation labeling |
| **IMPLEMENTED_NON_PRODUCTION** | Substantial code; dev/testnet/simulation scope only |
| **PARTIAL** | Some layers complete; others stubbed, in-memory, or unwired |
| **SIMULATION** | Explicit simulation adapter, in-memory default, or fixture-only path |
| **FRONTEND_ONLY** | UI or client surface without durable backend authority |
| **BACKEND_ONLY** | Backend logic without consumer product surface |
| **REGULATED_PROVIDER_REQUIRED** | Contract exists; live regulated provider absent |
| **NOT_IMPLEMENTED** | Declared absent or no code path |
| **BLOCKED** | Explicitly forbidden or fail-closed by constitution / flags |

Production mainnet, live banking, live investment, and live custody remain **BLOCKED** regardless of row status.

---

## Identity, authentication, and home

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| Authentication | SANDBOX_READY | `services/api/src/consumer/session.ts` — Bearer + sandbox personas; identity session store |
| Human Economic Identity | PARTIAL | HIN `SubjectRef` + identity `ActorContext`; no production federation mesh |
| Home | SANDBOX_READY | Consumer BFF orchestrator aggregates accounts, wallets, grow, exchange summaries |
| Action Center | SANDBOX_READY | `GET /api/v1/me/actions`; Kernel states preserved; access adapter merges events |
| Fine-Grained Authorization | PARTIAL | Kernel six proofs + EA scope; OPA/OpenFGA deferred; platform API `nullAuthenticator` |

---

## Money, wallet, and transfers

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| Money (fiat positions) | SANDBOX_READY | `services/accounts` + ledger read model; class breakdown enforced |
| Wallet (native custody) | SANDBOX_READY | `packages/custody` product service; `providerBalanceIsTruth: false` |
| Native Transfers | SIMULATION | Chain protocol transfers + custody withdrawal simulation; finality in dev harness |
| Fiat Transfers | SANDBOX_READY | Kernel-gated deposit/withdraw/transfer via `services/accounts` |
| Cards | SIMULATION | `packages/cards`; PCI-minimized fields; live issuer **REGULATED_PROVIDER_REQUIRED** |
| Conversion | SIMULATION | FX quote engine; live execution **REGULATED_PROVIDER_REQUIRED** |

---

## Grow My Money and agents

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| Grow My Money | SANDBOX_READY | `packages/platform` + BFF `/api/v1/grow`; lifecycle fixtures |
| Agent Advice | SANDBOX_READY | `packages/sunrey-agent` conversation + action cards; proposals only |
| Agent Execution | BLOCKED | `LIVE_AGENT_FINANCIAL_EXECUTION_ENABLED=false`; ProposalGate; human approval required |
| Vault | SANDBOX_READY | `packages/personal-data-vault`; purpose/capability gates; third-party consent **PARTIAL** |
| Consent | PARTIAL | `packages/consent` + HIN grants; durable consent ledger not wired to all vault paths |
| HIN | SANDBOX_READY | `packages/information-market`; usage receipts; no raw PDV on chain |

---

## Native assets and issuance

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| SunRey Coin | SIMULATION | Chunk 71 gate + human-economy pipeline; application + native dual supply documented |
| MoonRey Coin | SIMULATION | Productive path via Chunk 71; `moonreyIssuanceActivated(): false` |
| SunRey Issuance | SANDBOX_READY | HIN → verification → PEVE → governance → Chunk 71 → chain simulation |
| MoonRey Issuance | SANDBOX_READY | Oracle → productive claim → GPUV → governance → Chunk 71 → chain simulation |
| Economic Claims | PARTIAL | Fingerprints + registries; sovereign `CanonicalEconomicClaim` **NOT_IMPLEMENTED** |
| PEVE | SIMULATION | Valuation engine; not exchange price; human-worth prohibition enforced |
| GPUV | SIMULATION | Productive value function; distinct from MoonRey market price |

---

## Exchange and portfolio

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| Exchange | SANDBOX_READY | `packages/sunrey-exchange` consumer + productization; red-team 0 unauthorized mutations |
| Market Data | SIMULATION | Fixture / reference providers; live market data **REGULATED_PROVIDER_REQUIRED** |
| Portfolio | SANDBOX_READY | Consumer exchange + grow portfolio views; derived read models |

---

## APIs and economic intelligence

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| APIs (Consumer BFF) | SANDBOX_READY | `/api/v1/*` versioned; orchestration only; `productionActive: false` on health |
| APIs (Platform) | PARTIAL | `/api/v1/me` auth check; most routes scaffold; internal gates token-protected |
| Economic Awareness | PARTIAL | Provider registry, trust engine, fabric batches — in-memory default |
| Provider Integration | SANDBOX_READY | Fixture/sandbox adapters; ~73/126 catalog providers |
| Human Attestation Mesh | NOT_IMPLEMENTED | Wave 6 spec only |
| MoonRey Oracle Mesh | SIMULATION | Quorum finalization in simulation; durable mesh **PARTIAL** |

---

## Ledger, evidence, policy, and blockchain

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| Ledger | PRODUCTION_CAPABLE | `Ledger.postJournal` EA-required; PG adapter exists; default in-memory |
| Evidence Vault | PRODUCTION_CAPABLE | Hash-chained; PG adapter exists |
| Policy Engine | IMPLEMENTED_NON_PRODUCTION | Compliance Kernel six proofs; country logic not in app services |
| Blockchain Explorer/Query | SIMULATION | `apps/explorer` static demo; Rust RPC loopback dev only |
| Governance | SANDBOX_READY | Human governance records; AI cannot approve issuance |
| Admin | BLOCKED | No admin mint/supply bypass; `check-kernel-gating.mjs` CI enforced |

---

## Operations, apps, and deployment

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| Observability | PARTIAL | Metrics in chain/consensus; unified product health **PARTIAL** |
| Backup/Recovery | PARTIAL | redb snapshots + PG migrations; product in-memory stores not fully durable |
| Web App | FRONTEND_ONLY | Lovable/preview integration via Consumer BFF; no standalone production web app in repo |
| Mobile App | NOT_IMPLEMENTED | Chunk 97 mobile-sync types; no shipped mobile client in `apps/` |
| Sandbox Deployment | SANDBOX_READY | Preview server, sandbox personas, explicit `simulation` labeling |
| Production Mainnet | BLOCKED | Chunks 164–167 ceremony; all activation gates fail-closed |

---

## Regulated rails (explicitly gated)

| Capability | Status | Notes |
| --- | --- | --- |
| Live Banking Rails | BLOCKED | `LIVE_BANKING_RAILS=false`; payments **REGULATED_PROVIDER_REQUIRED** |
| Live Investment Rails | BLOCKED | `LIVE_INVESTMENT_EXECUTION=false`; grow execution simulation only |
| Live Crypto/Custody Rails | BLOCKED | `LIVE_CUSTODY_ENABLED=false`; `LIVE_CRYPTO_ENABLED=false` |

Consumer catalog surfaces label these `AVAILABLE_SIMULATION` with `EXTERNAL_PROVIDER_REQUIRED` for live paths (`services/api/src/consumer/resources.ts`).

---

## Integration authority summary

| Plane | Canonical authority | Secondary projections |
| --- | --- | --- |
| Native supply | Chunk 71 + SunRey Chain native assets | Custody read model, exchange coin port (simulation) |
| Fiat money | Ledger journals (EA-gated) | Account position read model |
| Exchange settlement | Ledger + idempotent settlement coordinator | Exchange store (simulation) |
| Personal data | Personal Data Vault + consent | HIN hashed anchors only on chain |
| Agent actions | ProposalGate → Kernel (no EA from agent) | Action Center UI state |

Reconciliation **detects** mismatches and **never** rewrites blockchain canonical state (`packages/sunrey-chain/src/sync/reconciliation.ts`).

---

## Cross-wave dependency notes

| Prior wave | Integrated product impact |
| --- | --- |
| Wave 2 blockchain | PASS — determinism, replay, supply reconciliation hold in simulation |
| Wave 3 economic proof | FAIL — five roots, durable claim registry, proof bundles not production-wired |
| Wave 4 awareness | FAIL — unified fabric journal and federation incomplete |
| Wave 5 MoonRey | PASS (simulation) — productive path isolated from market price |
| Wave 6 SunRey human | FAIL — durable replay, attestation mesh, proof-bundle wiring gaps |
| Wave 7 privacy/policy | NOT STARTED — API auth hardening, durable RightsRoot, mandate persistence |

Wave 8 integration **verifies** that simulation product paths compose without authority leaks; it does **not** close prior wave blockers.

---

## Conservative product maturity statement

The integrated SunRey product is **sandbox-ready for demonstration and engineering qualification** across human and productive economy flows. It is **not production-capable** as a whole: mainnet, live regulated rails, durable cross-restart monetary replay, mobile client, and sovereign economic proof roots remain blocked or incomplete.
