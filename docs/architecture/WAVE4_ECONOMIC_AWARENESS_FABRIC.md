# Wave 4 Economic Awareness Fabric

**Program:** SunRey Sovereign Architecture — Wave 4 (Economic Awareness Fabric)  
**Date:** 2026-09-02  
**Status:** Simulation foundation (Prompt 1)  
**Owner:** `packages/economic-awareness-fabric`  
**Environment:** `simulation`; all `LIVE_*` flags remain `false`

---

## 1. Fabric purpose

The Economic Awareness Fabric is SunRey's **federated information-processing layer** between external economic reality and the Wave 3 Economic Proof Architecture. It implements privacy-preserving, rights-aware economic information awareness — **not** centralized bulk surveillance.

```
External Sources
    ↓
Provider Connectors (provider-sdk + domain adapters)
    ↓
Canonical Observation Envelope
    ↓
Event / Provenance Fabric
    ↓
Entity Resolution
    ↓
Federated Query
    ↓
Economic Knowledge Graph (projection)
    ↓
Source Corroboration
    ↓
Information Consensus (input only — Wave 5+)
    ↓
Verified Economic Facts / Canonical Economic Claims (Wave 3)
    ↓
Monetary Governance (Chunk 71)
    ↓
Blockchain
```

The fabric **observes, ingests, normalizes, correlates, and proposes**. It does **not** mint, set market prices, or issue Execution Authority.

---

## 2. Current external-data architecture (audit summary)

| Domain | Package(s) | Runtime status | Live HTTP | Normalization | Persistence | Provenance |
| --- | --- | --- | --- | --- | --- | --- |
| Macro / FX / markets | `external-data`, `payments/fx-reference` | Fixture (12 providers) | Probe only (2) | Yes → `ExternalObservation` | SWR cache | provider-sdk |
| Crypto / chain intel | `sunrey-exchange/crypto-market`, `sunrey-chain/chain-intelligence` | Fixture | No | Yes | In-memory | Yes |
| Compliance / cyber | `external-data/wave4`, `kernel/compliance-intelligence` | Fixture (17+) | No | Yes + URL guard | SWR | Yes |
| Energy / environmental | `sunrey-chain/productive-economy-providers`, `environmental` | Fixture preview | No | Yes | Cache policies | Yes |
| Physical / geo / logistics | `external-data/wave5` | Fixture (19) | No | Yes | SWR | Yes |
| Travel / mobility | `sunrey-chain/travel-intelligence` | Fixture; blocked in simulation | No | Yes | Cache | Fixture |
| Health / HIN reference | `sunrey-chain/health-reference` | Fixture (9); HIN boundary enforced | No | Yes | Cache | Yes |
| HIN network | `information-market/network` | Simulation only | No (scraping refused) | Internal evidence | In-memory | Consent-bound |
| Jobs / skills | `external-data/wave6` | Fixture default; 6 live-capable | Opt-in `SUNREY_DATA_MODE=live` | Yes | HTTP cache | Yes |
| Productive oracle families | `sunrey-chain/oracle/production/provider-families/*` | Schema + certification only | Fake transport only | Unit taxonomy | Registry index | Evidence records |
| Exchange market data | `sunrey-exchange/market-data` | Deterministic sandbox | No | Yes | In-memory | Provider ID |

**Catalog:** 102/126 providers in `config/providers/free-api-catalog.yaml`.  
**Shared stack:** `provider-sdk` → domain adapters → `provider-runtime/data-delivery` → `external-data` plane → consumer BFF.  
**Bypasses:** None found. Kernel compliance and external-data wave4 are layered (evidence vs screening ports), not parallel mint paths.

---

## 3. Target architecture

Wave 4 introduces `@solstice/economic-awareness-fabric` as the **canonical orchestration boundary** above domain adapters and below Wave 3 economic proof. Existing domain packages remain owners; the fabric coordinates shared concerns:

