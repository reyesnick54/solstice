# Wave 4 Prompt 16 — KYB and Fraud Intelligence

## Purpose

SunRey Wave 4 Prompt 16 establishes the canonical **Risk Evidence layer** for:

- KYB and business/entity identity
- Public corporate registries
- Fraud and digital-risk intelligence (IP, VPN, proxy, Tor, email reputation)
- Deterministic risk policy integration with the Compliance Kernel

External providers supply **signals and evidence only**. They do **not** independently authorize account creation, transactions, investment activity, Exchange activity, fiat movement, crypto movement, or account closure. The SunRey Compliance Kernel and internal Risk Policy remain authoritative.

## Wave 0 catalog status

As of Prompt 16, the authoritative Wave 0 catalog (`config/providers/free-api-catalog.yaml` / `config/providers/wave2-catalog-entries.yaml`) contains:

| Category | Eligible providers |
| --- | ---: |
| `kyb_identity` | **0** |
| `fraud_risk` | **0** |
| `cybersecurity` | **0** |
| `corporate_filings` (public corporate identity) | **1** (`sec-edgar`) |

**No providers were invented.** Examples mentioned in planning (OpenMercantil, IPLogs, EmailRep) are **not present** in the Wave 0 catalog and were not added.

### Integrated providers

| # | Provider ID | Category | Role | Production |
| --- | --- | --- | --- | --- |
| 1 | `sec-edgar` | `corporate_filings` | US public company search and filings → `BusinessIdentityEvidence` | Simulation (`catalog_only`) |
| 2 | `fixture-identity` | Chunk 152 fixture | KYB simulation adapter | `productionAuthorized: false` |
| 3 | `fixture-aml` | Chunk 152 fixture | Digital-risk simulation adapter | `productionAuthorized: false` |

**Total Wave 0 free API providers integrated: 1** (`sec-edgar`)  
**Total simulation fixtures: 2** (Chunk 152 regulated fixtures, not Wave 0 catalog entries)

## Architecture

```
External Provider (catalog or fixture)
    ↓
Risk Evidence Adapter (packages/risk-evidence)
    ↓
BusinessIdentityEvidence / DigitalRiskEvidence
    ↓
Feature extraction (deterministic)
    ↓
SunRey Risk Policy (packages/risk-evidence/src/policy.ts)
    ↓
NORMAL | STEP_UP_AUTH | REVIEW | HOLD | REJECT
    ↓
Compliance Kernel / Money / Exchange / Agent gates
```

Canonical owner: `packages/risk-evidence`

Related owners (not duplicated):

- Identity model: `packages/identity`
- Compliance fabric: `packages/kernel/src/compliance`
- SEC EDGAR data plane: `packages/external-data` (Wave 2)
- Provider SDK envelope: `packages/provider-sdk`

## Corporate identity model

`BusinessIdentityEvidence` (`packages/risk-evidence/src/models.ts`):

| Field | Description |
| --- | --- |
| `evidenceId` | Unique evidence identifier |
| `entityId` | Resolved SunRey entity ID when available |
| `legalName` | Legal entity name |
| `tradingName` | Trading name if distinct |
| `registrationNumber` | Registration/CIK/tax ID where appropriate |
| `jurisdiction` | ISO jurisdiction code |
| `status` | `ACTIVE` \| `INACTIVE` \| `DISSOLVED` \| `SUSPENDED` \| `UNKNOWN` |
| `providerNativeStatus` | Provider-native status preserved |
| `incorporationDate` | When supplied |
| `entityType` | Entity type when supplied |
| `registeredAddress` | Where lawfully available |
| `officers` | Public officers/directors where permitted |
| `providerId` | Source provider |
| `providerRecordId` | Provider-native record ID |
| `retrievedAt` / `sourceUpdatedAt` | Timestamps (UTC) |
| `freshness` | `FRESH` \| `STALE` \| `EXPIRED` |
| `confidence` | Provider confidence when supplied |
| `authorityClass` | Wave 0 authority class |
| `provenance` | Opaque provenance reference |

### Entity resolution

Businesses are resolved by **jurisdiction + registration number** (or CIK for US SEC). Name-only matching is not used for resolution. Example: `ABC Holdings Ltd` in `GB` is distinct from `ABC Holdings Ltd` in `US`.

## Digital risk model

`DigitalRiskEvidence` supports:

