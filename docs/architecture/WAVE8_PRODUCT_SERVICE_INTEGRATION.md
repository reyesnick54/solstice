# Wave 8 — Product Service Integration

**Program:** SunRey Sovereign Architecture — Wave 8 (Product Integration)  
**Date:** 2026-09-02  
**Environment:** `ENVIRONMENT=simulation`; all `LIVE_*` flags `false`  
**Prerequisite:** WAVE 7 EXIT GATE: **PASS**

Wave 8 integrates Waves 2–7 domain systems into one coherent product surface without collapsing authority boundaries. Canonical monetary truth remains on the sovereign SunRey blockchain; PostgreSQL, API, Exchange, wallet, frontend, agent, and admin layers are **not** monetary authority.

---

## 1. Executive Summary

| Dimension | Before Wave 8 | After Wave 8 |
| --- | --- | --- |
| Product HTTP surface | BFF on `preview-main.ts` only; platform `main.ts` thin | Boundaries documented; durable runtime factory added |
| Persistence default | In-memory for BFF sandbox (`fixtures.ts`) | `createProductIntegrationRuntime()` supports DURABLE mode |
| Service boundaries | Scattered across AGENTS.md and wave reports | `PRODUCT_SERVICE_BOUNDARIES` canonical map |
| Chain references | Ad hoc fields in tests | `CanonicalBlockchainReference` + `ledger.chain_reference_anchor` |
| Startup order | Undocumented | `PRODUCT_SERVICE_STARTUP_ORDER` with degraded modes |
| Data ownership | `persistence.md` + wave matrices | `SUNREY_DATA_OWNERSHIP_MATRIX.md` |

**Verdict:** Wave 8 Prompt 1 complete — architecture formalized, integration primitives added, durable wiring path established. Mainnet and `LIVE_*` remain blocked.

---

## 2. Product Service Architecture

```text
                    ┌─────────────────────────────────────────┐
                    │  MOBILE / WEB (Lovable preview clients) │
                    └────────────────────┬────────────────────┘
                                         │ HTTPS
                    ┌────────────────────▼────────────────────┐
                    │  CONSUMER API / BFF (services/api)      │
                    │  orchestration only — no EA, no mint    │
                    └─┬──────┬──────┬──────┬──────┬──────┬───┘
                      │      │      │      │      │      │
         ┌────────────┘      │      │      │      │      └────────────┐
         ▼                   ▼      ▼      ▼      ▼                   ▼
   ┌──────────┐      ┌──────────┐ ┌────────┐ ┌────────┐      ┌──────────┐
   │ ACCOUNTS │      │ EXCHANGE │ │ WALLET │ │ AGENT  │      │   VAULT  │
   │ + LEDGER │      │ matching │ │project.│ │Proposal│      │ PDV+cons.│
   └────┬─────┘      └────┬─────┘ └───┬────┘ └───┬────┘      └────┬─────┘
        │                 │           │          │                  │
        │    Kernel → EA → postJournal (fiat / app SunRey only)     │
        │                 │           │          │                  │
        ▼                 ▼           ▼          ▼                  ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │  ECONOMIC PLANES (non-authoritative intelligence)                   │
   │  Awareness Fabric · Human Economy · Productive Economy · PEG       │
   └───────────────────────────────┬─────────────────────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        ▼                          ▼                          ▼
   ┌─────────┐              ┌─────────────┐            ┌─────────────┐
   │ KERNEL  │              │  EVIDENCE   │            │  IDENTITY   │
   │ 6 proofs│              │    VAULT    │            │  + CONSENT  │
   └────┬────┘              └─────────────┘            └─────────────┘
        │
        ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │  SOVEREIGN SUNREY BLOCKCHAIN (canonical native SUNREY / MOONREY)    │
   │  Chunk 71 MonetaryIssuanceAuthority · BFT simulation · redb store   │
   └─────────────────────────────────────────────────────────────────────┘
        ▲
        │ outbox/inbox event fabric (solstice_ledger)
        │
   ┌────┴────────────────────────────────────────────────────────────────┐
   │  PostgreSQL (four bounded DBs — operational persistence, NOT mint)  │
   └─────────────────────────────────────────────────────────────────────┘
```

### Service inventory (classified)

| Component | Location | Classification | Wave 8 role |
| --- | --- | --- | --- |
| Platform API | `services/api/src/main.ts` | development, unconnected to BFF | Future unified entry |
| Consumer BFF | `services/api/src/consumer/` | sandbox, development | Primary product orchestration |
| Legacy consumer platform | `services/consumer-platform/` | duplicated, legacy | Consolidate toward BFF |
| Accounts + Ledger | `services/accounts`, `packages/ledger` | production-capable (simulation) | Kernel-gated money movement |
| Exchange | `packages/sunrey-exchange` | sandbox, in-memory default | Matching; settles via ports |
| Wallet | `packages/custody/product`, `sunrey-chain/wallet` | sandbox | Projection of chain state |
| Agent | `packages/sunrey-agent` | in-memory default | ProposalGate only |
| Vault | `packages/personal-data-vault` | in-memory default | PDV + minimization |
| Blockchain node | `packages/sunrey-chain` (Rust + TS) | simulation | Canonical native supply |
| Providers | `provider-sdk`, `provider-runtime` | mock, fixture-only | Observations only |
| Admin / governance | `kernel/operations`, `governance-ops` | simulation | Staff SoD; no mint |