| Responsibility | Module | Notes |
| --- | --- | --- |
| Provider registration | `providers/` | Trust tier, domain, connector binding |
| Connector execution | `connectors/` | Fixture-first; live gated |
| Ingestion | `ingestion/` | Fail-closed on unknown providers |
| Canonical normalization | `normalization/` | `CanonicalObservationEnvelope` |
| Provenance | `provenance/` | Hash-chained append-only journal |
| Rights/license checks | Config + ingestion gates | Delegates to consent/PDV owners |
| Event routing | `events/` | Fabric audit trail |
| Entity resolution | `entities/` | Wave 3 `CanonicalEntityId` boundary |
| Federated query | `federation/` | Multi-provider read without central raw store |
| Economic graph projection | `graph/` | Rebuildable; non-authoritative |
| Source corroboration | `corroboration/` | Quorum input; not consensus finalization |
| Source reputation | `reputation/` | Scoring only; not trust = mint |
| Information Consensus input | `consensus/` | Proposes candidates; Wave 5+ finalizes |
| Evidence creation | `evidence/` | Proposals to Wave 3 `EconomicEvidence` |

---

## 4. Module boundaries

```
packages/economic-awareness-fabric/src/
  authority/          # Information authority + fail-closed rules
  providers/          # Fabric provider registry
  connectors/         # Connector executor
  ingestion/          # Ingestion pipeline
  normalization/      # Canonical observation envelope
  provenance/         # Provenance chain
  events/             # Event router
  federation/         # Federated query engine
  entities/           # Entity resolution (Wave 3 interface)
  graph/              # Economic graph projection
  corroboration/      # Multi-source corroboration
  reputation/         # Source reputation scores
  consensus/          # Information Consensus input builder
  evidence/           # Evidence proposal builder
  config/             # Versioned configuration loader
  harness/            # Sandbox test harness
  fabric.ts           # Orchestrator factory
```

Domain-specific interpretation remains in:

- `packages/human-economic-contribution` — Human Economy
- `packages/sunrey-chain/src/productive/` — Productive Economy
- `packages/information-market` — HIN consent and usage
- `packages/sunrey-chain/src/oracle/` — Oracle mesh (simulation)

---

## 5. Information authority

The fabric **MAY:**

- observe, ingest, normalize, enrich, correlate, resolve entities
- calculate confidence, detect duplicates, build evidence
- propose verified facts and claims (to Wave 3 ports)

The fabric **MAY NOT:**

- issue SunRey or MoonRey
- burn supply or modify canonical blockchain balances
- approve monetary governance, set market price, or change monetary policy

Enforced structurally via:

- `WAVE4_ECONOMIC_AWARENESS_FABRIC_CAPABILITY` (`capability.ts`)
- `authority/information-authority.ts` — permitted vs forbidden action sets
- `authority/fail-closed.ts` — trust boundary violations
- No imports of `authorizeIssuance`, `Ledger.postJournal`, or `AuthorityIssuer`

---

## 6. Human / Productive separation

| Concern | Shared (fabric) | Domain-specific |
| --- | --- | --- |
| Provider identity | Registry + catalog binding | HIN subject refs vs productive `objectId` |
| Provenance | Hash-chained journal | HIN consent receipts vs oracle attestations |
| Observation normalization | `CanonicalObservationEnvelope` | Domain metric taxonomy |
| Event transport | Fabric event router | HIN engine vs productive engine events |
| Entity references | `CanonicalEntityId` interface | Human pseudonymous vs productive asset kinds |
| Lineage | Graph edges | Human registry vs productive upstream IDs |
| Source reputation | Score store | MoonRey corroboration policy (productive) |
| Federated query | Cross-provider read | Domain filters and purpose tokens |

**Do not** build one generic economic engine that erases Human vs Productive distinctions.

---

## 7. Technology choices

| Technology | Need | Compatibility | Complexity | Value | Wave 4 action |
| --- | --- | --- | --- | --- | --- |
| **Apache Kafka** | Event streaming at scale | Good long-term | High ops | Durable fan-out | **Defer** — use in-memory `events/` router + `packages/events` abstractions first |
| **Apache NiFi** | Ingestion/provenance UI | Moderate | High ops | Visual lineage | **Defer** — `provenance/` + provider-sdk provenance sufficient for simulation |
| **Trino** | SQL federation across stores | Good for analytics | Medium-high | Ad-hoc cross-domain queries | **Defer** — `federation/query.ts` lightweight engine for Wave 4 |
| **Apache AGE** | Graph queries | PostgreSQL extension | Medium | Relationship traversal | **Defer** — in-memory `graph/projection.ts`; PG graph in Wave 8+ |
| **OPA** | Policy enforcement | Excellent | Medium | Purpose/consent gates | **Defer to Wave 7** — Kernel + consent engine own policy today |

