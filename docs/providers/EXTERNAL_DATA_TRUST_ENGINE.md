# External Data Trust Engine

**Owner:** `packages/provider-sdk` (trust core) + `packages/external-data` (orchestration)  
**Wave:** 7 / Prompt 26  
**Status:** Simulation reference plane only — no execution authority

## Purpose

SunRey ingests many external observations across FX, markets, macro, weather, energy, compliance, and blockchain domains. The External Data Trust Engine provides a **deterministic, explainable** mechanism to decide:

- how trustworthy an observation is
- whether it is fresh
- whether sources agree
- whether a value is an outlier
- whether a source has sufficient authority
- whether a canonical product value can be selected
- whether data should be withheld because confidence is insufficient

This is **not** a black-box AI oracle. It does **not** grant financial execution authority.

## Architecture

```
Providers / Adapters
        ↓
ExternalObservation<T>[]
        ↓
ExternalDataTrustEngine (provider-sdk)
        ↓
CanonicalTrustResult<T>
        ↓
Domain Service / ExternalDataTrustPlane
        ↓
BFF / World / Financial Agent evidence
```

### Package layout

| Path | Role |
|------|------|
| `packages/provider-sdk/src/trust/` | Core types, policies, consensus, engine |
| `packages/external-data/src/trust-engine/` | Plane orchestration, audit log |
| `packages/external-data/src/plane.ts` | `plane.trust` integration |

## Trust factors

Every assessment considers explainable factors:

1. **Authority** — `authoritative_official` → `community_data` hierarchy
2. **Freshness** — `fresh`, `aging`, `stale`, `expired` (stale cannot become fresh via consensus)
3. **Provider health** — from `ProviderRiskMonitor`: healthy, degraded, suspicious, quarantined
4. **Schema validity** — valid observations only for consensus
5. **Corroboration** — independent sources supporting the same semantic value
6. **Provider diversity** — mirrored upstream sources deduplicated via `upstreamSource` / `sourceFamily`
7. **Outliers** — median deviation + IQR; flagged, not silently deleted
8. **Dataset quality** — policy-specific minimums and time skew

## Confidence methodology

Confidence uses **coarse bands**, not fake precision:

| Band | Typical score range | Meaning |
|------|---------------------|---------|
| HIGH | ≥ 0.75 | Strong authority + freshness + corroboration |
| MEDIUM | 0.45 – 0.74 | Usable reference with caveats |
| LOW | < 0.45 | Weak or insufficient |

Optional `confidenceScore` is rounded to **two decimal places** (e.g. `0.85`, not `0.843725`).

## Policy profiles

Each data class uses a versioned policy:

| Profile | Version | Selection | Notes |
|---------|---------|-------------|-------|
| `FX_REFERENCE` | `fx_reference_v1` | Weighted median | 15 min time skew |
| `MARKET_REFERENCE` | `market_reference_v1` | Weighted median | Venue/asset identity required |
| `MACROECONOMIC` | `macroeconomic_v1` | Authority precedence | Quarterly/year alignment |
| `WEATHER` | `weather_v1` | Retain all | No forecast averaging |
| `ENERGY` / `RESOURCE` | `energy_v1` / `resource_v1` | Authority precedence | Geography-specific |
| `COMPLIANCE_EVIDENCE` | `compliance_evidence_v1` | Retain all | Kernel remains authoritative |
| `CHAIN_STATE` | `chain_state_v1` | No averaging | Hash conflict → CONFLICTED |
| `RESEARCH` | `research_v1` | Metadata only | No truth score |

## Semantic equivalence

Observations are compared only when they share canonical **semantic identity**:

- `USD/EUR` spot reference ≠ `EUR/USD` without normalization
- BTC/USD aggregate ≠ Binance BTC/USDT venue quote
- US CPI headline ≠ US core CPI
- Current temperature ≠ tomorrow's forecast

Use `semanticKey` on `TrustObservationContext` or rely on inferred keys from capability + dataset + symbol/pair.

## Time alignment

Policy `maxTimeSkewMs` enforces alignment:

- Real-time crypto: seconds/minutes
- Daily FX reference: same publication window
- GDP: same quarter/year
- Weather: same forecast valid time

## Outlier methodology

For numeric data (FX, markets):

1. Compute median of eligible values
2. Flag **OUTLIER** when both:
   - Percent deviation exceeds policy tolerance
   - Value outside 1.5× IQR band