---

## 3. Service Boundaries

Canonical definitions live in `services/api/src/product-integration/boundaries.ts`.

| Service | Owns | Must NOT |
| --- | --- | --- |
| **Blockchain Node** | Native asset supply, finalized monetary state | `postJournal`, issue EA, store raw PDV |
| **Blockchain Query** | Read-only finalized state, proofs | Mutate supply |
| **Ledger** | Journals, postings (fiat / app SunRey) | Canonical native supply; `Account.balance` column |
| **Wallet** | User-facing chain/ledger projection | Be supply authority; client-supplied EA |
| **Exchange** | Orders, trades, settlement workflow | Mint; conflate price with valuation |
| **Agent** | Mandates, proposals | Import `AuthorityIssuer`; auto-execute |
| **Vault** | Encrypted subject data | On-chain raw payloads; bypass consent |
| **Consumer API** | HTTP orchestration | Mint; bypass Kernel |
| **Admin/Governance** | Ceremony rehearsal, ops cases | Activate mainnet; post journals |

---

## 4. Ledger / Chain Responsibility Split

| Plane | Authority | Examples |
| --- | --- | --- |
| **Blockchain** | Canonical native SUNREY/MOONREY supply | `AssetSupplyBook`, issuance receipts, native transfers |
| **Ledger** | Application accounting journals | Deposits, withdrawals, fiat, app SunRey Coin |
| **Wallet projection** | Read model of ownership | Custody balances, chain account views |
| **Exchange** | Market operations | Orders, trades, settlement intents |

**Rules preserved:**

- Ledger wins over chain for fiat and application SunRey until migration ADR
- Wallet projections are rebuildable; chain + ledger are authoritative
- Exchange simulation ports (`InMemoryCoinPort`) are not production authority
- Reorg marks `REORG_OBSERVED` — never rewrite journals or vault

---

## 5. Blockchain Reference Model

Operational records associated with monetary events carry a `CanonicalBlockchainReference`:

| Field | Purpose |
| --- | --- |
| `chainId` | Network identifier |
| `transactionId` | Canonical chain transaction |
| `finalizedBlockHeight` | Finality gate |
| `finalizedBlockHash` | Block commitment |
| `monetaryStateRoot` | Supply state root at finalization |
| `economicClaimId` | Link to verified claim (optional) |
| `economicReceiptId` | Issuance receipt (optional) |

Type: `packages/domain/src/blockchain-reference.ts`  
Durable anchor: `ledger.chain_reference_anchor` (V010 migration)  
Persistence: `packages/persistence/src/ledger/chain-reference-anchor.ts`

**PostgreSQL does not duplicate writable supply.** Anchors are traceability metadata only.

---

## 6. Event Integration (Outbox / Inbox)

Existing event fabric (`db/ledger/V002`, `V003`, `V007`):

| Mechanism | Table | Role |
| --- | --- | --- |
| Domain events | `ledger.domain_event` | Append-only canonical envelope |
| Outbox | `ledger.outbox` | At-least-once delivery state |
| Inbox | `ledger.inbox` | Consumer deduplication |
| Dead letter | `ledger.dead_letter` | Inspectable failures |
| Async fabric | `ledger.job`, `ledger.workflow` | Background orchestration |

**Pattern:** Financial mutation commits journal + domain event + outbox in one ledger transaction. Dispatcher is outside the transaction. Evidence seals in parallel unit of work per `persistence.md`.

Cross-service integration uses opaque IDs (customer, account, journal, evidence, chain tx) — no cross-database SQL joins.

---

## 7. Reconciliation Architecture

`ProductReconciliationLink` (`packages/domain/src/product-reconciliation-link.ts`) traces:

| Downstream | Upstream anchor |
| --- | --- |
| Ledger posting | Chain transaction + journal ID |
| Wallet projection | Finalized chain state |
| Exchange settlement | Chain transaction / ledger entry |
| SunRey issuance receipt | Economic claim + finalized tx |
| MoonRey issuance receipt | Productive claim + finalized tx |

Treasury and custody reconciliation tables exist in `solstice_customer` (V032, V027). Chain reference anchors extend ledger-side traceability.

---

## 8. Startup / Recovery Order

Defined in `services/api/src/product-integration/startup-order.ts`.