**Wave 4 approach:** Lightweight internal abstractions precede full infrastructure. Align with existing `packages/events` durable envelope patterns when persistence gaps close in Wave 8.

---

## 8. Trust boundaries

| Rule | Enforcement |
| --- | --- |
| Unknown provider → untrusted | `unknownProviderIsUntrusted()` |
| Configured ≠ trusted | `configuredProviderIsNotTrusted()` |
| API response ≠ verified fact | `apiResponseIsNotVerifiedFact()` |
| Multiple responses ≠ consensus | `multipleResponsesAreNotConsensus()` |
| Raw observation ≠ claim | `rawObservationIsNotClaim()` |
| Claim ≠ monetary authorization | `claimIsNotMonetaryAuthorization()` |

Codified in `authority/fail-closed.ts` and `config/economic-awareness-fabric/fabric-default.yaml`.

---

## 9. Persistence boundaries

| Data | Where | Authority |
| --- | --- | --- |
| Raw provider payloads | **Not stored** (digest only) | Untrusted |
| Normalized envelopes | In-memory fabric store (Wave 4); durable journal (Wave 8) | Rebuildable |
| Provenance chain | In-memory append-only | Audit trail |
| Graph projection | In-memory; rebuildable | Non-authoritative |
| Economic proof objects | Wave 3 `economic-proof` ports | Pre-monetary |
| Evidence Vault seals | `packages/evidence` | Kernel decisions |
| Claim registry | Wave 3 `EconomicClaimRegistry` | Pre-monetary |

Blockchain stores **commitments only** — not raw observations.

---

## 10. Future Information Consensus architecture

Wave 4 builds **consensus input** (`consensus/input.ts`) — evidence bundles with corroboration counts submitted for promotion. Wave 5+ adds:

- Production oracle mesh quorum
- Durable disagreement handling
- Domain-scoped corroboration policies (MoonRey vs SunRey)
- Challenge process integration with Wave 3 `challengeState`

Information Consensus **produces** `VerifiedEconomicFact` and `CanonicalEconomicClaim`. It does **not** execute monetary state transitions.

---

## 11. Relationship to Wave 3

Wave 3 (`packages/sunrey-chain/src/economic-proof`) defines:

- `EconomicObservation`, `EconomicEvidence`, `VerifiedEconomicFact`, `CanonicalEconomicClaim`
- Evidence/Rights/Policy roots and five-root commitments
- Claim fingerprints, duplicate clusters, monetization lock
- Proof-bound monetary transitions (`economics/proof-bound`)

Wave 4 **feeds** Wave 3 with normalized, provenance-bound observations and evidence proposals. The fabric never bypasses Wave 3 validation or Chunk 71 issuance.

**Wave 3 exit gate note:** `WAVE3_ECONOMIC_PROOF_COMPLETION_REPORT.md` records `FAIL` on durable persistence and block-header wiring. Wave 3 foundation types and tests exist on `main`. Wave 4 proceeds on the implemented proof model; remaining Wave 3 gaps are tracked separately.

---

## 12. Relationship to Wave 5 and Wave 6

| Wave | Fabric role |
| --- | --- |
| **Wave 5 — MoonRey Productive Intelligence** | Durable observations feed oracle mesh; productive corroboration policies; GPUV path hardening |
| **Wave 6 — SunRey Human Economic Intelligence** | HIN integration; human contribution graph projection; PEVE policy candidates |
| **Wave 7 — Privacy / Identity / Policy** | OPA-style purpose enforcement; consent durability; auth hardening |
| **Wave 8 — Product Integration** | PostgreSQL default; fabric journal durability; BFF read APIs |

---

## Configuration

Versioned config: `config/economic-awareness-fabric/fabric-default.yaml`  
Runtime defaults: `packages/economic-awareness-fabric/src/config/defaults.ts`  
No secrets in committed configuration.

## Test harness

`packages/economic-awareness-fabric/src/harness/sandbox.ts` — fixture providers for ingestion, normalization, provenance, corroboration, federation, and entity resolution without live APIs.

## Validation

```bash
npx tsx --test packages/economic-awareness-fabric/src/fabric.test.ts
npx tsx --test tests/wave-4-economic-awareness-fabric.test.ts
npm run test:unit  # includes fabric tests via repository runner
```

---

*End of Wave 4 Economic Awareness Fabric — Prompt 1 foundation.*
