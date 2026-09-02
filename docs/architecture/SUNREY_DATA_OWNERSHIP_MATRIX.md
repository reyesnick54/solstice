# SunRey Data Ownership Matrix

**Status:** Wave 8 authoritative data-ownership reference (2026-09-02)  
**Environment:** `simulation`; four bounded PostgreSQL databases unchanged  
**Companion:** `docs/architecture/WAVE8_PRODUCT_SERVICE_INTEGRATION.md`, `docs/architecture/persistence.md`

Database names remain **`solstice_customer`**, **`solstice_ledger`**, **`solstice_evidence`**, **`solstice_security`**. No cross-database SQL joins.

---

## 1. Bounded Databases

| Database | Runtime role | Owner domain | Supply authority |
| --- | --- | --- | --- |
| `solstice_customer` | `customer_app` | Customer, identity, product schemas | **None** |
| `solstice_ledger` | `ledger_writer` / `ledger_reader` | Journals, events, operations | **None** (fiat/app journals only) |
| `solstice_evidence` | `evidence_app` | Evidence Vault hash chain | **None** |
| `solstice_security` | `security_app` | Key metadata, service identity refs | **None** |
| Embedded block store (redb) | chain node | Native asset supply | **Canonical native supply** |

Explorer DB (`db/explorer/`) is a **derived, non-authoritative** index — not in canonical `DATABASES` list.

---

## 2. Major Entity Ownership

### Customer / Identity (`solstice_customer`)

| Table / entity | Owner service | Authoritative purpose | Readers | Writers | Immutability | Chain ref | Retention |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `customer.customer` | Accounts / Identity | Customer identity record | BFF, Kernel, compliance | Accounts (via EA) | Versioned updates | None | Policy-driven |
| `customer.legal_entity` | Accounts | Legal entity catalog | All product services | Catalog seed / admin | Rare updates | None | Permanent |
| `identity.session` | Identity | Login sessions | BFF, API | Identity service | Expire / revoke | None | Session TTL |
| `identity.actor` | Identity | ActorContext binding | Kernel, BFF | Identity service | Append audit | None | Policy-driven |
| `consumer_authentication.*` | Identity / BFF | Consumer auth tokens | BFF | Auth service | Revocable | None | Session TTL |
| `policy.*` | Kernel | Policy packs and versions | Kernel | Policy registry | Versioned; retired not deleted | Policy root (future) | Permanent audit |
| `consent.*` | Consent / Vault | Consent grants, permits, ledger | Kernel, BFF, HIN | Consent service | Append-only ledger | Rights root (future) | Purpose + legal hold |
| `consent.rights_request` | Consent product | Data subject requests | BFF Phase H | Data rights engine | State machine | None | Regulatory |
| `personal_data_vault.*` | PDV | Encrypted subject payloads | BFF, clean-room | PDV service | Versioned assets | Content hash only | Purpose + retention |
| `agent_runtime.*` | SunRey Agent | Mandates, proposals, conversations | BFF, ProposalGate | Agent engine | Proposal immutable | None | Policy-driven |
| `information_market.*` | HIN / HEC | Contributions, requests | Human economy | HIN network adapter | Contribution seal | Anchor hash | Permanent audit |
| `peve.*` | HEC / valuation | Data contributions, valuation inputs | Valuation engine | PEVE service | Append audit | None | Research |
| `economic_graph.*` | PEG | Personal economic graph projection | BFF, grow | PEG service | Rebuildable | None | User-controlled |
| `growth.*` | Grow / Platform | Mandates, plans, opportunities | BFF grow | Growth orchestrator | Versioned | None | User-controlled |
| `sunrey_chain.*` | SunRey Chain | Write intents, ops, receipts | Chain service, BFF | Chain adapter | Insert-only ops | **Yes** — tx/receipt IDs | Permanent |
| `sunrey_exchange.*` | Exchange | Orders, trades, settlements | BFF exchange | Exchange engine | Trade immutable | Settlement ref | Financial retention |
| `payments.*` | Payments | Payment orders, rail submissions | BFF payments | Payments orchestrator | State machine | Optional journal ref | Financial |
| `custody.*` | Custody / Wallet | Vaults, wallets, movements | BFF wallets | Custody service | Movement audit | Chain tx ref | Financial |
| `provider_runtime.*` | Provider runtime | Provider health, certs | Awareness fabric | Provider ops | Registration versioned | None | Operational |
| `operations_control.*` | Governance ops | Control plane state | Admin | Staff (SoD) | Audit trail | Ceremony hash | Permanent |

