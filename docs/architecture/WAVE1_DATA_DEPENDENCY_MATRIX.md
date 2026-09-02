# Wave 1 Data Dependency Matrix

**Status:** Wave 1 audit artifact. Documentation only.  
**Date:** 2026-09-02  
**Companion:** `SUNREY_ECONOMIC_INFORMATION_FLOW.md`

This matrix maps component-to-component dependencies for every major information flow that can eventually influence SunRey Coin or MoonRey Coin.

---

## Table of Contents

1. [Component Dependency Matrix](#component-dependency-matrix)
2. [SunRey Human Economy Dependencies](#sunrey-human-economy-dependencies)
3. [MoonRey Productive Economy Dependencies](#moonrey-productive-economy-dependencies)
4. [Cross-Economy Shared Dependencies](#cross-economy-shared-dependencies)
5. [Database Participation Matrix](#database-participation-matrix)
6. [External Provider Boundary Matrix](#external-provider-boundary-matrix)
7. [Collapsed Concept Registry](#collapsed-concept-registry)
8. [Replay Protection Matrix](#replay-protection-matrix)
9. [Provider Inventory (Human-Readable)](#provider-inventory-human-readable)
10. [Provider Inventory (Machine-Readable)](#provider-inventory-machine-readable)

---

## Component Dependency Matrix

Legend:
- **D** = depends on (reads or calls)
- **W** = writes to
- **P** = projects to (non-authoritative)
- **—** = no relationship
- **Auth** = authority level: `NONE`, `READ`, `GATE`, `SoR`, `MINT`

| Component | HIN | HEC Registry | HEC Verification | HEC Valuation | HIN Value Engine | Human Bridge | Productive Engine | GPUV Engine | GPUV Settlement | Oracle Connector | economy-data | Wave5 Runtime | Chunk71 Issuance | Ledger | Evidence Vault | SunRey Chain | Exchange | Kernel |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **HIN Engine** | — | D (port) | — | — | — | — | — | — | — | — | — | — | — | — | — | W (anchor) | — | — |
| **HinContributionAdapter** | D | W (via port) | D | — | — | — | — | — | — | — | — | — | — | — | — | D (anchor) | — | — |
| **HumanContributionRegistry** | — | SoR | D | — | D | — | — | — | — | — | — | — | — | — | — | — | — | — |
| **VerificationEngine** | — | D | Auth | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| **ValuationEngine** | — | D | — | Auth | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| **HinEconomicValueEngine** | — | D/W | D | — | SoR | P | — | — | — | — | — | — | — | — | — | — | — | — |
| **HumanContributionMonetaryBridge** | — | D | — | D | — | GATE | — | — | — | — | — | — | D | — | — | — | — | — |
| **authorizeIssuance** | — | — | — | — | — | D | — | — | D | — | — | — | MINT | W | W | — | — | — |
| **Wave5 Runtime** | — | — | — | — | — | — | — | — | — | — | — | SoR | — | — | — | — | P | — |
| **ExternalDataPlane** | — | — | — | — | — | — | — | — | — | — | — | D | — | — | — | — | P | — |
| **economy-data Platform** | — | — | — | — | — | — | — | — | — | — | SoR | — | — | — | — | — | — | — |
| **Oracle Connector** | — | — | — | — | — | — | D | — | — | SoR | — | — | — | — | — | — | — | — |
| **ProductiveEngine V1** | — | — | — | — | — | — | SoR | — | — | D | — | — | D (local) | — | — | W | — | — |
| **evaluateProductiveValue** | — | — | — | — | — | — | D | Auth | — | — | — | — | — | — | — | — | — | — |
| **MoonReySettlementBridge** | — | — | — | — | — | — | D | D | GATE | — | — | — | D | — | — | — | — | — |
| **ProductionActivationFirewall** | D (evidence) | D (evidence) | — | — | — | D (readiness) | D (readiness) | D (readiness) | D (readiness) | D (evidence) | D (readiness) | — | D (readiness) | — | — | D (evidence) | D (readiness) | — |
| **Exchange Consumer** | P | P | — | — | — | — | — | — | — | — | P | D | — | D | — | — | READ | — |
| **services/accounts** | — | — | — | — | — | — | — | — | — | — | — | — | D | W | W | — | — | D |
| **EconomicAssetRegistry** | P | P | — | — | — | — | — | — | — | P | P | P | — | — | — | P | — | — |

---

## SunRey Human Economy Dependencies

### Upstream → Downstream Flow

```
HIN Store
  └─► HinContributionAdapter
        └─► VerificationEngine (Chunk 109)
              └─► HumanContributionRegistry (Chunk 106)
                    ├─► HinEconomicValueEngine (Phase H product, parallel)
                    ├─► ValuationEngine (Chunk 111)
                    ├─► HumanContributionEconomicAssetAdapter (Chunk 115 projection)
                    └─► HinChainAnchorAdapter (Chunk 139/140)
                          └─► SunReyChainService (commitment only)

HumanContributionRegistry + ValuationEngine + SettlementAuthorization
  └─► HumanContributionMonetaryBridge (Chunk 108)
        └─► authorizeIssuance (Chunk 71)
              └─► AssetSupplyBook
                    └─► [optional] Ledger.postJournal (ISSUE_SUNREY_COIN)
                          └─► EvidenceVault seal
```

### Package Import Boundaries

| Package | May Import | Must Not Import |
|---|---|---|
| `information-market` | `human-economic-contribution` (narrow port) | `sunrey-chain` economics, `ledger`, `kernel` EA |
| `human-economic-contribution` | `domain`, `money`, verification types | `services/*`, `ledger`, `kernel` EA, `sunrey-chain` mint |
| `sunrey-chain/economics/human-contribution-bridge` | `human-economic-contribution` types, `economics/issuance` | HIN engine internals |
| `sunrey-coin` | `ledger`, `evidence`, `permissions` | Direct mint without EA |

### Data Type Dependencies

| Type | Defined In | Consumed By |
|---|---|---|
| `HumanInformationUsageReceipt` | `information-market/network/types.ts` | HIN engine, contribution adapter, chain anchor |
| `InformationRightContributionEvidence` | `information-market/network/contribution/contract.ts` | Verification engine, registry adapter |
| `HumanContributionRegistryRecord` | `human-economic-contribution/types.ts` | Bridge, valuation, economic asset adapter |
| `VerifiedHumanEconomicContribution` | `sunrey-chain/economics/human-contribution-bridge/types.ts` | Monetary bridge gate |
| `HumanContributionSettlementAuthorization` | same | Bridge gate, evidence builder |
| `HumanEconomicEvidence` | `sunrey-chain/economics/types.ts` | `authorizeIssuance` |
| `MonetaryIssuanceAuthority` | `sunrey-chain/economics/types.ts` | `authorizeIssuance`, ledger binding |

---

## MoonRey Productive Economy Dependencies

### Parallel Path Dependencies

```
Path A (Wave 5):
  config/providers/wave5-*.yaml
    └─► catalog-entries.ts
          └─► productive-economy-providers/adapters/*
                └─► ProductiveEconomyProviderRuntime
                      └─► ExternalDataPlane (packages/external-data)
                            └─► services/api consumer BFF
                                  └─► PEG projection / agent evidence
                                        ✕ NO LINK to economy-data or GPUV

Path B (economy-data):
  productive/economy-data/fixtures.ts (SANDBOX_DRAFTS)
    └─► ingestObservation
          └─► verifyObservation
                └─► aggregateObservations
                      └─► proposeMoonReyIssuanceFromObservations → REFUSE
                            ✕ NO LINK to Wave 5 or GPUV

Path C (Oracle):
  external-provider-candidate/fixtures.ts
    └─► EconomicDataConnectorRuntime
          └─► CanonicalCollectedObservation
                └─► quorum → VerifiedEconomicFact
                      └─► ProductiveEngine.verifyClaim (Path D/E)

Path E (Governed V2):
  VerifiedEconomicFact + ProductiveClaim
    └─► VerifiedProductiveContribution
          └─► ProductiveEconomicEvent + AttributionDecision
                └─► evaluateProductiveValue (GPUV)
                      └─► convertGpuvToMoonRey
                            └─► MoonReyProductiveSettlementBridge
                                  └─► authorizeIssuance
                                        └─► AssetSupplyBook
```

### Package Import Boundaries

| Package | May Import | Must Not Import |
|---|---|---|
| `productive-economy-providers` | `provider-sdk`, fixtures | `economics/issuance` direct mint |
| `productive/economy-data` | productive types, GPUV type refs | `economics/issuance`, live HTTP |
| `oracle/production` | security policy, injected transport | Live mainnet, auto-mint |
| `productive/policy-governance/value-function` | productive types, units | Direct mint |
| `productive/policy-governance/value-settlement` | value-function, `economics/issuance` | Bypass bridge gate |

### Observation Type Isolation

| Schema | Package | Feeds GPUV? | Feeds Mint? |
|---|---|---|---|
| `sunrey.energy-observation.v1` | productive-economy-providers | No | No |
| `sunrey.productive-economic-observation.v1` | productive-economy-providers | No | No |
| `sunrey.productive.economy-data.v1` | productive/economy-data | No (isolated) | No (refused) |
| `PRODUCTION_ORACLE_SCHEMA_VERSION` | oracle/production | Via facts only | No |
| `GovernedProductiveValueUnit` | value-function | N/A (output) | Via bridge only |

---

## Cross-Economy Shared Dependencies

| Shared Component | SunRey Use | MoonRey Use | Authority |
|---|---|---|---|
| `AssetSupplyBook` | SunRey supply state | MoonRey supply state | Chunk 71 sole mint |
| `authorizeIssuance` | `ISSUE_SUNREY_COIN` evidence class | Governed productive evidence class | MINT |
| `ProductionEconomicActivationFirewall` | `SUNREY_COIN_ISSUANCE` domain | `MOONREY_COIN_ISSUANCE` domain | Evaluator only |
| `NativeAssetConstitution` | SunRey issuance policy | MoonRey issuance policy | Policy (not mint) |
| `EvidenceVault` | Kernel + accounts + coin seals | Same vault | Append-only hash chain |
| `Ledger.postJournal` | Fiat + `ISSUE_SUNREY_COIN` | Native asset postings (no `ISSUE_MOONREY_*`) | EA required |
| `EconomicAssetRegistry` | HIN + HEC projections | Oracle + productive projections | Non-authoritative |
| `SunReyChainService` | HIN anchors | Productive commitments | Simulation trust layer |

---

## Database Participation Matrix

| Table / Schema | SunRey Human | MoonRey Productive | Writer | Append-Only | Cross-DB Refs | Status |
|---|---|---|---|---|---|---|
| `customer.customer` | Identity for subjects | — | accounts runtime | No (UPSERT) | — | **Active** |
| `peve.data_contribution` | PEVE refs (`dcr_*`) | — | `persistPeveState` | No | — | **Tested** |
| `information_market.contribution` | HIN contributions | — | `persistInformationMarketState` | No | `journal_id` opaque | **Unwired** |
| `clean_room.contribution_ref` | Clean-room refs (`ccc_*`) | — | `persistCleanRoomState` | No | — | **Unwired** |
| `sunrey_coin.contribution_vector` | SunRey issuance input | — | — | INSERT granted | `contribution_id` | **Schema only** |
| `sunrey_coin.issuance_record` | SunRey issuance output | — | — | INSERT granted | `journal_id`, `execution_authority_id` | **Schema only** |
| `sunrey_chain.operation` | HIN anchors | Productive commitments | `persistSunReyChainState` | No | `transaction_id`, `source_record_reference` | **Unwired** |
| `custody.operational_*` | `SUNREY_COIN` custody | `MOONREY_COIN` custody | operational store | No | `journal_id` | **Tested (Chunk 154)** |
| `sunrey_exchange.operational_*` | Exchange positions | Exchange positions | operational store | No | trade refs | **Tested (Chunk 154)** |
| `ledger.journal` | `ISSUE_SUNREY_COIN` | Native asset postings | accounts runtime | **Yes** | `evidence_record_id` → evidence DB | **Active** |
| `ledger.execution_authority_record` | EA audit | EA audit | accounts runtime | **Yes** | `intent_id` | **Active** |
| `evidence.evidence_record` | Kernel + money movement | Same | accounts runtime | **Yes** (hash chain) | — | **Active** |
| `security.key_metadata` | EA signing keys | EA signing keys | security store | No | — | **Active** |
| `sunrey_explorer.moonrey_issuance` | — | MoonRey projection | — | — | `contribution_id` | **Outside bounded DBs** |

### Missing Durable Link IDs

| ID Namespace | Prefix | Durable Store | Cross-Ref to Ledger | Cross-Ref to Evidence |
|---|---|---|---|---|
| Human contribution | `hec_*` | In-memory only | No | No |
| HIN contribution | marketplace ID | Unwired PG adapter | No | No |
| Clean room | `ccc_*` | Unwired PG adapter | No | No |
| PEVE data contribution | `dcr_*` | `peve.*` (tested) | No | No |
| External observation | `peo_*` | None | No | No |
| Economy-data observation | platform-generated | In-memory only | No | No |
| Oracle collected observation | connector-generated | `payloadPersisted: false` | No | No |
| SunRey issuance | `issuance_id` | Schema only | Intended via `journal_id` | No |
| Chain transaction | `transaction_id` | Unwired | No | No |

---

## External Provider Boundary Matrix

| Boundary Control | Applies To | Mechanism | Bypass Risk |
|---|---|---|---|
| `ENVIRONMENT=simulation` | All providers | Compile-time constant | None (CI enforced) |
| `assertNoLiveNetwork` | Wave 5 adapters | Runtime throw in simulation | Low |
| `LIVE_CONNECTIVITY_ENABLED=false` | All external | Flag check | None |
| Injected/fake transport | Oracle connector | No real HTTP | Low |
| JSON fixtures | Wave 5, economy-data, oracle | File-based | N/A (intentional) |
| `launch_tier` gating | Catalog entries | Classification filter | Medium (metadata only) |
| SSRF/TLS/auth policy | Oracle connector | `security-policy.ts` | Low in simulation |
| Circuit breaker | Oracle connector, Wave 5 | Per-provider state | Medium (in-memory) |
| Rate limit metadata | Catalog YAML | Documented limits; not enforced uniformly | Medium |

---

## Collapsed Concept Registry

| ID | Concept A | Concept B | Location | Severity | Wave 3 Action |
|---|---|---|---|---|---|
| C01 | Usage receipt | Contribution evidence | `InformationRightContributionEvidence` | Low | Split receipt ref from evidence bundle |
| C02 | ExternalObservation | EconomicObservation | Wave 5 vs economy-data | **High** | Unified observation ingress |
| C03 | VerifiedEconomicFact | EconomicObservation (verified) | Oracle vs economy-data | **High** | Single verified-fact registry |
| C04 | GPUV | MoonRey quantity | `convertGpuvToMoonRey` | Medium | Keep separate; strengthen type branding |
| C05 | GPUV | Exchange market price | BFF snapshots | Medium | Explicit price source attribution |
| C06 | ProductiveEngine supply | AssetSupplyBook | V1 vs Chunk 71 | **High** | Deprecate V1 local supply |
| C07 | V1 formula issuance | GPUV V2 issuance | `productive/issuance.ts` vs value-settlement | **High** | Single issuance path |
| C08 | Single-source verified | Quorum consensus | economy-data vs oracle | **High** | Unified verification policy |
| C09 | Valuation result | Issuance quantity | HEC valuation (`sunReyQuantity: null`) | Low | Already separated |
| C10 | Chain anchor | Consent authority | HIN anchor coordinator | Low | Already refused |
| C11 | BFF snapshot | Authoritative observation | consumer adapters | Medium | Label all BFF data as non-authoritative |
| C12 | CONFIGURED parameters | Production active | activation types | Low | Already labeled |
| C13 | Observation | Economic event | economy-data ingest (no dedup) | **High** | Event fingerprint layer |
| C14 | Contribution | Eligibility | `issuanceEligible: false` field | Low | Rename or remove misleading field |
| C15 | Governance decision | Supply transition | activation firewall vs issuance | Low | Already separated |

---

## Replay Protection Matrix

| Component | Key / Mechanism | Scope | Durable? | Economy |
|---|---|---|---|---|
| HIN receipt digest | `rightId:requesterId:computationId` | Per receipt | No | SunRey |
| `DUPLICATE_USAGE_RECEIPT` | `byReceipt` index | Per receipt ID | Optional (registry store) | SunRey |
| `DUPLICATE_FINGERPRINT` | `fingerprintEconomicEvent` | Per economic event | Optional | SunRey |
| `hinReplayKey` | subject+category+source+time | Per HIN product event | No | SunRey |
| `replayKeyOf` (human bridge) | fingerprint+authorization+valuation+policy | Per settlement | No | SunRey |
| `usedReplayIds` (supply book) | `assetId:issuanceClass:replayIdentifier` | Per issuance | No | Both |
| `REVALUATION_DOES_NOT_REMINT` | valuation ID tracking | Per valuation | No | SunRey |
| Chain anchor `bySource` | kind+sourceRecordId | Per anchor source | No | SunRey |
| Productive fingerprint | contribution fingerprint set | Per contribution | No | MoonRey |
| `issuedFingerprints` (V1) | issuance fingerprint set | Per V1 issuance | No | MoonRey |
| `replayKeyOf` (productive bridge) | fingerprint+event+value+digest+auth | Per settlement | No | MoonRey |
| `settledFingerprints/ValueIds` | settlement book sets | Per settled item | No | MoonRey |
| economy-data ingest | — | — | **None** | MoonRey |
| Oracle quorum window | window+subject scope | Per fact window | In-memory engine | MoonRey |
| Ledger journal | journal ID uniqueness | Per journal | **Yes (PG)** | Both |
| Evidence vault | hash chain + seq | Per seal | **Yes (PG)** | Both |
| EA record | authority ID | Per authority | **Yes (PG)** | Both |

---

## Provider Inventory (Human-Readable)

### Tier 1 — Active Runtime Adapters (Wave 5 Productive Economy)

| Provider ID | Category | Base URL | Auth | Fixture | Real Network | MoonRey | Adapter |
|---|---|---|---|---|---|---|---|
| `national-grid-eso` | energy | `https://data.nationalgrideso.com` | none | `national-grid-eso.json` | Blocked (simulation) | Yes | `adapters/national-grid-eso.ts` |
| `uk-carbon-intensity` | energy/environmental | `https://api.carbonintensity.org.uk` | none | `uk-carbon-intensity.json` | Blocked | Yes | `adapters/uk-carbon-intensity.ts` |
| `energi-data-service` | energy | `https://api.energidataservice.dk` | none | `energi-data-service.json` | Blocked | Yes | `adapters/energi-data-service.ts` |
| `co2-offset` | environmental/resources | `https://www.co2offset.io` | API key (`CO2_OFFSET_API_KEY`) | `co2-offset.json` | Blocked | Yes | `adapters/co2-offset.ts` |
| `website-carbon` | environmental | `https://api.websitecarbon.com` | none | `website-carbon.json` | Blocked | Yes (preview) | `adapters/website-carbon.ts` |
| `indian-mandi-prices` | agriculture/resources | (agri markets) | none | `indian-mandi-prices.json` | Blocked | Yes | `adapters/indian-mandi-prices.ts` |
| `fred-commodity` | commodities/energy | `https://api.stlouisfed.org/fred` | API key (`FRED_API_KEY`) | `fred-commodity-oil.json` | Blocked | Yes | `adapters/fred-commodity.ts` |
| `tilth` | — | — | — | — | — | — | **BLOCKED** (`WAVE5_BLOCKED_PROVIDER_IDS`) |

### Tier 2 — Wave 1 Operations Catalog (Metadata)

| Provider ID | Category | Credential Required | Launch Tier | Real Network | Purpose |
|---|---|---|---|---|---|
| `coingecko` | MARKET_DATA | No | PREVIEW | Blocked | Market quotes (metadata) |
| `coinmarketcap` | MARKET_DATA | Yes | PRODUCTION_BLOCKED | Blocked | Market quotes (metadata) |
| `open-meteo` | ORACLE | No | PREVIEW | Blocked | Weather/oracle facts (metadata) |
| `fred` | ORACLE | Yes | PRODUCTION_BLOCKED | Blocked | Macro oracle (metadata) |
| `sim-payments` | PAYMENTS | No | SANDBOX | Fixture | Simulated payments |
| `sim-fx` | FX | No | SANDBOX | Fixture | Simulated FX |
| `sim-cards` | CARDS | No | SANDBOX | Fixture | Simulated cards |
| `sim-investments` | INVESTMENTS | No | SANDBOX | Fixture | Simulated investments |

### Tier 3 — Oracle External Provider Candidates (Conformance Fixtures)

| Provider ID | Family | Auth | Endpoint | Real Network | Purpose |
|---|---|---|---|---|---|
| `fixture-energy-mtls` | energy | MTLS | `https://fixture-energy-mtls.oracle.test` | Injected fake | Conformance sandbox |
| `fixture-compute-oauth` | compute | OAUTH_CLIENT | `https://fixture-compute-oauth.oracle.test` | Injected fake | Conformance sandbox |
| `fixture-manufacturing-api-key` | manufacturing | API_KEY_REFERENCE | `https://fixture-manufacturing-api-key.oracle.test` | Injected fake | Conformance sandbox |
| `fixture-logistics-signed-request` | logistics | SIGNED_REQUEST | `https://fixture-logistics-signed.oracle.test` | Injected fake | Conformance sandbox |
| `fixture-reference-price` | reference-data | — | — | Fixture | Reference price only; `productiveCategory: null` |

### Tier 4 — Master Catalog (`free-api-catalog.yaml`)

- **Total entries:** ~102 unique providers (partial population of 126 target)
- **Catalog source:** Waves 2–6 YAML merges
- **Schema:** `config/providers/free-api-catalog.schema.json`
- **Population status:** `partial` (see catalog header notes)
- **Domains:** macroeconomics, energy, crypto, travel, health/HIN, access discovery, compliance, environmental, productive economy
- **Adapter status:** Most entries are `integration_state: implemented` metadata with `existing_adapter: null`; only Wave 5 productive adapters have runtime implementations
- **Commercial use:** Per-entry `commercial_use.status` (typically `verified_allowed` or `attribution_required`)
- **Rate limits:** Documented per provider in YAML (e.g., FRED: 120 req/min)
- **SunRey relevance:** `sunrey.domain` array per entry (e.g., `world`, `economic_graph`, `moonrey`, `grow`)
- **MoonRey relevance:** Entries with `moonrey` in `sunrey.domain`

### Tier 5 — Additional YAML Catalogs

| File | Domain |
|---|---|
| `wave2-catalog-entries.yaml` | General Wave 2 providers |
| `wave2-access-discovery-catalog-entries.yaml` | Access discovery |
| `wave3-crypto-catalog-entries.yaml` | Crypto market data |
| `wave4-catalog-entries.yaml` | Wave 4 expansion |
| `wave5-travel-catalog-entries.yaml` | Travel/mobility |
| `wave5-physical-economy-catalog-entries.yaml` | Physical economy |
| `wave5-energy-resource-catalog-entries.yaml` | Energy/resources (runtime) |
| `wave6-health-hin-catalog-entries.yaml` | Health/HIN providers |
| `wave6-opportunity-skills-catalog-entries.yaml` | Opportunity/skills |

---

## Provider Inventory (Machine-Readable)

The canonical machine-readable inventory is generated from merged catalog sources. Key runtime adapters are enumerated below; the full ~102-entry catalog is in `config/providers/free-api-catalog.yaml`.

```json
{
  "inventoryVersion": "wave1-audit-2026-09-02",
  "environment": "simulation",
  "realNetworkCallsEnabled": false,
  "catalogCapacity": 126,
  "populatedCount": 106,
  "runtimeAdapters": {
    "wave5ProductiveEconomy": {
      "package": "packages/sunrey-chain/src/productive-economy-providers",
      "adapterIds": [
        "national-grid-eso",
        "uk-carbon-intensity",
        "energi-data-service",
        "co2-offset",
        "website-carbon",
        "indian-mandi-prices",
        "fred-commodity"
      ],
      "blockedIds": ["tilth"],
      "fixtureOnly": true,
      "realNetworkCalls": false
    },
    "wave1Operations": {
      "package": "packages/sunrey-chain/src/provider-runtime/universal/observability/catalog.ts",
      "providerIds": [
        "coingecko",
        "coinmarketcap",
        "open-meteo",
        "fred",
        "sim-payments",
        "sim-fx",
        "sim-cards",
        "sim-investments"
      ],
      "metadataOnly": true,
      "realNetworkCalls": false
    },
    "oracleConformance": {
      "package": "packages/sunrey-chain/src/oracle/production/external-provider-candidate",
      "providerIds": [
        "fixture-energy-mtls",
        "fixture-compute-oauth",
        "fixture-manufacturing-api-key",
        "fixture-logistics-signed-request",
        "fixture-reference-price"
      ],
      "injectedTransportOnly": true,
      "realNetworkCalls": false
    },
    "economyDataSandbox": {
      "package": "packages/sunrey-chain/src/productive/economy-data",
      "providerId": "sandbox_fixture",
      "sourceClass": "SANDBOX_FIXTURE",
      "fixtureOnly": true,
      "realNetworkCalls": false
    }
  },
  "globalGuards": {
    "ENVIRONMENT": "simulation",
    "LIVE_CONNECTIVITY_ENABLED": false,
    "LIVE_HIN_BASED_ISSUANCE_ENABLED": false,
    "LIVE_MOONREY_PRODUCTIVE_ISSUANCE_ENABLED": false,
    "REAL_EXTERNAL_PROVIDER_CONFIGURED": false,
    "PRODUCTION_ACTIVE": false,
    "DEFAULT_CONNECTOR_RUNTIME_MODE": "FIXTURE"
  },
  "providerEntrySchema": {
    "source": "config/providers/free-api-catalog.schema.json",
    "requiredFields": [
      "provider_id",
      "primary_category",
      "endpoints.base_url",
      "authentication",
      "commercial_use",
      "redistribution",
      "rate_limits",
      "sunrey.domain",
      "sunrey.launch_tier",
      "sunrey.integration_state",
      "verification.status"
    ]
  },
  "wave5AdapterDetails": [
    {
      "providerId": "national-grid-eso",
      "category": "energy",
      "baseUrl": "https://data.nationalgrideso.com",
      "authentication": "none",
      "sourceClass": "SANDBOX_FIXTURE",
      "dataDomain": ["electricity_generation", "electricity_demand", "energy_mix"],
      "license": "Open Government Licence v3.0",
      "commercialUse": "attribution_required",
      "cachingRestrictions": "enforce SunRey bulkheads",
      "persistenceRestrictions": "observations in-memory per request",
      "rateLimits": "fair-use; no published hard limits",
      "productionReadiness": "production_candidate",
      "adapterStatus": "implemented",
      "realNetworkCalls": false,
      "sandboxFixture": true,
      "sunreyRelevance": ["world", "economic_graph", "moonrey", "grow"],
      "moonreyRelevance": true
    },
    {
      "providerId": "uk-carbon-intensity",
      "category": "energy",
      "baseUrl": "https://api.carbonintensity.org.uk",
      "authentication": "none",
      "sourceClass": "SANDBOX_FIXTURE",
      "dataDomain": ["carbon_intensity", "energy_mix"],
      "license": "attribution required",
      "commercialUse": "attribution_required",
      "productionReadiness": "production_candidate",
      "adapterStatus": "implemented",
      "realNetworkCalls": false,
      "sandboxFixture": true,
      "moonreyRelevance": true
    },
    {
      "providerId": "energi-data-service",
      "category": "energy",
      "baseUrl": "https://api.energidataservice.dk",
      "authentication": "none",
      "sourceClass": "SANDBOX_FIXTURE",
      "dataDomain": ["energy"],
      "productionReadiness": "production_candidate",
      "adapterStatus": "implemented",
      "realNetworkCalls": false,
      "sandboxFixture": true,
      "moonreyRelevance": true
    },
    {
      "providerId": "co2-offset",
      "category": "environmental",
      "baseUrl": "https://www.co2offset.io",
      "authentication": "api_key",
      "sourceClass": "SANDBOX_FIXTURE",
      "productionReadiness": "preview_only",
      "adapterStatus": "implemented",
      "realNetworkCalls": false,
      "sandboxFixture": true,
      "moonreyRelevance": true
    },
    {
      "providerId": "website-carbon",
      "category": "environmental",
      "baseUrl": "https://api.websitecarbon.com",
      "authentication": "none",
      "sourceClass": "SANDBOX_FIXTURE",
      "productionReadiness": "research_only",
      "adapterStatus": "implemented",
      "realNetworkCalls": false,
      "sandboxFixture": true,
      "moonreyRelevance": true
    },
    {
      "providerId": "indian-mandi-prices",
      "category": "agriculture",
      "authentication": "none",
      "sourceClass": "SANDBOX_FIXTURE",
      "productionReadiness": "preview_only",
      "adapterStatus": "implemented",
      "realNetworkCalls": false,
      "sandboxFixture": true,
      "moonreyRelevance": true
    },
    {
      "providerId": "fred-commodity",
      "category": "commodities",
      "baseUrl": "https://api.stlouisfed.org/fred",
      "authentication": "api_key",
      "envVar": "FRED_API_KEY",
      "sourceClass": "SANDBOX_FIXTURE",
      "rateLimits": "120 requests/minute",
      "commercialUse": "verified_allowed",
      "productionReadiness": "production_candidate",
      "adapterStatus": "implemented",
      "realNetworkCalls": false,
      "sandboxFixture": true,
      "moonreyRelevance": true
    }
  ]
}
```

For the complete 102-provider catalog with license, rate limit, and commercial-use fields, query `config/providers/free-api-catalog.yaml` directly. Each entry follows the schema in `config/providers/free-api-catalog.schema.json`.

---

## Highest-Value Improvements (Wave 2+ Candidates)

| Priority | Improvement | Rationale |
|---|---|---|
| P0 | Wire `sunrey_coin.*` and `persistSunReyChainState` to runtime | Schema exists; issuance/chain state lost on restart |
| P0 | Add HEC (`hec_*`) durable persistence with ledger/evidence cross-refs | Human economy has no bounded-DB home |
| P0 | Unify observation ingress (Wave 5 → economy-data → oracle) | Three parallel planes risk double-counting |
| P1 | Persist settlement books and supply book replay guards | Replay protection lost on restart |
| P1 | Add MoonRey productive claim schema to bounded DBs | MoonRey issuance entirely in-memory |
| P1 | Deprecate V1 `ProductiveEconomyEngine` local supply | Two supply books (C06) |
| P2 | Wire `persistInformationMarketState` for HIN contributions | Contribution IDs not durable |
| P2 | Add observation ID dedup to economy-data platform | Analytics double-count risk |
| P2 | Seal economic observations to Evidence Vault | No hash-chain audit trail for observations |
| P3 | Connect explorer DB or fold into bounded fabric | MoonRey projections orphaned |

---

## Related Documents

- `SUNREY_ECONOMIC_INFORMATION_FLOW.md` — end-to-end flow diagrams and transition tables
- `docs/architecture/persistence.md` — bounded database design
- `config/providers/free-api-catalog.yaml` — master provider catalog
- `packages/sunrey-chain/src/provider-runtime/universal/observability/catalog.ts` — Wave 1 ops catalog