| Phase | Services | Degraded behavior |
| --- | --- | --- |
| 1 | config, persistence | No durable writes |
| 2 | evidence, policy | In-memory seals only |
| 3 | blockchain-node, blockchain-query | Stale native balances flagged |
| 4 | ledger, accounts | Read-only until evidence durable |
| 5 | identity, consent | Deny-all on consent mutations |
| 6 | economic planes | Cached observations only |
| 7 | exchange, custody | Matching paused |
| 8 | agent, vault | Proposals / read-only |
| 9 | consumer-api | Read-only surface |
| 10 | admin-governance | Auditor read-only |

**Rule:** Do not report chain-derived balances as current when node/indexer height lags.

---

## 9. In-Memory State — Removed / Remaining

### Wired to durable path (Wave 8)

| State | Durable store | Adapter |
| --- | --- | --- |
| Accounts / journals | `solstice_ledger` | `createPostgresSimulationRuntime` |
| Consent | `solstice_customer` V020 | `persistConsentState` |
| Agent mandates | `solstice_customer` V037 | `persistAgentRuntimeState` |
| Chain ops metadata | `solstice_customer` V024 | `persistSunReyChainState` |
| Exchange core | `solstice_customer` V025–V027 | `persistExchangeCoreSnapshot` |
| Chain reference anchors | `solstice_ledger` V010 | `insertChainReferenceAnchor` |

### Remaining in-memory (acceptable or Wave 8+ )

| State | Classification | Notes |
| --- | --- | --- |
| BFF sandbox (`fixtures.ts`) | sandbox | Default for unit tests / Lovable |
| `AssetSupplyBook` / replay books | chain-authoritative | Embedded redb; not PG |
| Economic claim registry | partial | Wave 3 gap; fingerprints in simulation |
| Fabric observation journal | partial | Wave 4 gap |
| HEC registry PG adapter | gap | Schema partial (V023, V012) |
| Data rights product store | gap | V038 schema; no load adapter |
| Wallet mobile-sync | unconnected | No BFF routes |
| Provider fixtures | mock | By design until counsel |

### Acceptable caches (rebuildable)

- Wallet projection store, access state replay, market data sequences, AI preview cache, intelligence caches

---

## 10. Data Migration Findings

**Do not import simulated monetary supply into canonical chain state.**

| Record class | Disposition |
| --- | --- |
| Ledger journals / evidence | **Safe to migrate** — append-only; already in PG path |
| Consent / agent / PDV snapshots | **Safe to migrate** — PG adapters exist |
| Exchange sandbox orders | **Projection only** — rebuild from PG when wired |
| In-memory `AssetSupplyBook` seeds | **Sandbox only** — discard on production genesis |
| Simulation governance refs | **Sandbox only** — cannot authorize production |
| Fixture provider observations | **Discard** — no production meaning |
| Duplicate consumer-platform sessions | **Requires transformation** — consolidate to BFF auth |
| Unverified HEC / productive claims | **Requires manual review** before monetization |
| Application → native SunRey supply | **Blocked** — requires Kernel-gated migration ADR |

No production migrations executed in Wave 8 Prompt 1.

---

## 11. Tests

| Suite | Command | Scope |
| --- | --- | --- |
| Wave 8 integration | `node --experimental-strip-types --test tests/wave-8-product-service-integration.test.ts` | Boundaries, startup, chain refs, runtime |
| Wave 7 red team | `tests/wave-7-privacy-identity-policy-red-team.test.ts` | Privacy/control plane regression |
| Wave 2 blockchain | `tests/wave-2-*.test.ts` | Chain security |
| Wave 3–6 | respective wave test files | Economic planes |
| Persistence | `npm run test:persistence` | PG integration (when DB up) |
| Full CI | `npm run ci` | Seven-stage pipeline |

---

## 12. Files Created / Modified

**Created:**
- `docs/architecture/WAVE8_PRODUCT_SERVICE_INTEGRATION.md`
- `docs/architecture/SUNREY_DATA_OWNERSHIP_MATRIX.md`
- `packages/domain/src/blockchain-reference.ts`
- `packages/domain/src/product-reconciliation-link.ts`
- `db/ledger/migrations/V010__chain_reference_anchor.sql`
- `packages/persistence/src/ledger/chain-reference-anchor.ts`
- `services/api/src/product-integration/` (boundaries, startup-order, runtime, index)
- `tests/wave-8-product-service-integration.test.ts`

**Modified:**
- `packages/domain/src/index.ts` — export new types
- `packages/persistence/src/index.ts` — export chain anchor functions

---

## 13. Wave 9 Handoff

Wave 9 (adversarial testing / mainnet readiness) requires:

1. Full BFF → durable PostgreSQL default on staging paths
2. Consolidate `services/consumer-platform` into BFF
3. Wire Kernel → postJournal on all HTTP financial mutations
4. Durable economic claim / anti-replay registry (Wave 3 completion)
5. Fabric durable journal (Wave 4 completion)
6. HEC registry PG adapter (Wave 6 completion)
7. Adversarial range (`packages/sunrey-range`) on integrated product paths

**Do not activate mainnet or flip `LIVE_*` without human ceremony.**

---

*End of Wave 8 Product Service Integration — Prompt 1.*