### Ledger (`solstice_ledger`)

| Table / entity | Owner service | Authoritative purpose | Readers | Writers | Immutability | Chain ref | Retention |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ledger.account` | Accounts | Account identity (no balance) | All money services | Accounts (open via EA) | Status transitions | None | Permanent |
| `ledger.journal` | Ledger | Money movement truth (fiat/app) | Accounts, BFF, treasury | `Ledger.postJournal` only | **Insert-only** | Via anchor | Permanent |
| `ledger.posting` | Ledger | Debit/credit lines | Balance reads | `Ledger.postJournal` only | **Insert-only** | Via journal | Permanent |
| `ledger.action_intent` | Kernel path | Submitted intents | Audit | Kernel submit | **Insert-only** | None | Permanent |
| `ledger.authority_audit` | Permissions | EA fingerprint audit | Audit | Authority issuer | **Insert-only** | None | Permanent |
| `ledger.domain_event` | Events | Canonical domain events | Projections | Services via outbox | **Insert-only** | Optional in payload | Permanent |
| `ledger.outbox` / `inbox` | Event fabric | Delivery state | Workers | Dispatcher | Update delivery only | None | Operational |
| `ledger.operation_execution` | Operations | Provider op state machine | Payments, custody | Operation store | State transitions | Provider ref | Financial |
| `ledger.funds_hold` | Accounts / Cards | Card/auth holds | Banking, cards | Hold gateway | CAS versioned | None | Until released |
| `ledger.chain_reference_anchor` | Product integration | Traceability to chain | Audit, reconciliation | Post-finalization | **Insert-only** | **Yes** | Permanent |

### Evidence (`solstice_evidence`)

| Table / entity | Owner service | Authoritative purpose | Readers | Writers | Immutability | Chain ref | Retention |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `evidence.record` | Evidence Vault | Kernel decision seals | Audit, compliance | `EvidenceVault.seal` | **Insert-only** hash chain | Evidence root (future) | Permanent |

### Security (`solstice_security`)

| Table / entity | Owner service | Authoritative purpose | Readers | Writers | Immutability | Chain ref | Retention |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `security.key_metadata` | Security | Key handles, rotation refs | KeyProvider | Security ops | Versioned metadata | None | Until revoked |
| `security.credential_descriptor` | Security | Credential plane refs | Regulated adapters | Security ops | Registration | None | Operational |

---

## 3. Cross-Domain Write Rules

| Rule | Enforcement |
| --- | --- |
| No service writes another domain's financial tables directly | Bounded DB roles; no cross-DB grants |
| Journals only via `Ledger.postJournal` + EA | Kernel gating CI |
| Evidence only via `EvidenceVault.seal` | Append-only triggers |
| Native supply only via Chunk 71 on chain | `AssetSupplyBook` boundary |
| Consent wins over chain receipt | Wave 7 control plane |
| Evidence Vault wins over chain anchor | Constitution |
| Balances derived from postings | No `account.balance` column |

Approved interfaces for cross-domain facts: opaque IDs in events, outbox envelopes, and `ProductReconciliationLink` anchors.

---

## 4. Authority Boundaries (data plane)

```text
┌─────────────────────────────────────────────────────────────┐
│ CANONICAL MONETARY TRUTH                                     │
│ packages/sunrey-chain → AssetSupplyBook (embedded redb)       │
│ Chunk 71 authorizeIssuance()                                  │
└───────────────────────────┬─────────────────────────────────┘
                            │ finalized tx references
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ OPERATIONAL TRACEABILITY (PostgreSQL)                        │
│ ledger.chain_reference_anchor · sunrey_chain.receipt          │
│ ledger.journal · custody.operational_*                        │
│ NOT writable supply authority                                 │
└───────────────────────────┬─────────────────────────────────┘
                            │ derived reads
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ PRODUCT PROJECTIONS (rebuildable)                            │
│ wallet views · exchange balances · BFF read models           │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Event Flows

