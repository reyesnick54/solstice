# Compliance Intelligence Providers (Wave 4 Prompt 15)

## Overview

SunRey's **Compliance Intelligence** layer integrates eligible free/public compliance
data providers through fixture-backed adapters in simulation. External providers
supply **evidence only**. The **Compliance Kernel** remains the sole authority for
allow, reject, hold, manual review, and transaction restrictions.

```
External Provider (OpenSanctions, INTERPOL, …)
        ↓
ComplianceIntelligenceProvider adapter (fixture transport in simulation)
        ↓
ComplianceEvidence (normalized)
        ↓
ComplianceScreeningEvidenceService
        ↓
Compliance Kernel / ComplianceFabric.collectFacts
        ↓
ALLOW / REVIEW / HOLD / REJECT / DEFER
```

## Providers in scope

| Provider ID | Name | Capabilities | Production | Launch tier |
| --- | --- | --- | --- | --- |
| `open-sanctions` | OpenSanctions | sanctions, PEP, watchlists, entity resolution | **Blocked** — commercial license required | `blocked_pending_review` |
| `interpol-red-notices` | INTERPOL Red Notices | wanted_persons, public enforcement | Preview/simulation only | `production_candidate` |

### Not in scope (not in authoritative catalog)

- **Vett** — not present in the Wave 0 catalog; not invented for this prompt.
- Providers without verified free-tier or unclear commercial terms remain catalog-only or blocked.

### Blocked providers

| Provider | Reason |
| --- | --- |
| `open-sanctions` (production) | CC BY-NC 4.0; commercial compliance screening requires paid license |

## List coverage

### Sanctions (via OpenSanctions fixtures)

- OFAC SDN (`us_ofac_sdn`)
- UK HMT (`gb_hmt_sanctions`)
- EU Financial Sanctions (`eu_fsf`)
- UN Security Council (`un_sc_sanctions`)

### PEP (via OpenSanctions fixtures)

- Wikidata PEP dataset (`wd_peps`)
- Distinct `PEP` classification — not equivalent to sanctions
- Preserves `current` / `former` / `family` / `associate` relationship types when source supplies them

### Watchlist / wanted

- INTERPOL Red Notices — `WANTED` classification (distinct from `SANCTIONS`)
- Yellow/UN notices are out of scope for this prompt's adapter surface

## Authority classes

| Provider | Authority class |
| --- | --- |
| OpenSanctions | `reference_data` |
| INTERPOL Red Notices | `authoritative_official` |

## Evidence model

Canonical type: `ComplianceEvidence` (`sunrey.compliance-evidence.v1`)

Key fields:

- `evidenceId`, `subject`, `match`, `source`, `classification`, `time`, `quality`, `provenance`
- `grantsDecisionAuthority: false`, `isKernelDecision: false`

Separate type: `ComplianceDecision` — **Kernel-only**, never produced by adapters.

## Entity matching

- Name normalization: Unicode NFKC, whitespace/punctuation collapse; originals preserved
- Dimensions: name, aliases, DOB, nationality, country, organization identifiers
- Bounded fuzzy matching: `token_overlap_v1` with threshold 0.75
- Provider native score retained separately from SunRey score
- Name-only matches are never conclusive — unmatched fields recorded

## Caching

| Capability | Fresh TTL | Notes |
| --- | --- | --- |
| Search query | 15 min | Short/moderate |
| Record metadata | 6 h | Source update cadence |
| Negative observation | 30 min | No indefinite no-match retention |

## Rescreening

Configuration model (`ComplianceRescreenConfig`):

- Initial onboarding screening
- Periodic rescreening (default 7 days)
- Event-triggered: `KYC_UPGRADE`, `JURISDICTION_CHANGE`, `MANUAL_REQUEST`

Mass customer rescreening is **not** automatically scheduled.

## Privacy

- Logs use `privacySafeSubjectRef` / `privacySafeEvidenceLogRef`
- DOB, passport, national ID, addresses are redacted from log payloads
- BFF exposes canonical statuses only — no raw provider payloads or credentials

## Compliance Kernel boundary

- `ComplianceScreeningEvidenceService` has no financial authorization methods
- `bridgeEvidenceToKernel` produces `ScreeningEvidenceFact` with `legalConclusion: false`
- Exchange and Financial Agent consume Kernel results — no direct provider access
- Blockchain consensus is independent of external provider availability

## Integration points

| Consumer | Path |
| --- | --- |
| Kernel | `packages/kernel/src/compliance-intelligence/bridge.ts` |
| KYC boundary | Evidence collected after identity verification via `bridgeEvidenceToKernel` |
| Exchange | `exchange-integration.ts` — metadata only, Kernel decides |
| Financial Agent | `agent-evidence.ts` — research evidence, no execution authority |
| Consumer BFF | `services/api/src/consumer/compliance-intelligence-adapter.ts` |

## Known limitations

- Simulation uses fixture transports only — no live HTTP to external providers
- OpenSanctions production activation blocked pending commercial license
- Partial catalog (2 of 126 providers); full master list pending
- Vett and other unnamed providers not integrated without catalog entries

## Validation

```bash
node scripts/sync-compliance-intelligence-catalog.mjs
npm test -- tests/wave-4-prompt-15-compliance-intelligence.test.ts
```

## Related documentation

- `docs/providers/PROVIDER_SDK_ARCHITECTURE.md`
- `docs/compliance/chunk-152-regulated-provider-candidates.md`
- `docs/productization/PHASE_D_03_COMPLIANCE_PROVIDER_ADAPTERS.md`