3. Flag **SUSPECTED_OUTLIER** when only percent deviation triggers
4. Outliers are excluded from consensus but retained in provenance

## Authority handling

Official sources can override aggregators when disagreement exceeds tolerance (`AUTHORITY_OVERRIDE`). Majority vote is **not** the default.

## Source lineage

Optional metadata on `TrustObservationContext.lineage`:

```typescript
{
  upstreamSource?: string | null;
  datasetOrigin?: string | null;
  sourceFamily?: string | null;
}
```

Mirrored sources sharing `upstreamSource` count once for independence (`MIRRORED_SOURCE_DEDUPED`). Lineage is never fabricated when unknown.

## Trust result model

`CanonicalTrustResult<T>` includes:

- `canonicalValue`, `canonicalUnit`, `status`
- `confidenceScore`, `confidenceBand`, `freshness`
- `selectedObservationIds`, `supportingObservationIds`, `conflictingObservationIds`, `excludedObservationIds`
- `authoritySummary`, `providerDiversity`, `corroborationCount`
- `outlierStatus`, `selectionMethod`, `trustPolicyVersion`
- `reasons[]` with machine-readable codes
- `grantsExecutionAuthority: false` (always)

### Status values

`TRUSTED` | `SUPPORTED` | `LOW_CONFIDENCE` | `CONFLICTED` | `STALE` | `INSUFFICIENT_DATA` | `UNAVAILABLE`

## Reason codes

Examples:

| Code | Meaning |
|------|---------|
| `OFFICIAL_SOURCE_SELECTED` | Official source chosen |
| `MULTI_SOURCE_CORROBORATION` | Multiple sources agree |
| `SOURCE_QUARANTINED` | Provider quarantined |
| `VALUE_OUTLIER` | Numeric outlier flagged |
| `CHAIN_STATE_CONFLICT` | Block hash disagreement |
| `COMPLIANCE_EVIDENCE_INDEPENDENT` | Records not collapsed |

Full list: `packages/provider-sdk/src/trust/reason-codes.ts`

## Domain integration examples

### FX reference (not execution rate)

```typescript
const plane = new ExternalDataPlane();
const trust = plane.trust.assessFxPair(plane, 'USD', 'EUR');
// trust.canonicalValue.rate — reference only
// trust.grantsExecutionAuthority === false
```

### Market reference

```typescript
const trust = plane.trust.assessMarketFromPlane(plane, 'AAPL');
```

### Weather (retain models)

Weather policy returns `RETAIN_ALL` — forecasts stay forecasts; ensemble differences preserved.

### Compliance

Compliance screening returns independent evidence records. Compliance Kernel decides outcomes.

### Blockchain

Same chain + height + different hash → `CONFLICTED` + `CHAIN_STATE_CONFLICT`. Never alters SunRey native consensus.

## Financial Agent integration

`plane.trust.agentEvidenceWithTrust()` augments evidence refs with `trustMetadata`:

- source count, corroboration, confidence band, freshness, conflicts
- `grantsExecutionAuthority: false` always

Example reasoning: *"FX estimate has high-confidence corroboration from 3 sources"* — useful context, **not** permission to transact.

## World integration

`worldEconomySnapshotAsync()` includes sanitized quality:

```json
{
  "fxQuality": { "status": "LIVE", "quality": "HIGH", "sources": 2, "updatedAt": "..." },
  "marketQuality": { "status": "LIVE", "quality": "MEDIUM", "sources": 1, "updatedAt": "..." }
}
```

Internal scoring methodology is not exposed to frontend users.

## Audit / reproduction

`engine.toAuditRecord(result)` stores:

- policy version, input/selected/excluded observation IDs
- reason codes, status, confidence band, `generatedAt`

Raw payloads are **not** duplicated — only observation ID references.

## Financial authority boundary

| Component | May change money state? |
|-----------|-------------------------|
| External Data Trust Engine | **No** |
| CanonicalTrustResult | **No** (`grantsExecutionAuthority: false`) |
| Compliance Kernel | Yes (via Execution Authority) |
| Exchange execution | Yes (separate path) |

## Tests

`tests/wave-7-prompt-26-external-data-trust-engine.test.ts` — 26 scenarios covering consensus, outliers, authority, stale/quarantine, mismatches, domain policies, agent/world integration.

## Related docs

- `docs/providers/EXTERNAL_DATA_PROVENANCE.md`
- `docs/providers/PROVIDER_RISK_MONITOR.md`
- `docs/providers/MARKET_REFERENCE_PROVIDERS.md`