| Flow | Producer | Event | Consumer | Durability |
| --- | --- | --- | --- | --- |
| Account open | Accounts | `AccountOpened` | BFF, PEG | ledger outbox |
| Deposit | Accounts | `DepositPosted` | Treasury, grow | journal + outbox |
| Consent grant | Consent | `ConsentGranted` | HIN, PDV | customer DB + event |
| Agent proposal | Agent | `AgentProposalCreated` | BFF, human review | agent_runtime + event |
| Exchange trade | Exchange | `TradeExecuted` | Custody, ledger settlement | exchange + outbox |
| Chain write | Chain | `ChainOperationFinalized` | Reconciliation | sunrey_chain + anchor |
| Kernel decision | Kernel | `KERNEL_DECISION` evidence | Audit | evidence DB |

---

## 6. Reconciliation Model

| Source kind | Primary key | Resolves to |
| --- | --- | --- |
| `LEDGER_JOURNAL` | journal ID | chain tx + monetary state root |
| `WALLET_PROJECTION` | wallet/account ID | finalized chain state |
| `EXCHANGE_SETTLEMENT` | settlement ID | journal + chain tx |
| `SUNREY_ISSUANCE_RECEIPT` | receipt ID | economic claim + chain tx |
| `MOONREY_ISSUANCE_RECEIPT` | receipt ID | productive claim + chain tx |
| `CUSTODY_MOVEMENT` | movement ID | chain tx + ledger journal |
| `OPERATION_EXECUTION` | operation ID | provider ref + business key |

Treasury reconciliation: `treasury.reconciliation_run` (V032).  
Chain reconciliation: `sunrey_chain.reconciliation`.  
Ledger anchors: `ledger.chain_reference_anchor` (V010).

---

## 7. Migration Status (Wave 8)

| Data class | Status | Action |
| --- | --- | --- |
| Ledger journals | **Migrated** (PG default on durable path) | Use `createPostgresSimulationRuntime` |
| Evidence chain | **Migrated** | Coordinated with ledger unit |
| Consent store | **Adapter ready** | Wire via `createProductIntegrationRuntime` |
| Agent runtime | **Adapter ready** | Wire via product integration |
| PDV | **Adapter ready** | Wire via product integration |
| Exchange core | **Schema ready** | BFF still uses in-memory sandbox |
| Chain reference anchors | **Schema added V010** | Populate on finalization |
| HEC canonical registry | **Not migrated** | Wave 6+ adapter needed |
| Fabric journal | **Not migrated** | Wave 4+ durable journal |
| Economic claim registry | **Not migrated** | Wave 3+ completion |
| Simulated native supply | **Do not migrate** | Production genesis only |

---

## 8. Explorer and Derived Stores

| Store | Authority | Rebuild source |
| --- | --- | --- |
| `db/explorer` index | Non-authoritative | Chain blocks + privacy policy |
| Wallet projection cache | Rebuildable | Chain + custody events |
| Access fabric projection | Rebuildable | Access events on chain |
| PEG / knowledge graph | Intelligence only | Customer + ledger events |

---

*End of SunRey Data Ownership Matrix — Wave 8.*