- `IP_REPUTATION`
- `VPN`
- `PROXY`
- `TOR`
- `EMAIL_REPUTATION`
- `ABUSE_HISTORY`
- `NETWORK_RISK`
- `LOCATION_ANOMALY`

VPN, proxy, and Tor are **risk signals**, not automatic guilt. Policy decides whether step-up or review is required.

External `riskScore` values are normalized and passed as features. **`providerScoreUsed: false`** on all policy decisions — external scores never become SunRey's canonical risk decision.

## KYB service

`KYBEvidenceService` (`packages/risk-evidence/src/services.ts`):

- `searchBusiness(query)`
- `lookupBusiness(key)`
- `getBusinessEvidence(entityId)`
- `getRegistrationStatus(entityId)`
- `getPublicOfficers(entityId)`

Final KYB approval belongs to SunRey compliance policy, not the provider.

## Supported jurisdictions

| Provider | Jurisdictions |
| --- | --- |
| `sec-edgar` | US (SEC registrants) |
| `fixture-identity` | GB, US-SIM (simulation) |

## Risk policy integration

Deterministic policy (`evaluateRiskPolicy`):

1. Extract features from evidence (VPN signal, Tor signal, inactive business, stale evidence, etc.)
2. Apply fixed escalation rules
3. Return `RiskPolicyOutcome` compatible with existing Kernel fraud/compliance escalation

Kernel integration path unchanged:

```
ComplianceFabric.collectFacts() → ComplianceFacts → proofs → Kernel.submit()
```

Risk evidence feeds feature extraction; Kernel remains decisive.

## Money integration

`evaluateMoneyRiskGate()` (`packages/risk-evidence/src/bridges.ts`) makes canonical risk evidence available to money/compliance gates. Money services must not call fraud providers directly.

## Exchange integration

`evaluateExchangeRiskGate()` provides digital-risk evidence for Exchange security/compliance policy (suspicious login, risky withdrawal attempt, abnormal access). Does not create withdrawal capability or change custody authority.

## Financial Agent integration

`evaluateAgentRiskGate()` ensures the Agent obeys risk decisions (`mustWaitForHuman` when step-up/review/hold/reject). Agent cannot override policy with provider scores.

## Action Center events

Backend security events (no provider names exposed):

- `SECURITY_REVIEW_REQUIRED`
- `IDENTITY_VERIFICATION_REQUIRED`
- `BUSINESS_VERIFICATION_REQUIRED`
- `UNUSUAL_ACCESS_DETECTED`

`autoNotify: false` — human review before user notification.

## Privacy and data minimization

- Outbound provider payloads limited to: IP hash, email hash, company name, registration number, jurisdiction
- HIN, Vault, PEG, health, DNA, and agent private reasoning are **never** transmitted
- `assertRiskEvidencePayloadMinimized()` enforces forbidden keys
- IP/email redacted in logs via `redactIpForLog()` / `redactEmailForLog()`

## Retention

| Policy | Max age | Use |
| --- | --- | --- |
| `SESSION_DIGITAL_RISK` | 24 hours | Session/device risk signals |
| `COMPLIANCE_AUDIT` | 2555 days | Audit evidence where required |
| `KYB_EVIDENCE` | 365 days | KYB verification lifecycle |

## BFF

`services/api/src/consumer/risk-evidence-adapter.ts` exposes `buildRiskEvidenceBffSnapshot()` with `providerDetailsExposed: false`.

## Tests

- `packages/risk-evidence/src/risk-evidence.test.ts` — unit tests
- `tests/wave-4-prompt-16-kyb-fraud-intelligence.test.ts` — integration tests (24 scenarios)

## Related documentation

- `docs/providers/FREE_API_MASTER_CATALOG.md` — Wave 4 scope
- `docs/productization/PHASE_D_03_COMPLIANCE_PROVIDER_ADAPTERS.md` — compliance adapters
- `config/providers/wave4-catalog-entries.yaml` — Wave 4 catalog overlay

## Prompt 17 recommendation

When the authoritative 126-provider master list is supplied, populate `kyb_identity`, `fraud_risk`, and `cybersecurity` catalog entries with verified free/public APIs. Wire each through `packages/risk-evidence` adapters using the established `BusinessIdentityEvidence` / `DigitalRiskEvidence` envelope. Until then, production remains simulation-only with `sec-edgar` for US corporate identity and Chunk 152 fixtures for KYB/digital-risk rehearsal.
