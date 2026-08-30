# SunRey External Data Provenance

Wave 1 — canonical framework for turning third-party API payloads into
traceable, normalized, confidence-aware observations.

`ENVIRONMENT=simulation`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`

Owner: `packages/provider-sdk`

This package is the shared normalization contract. It is not a provider
integration, not a second oracle, and not Execution Authority.

## Observation envelope

`ExternalObservation<T>` is the canonical envelope after normalization.
Domain adapters map provider payloads into `T`; the envelope always
carries provenance, time, quality, authority, and licensing metadata.

Required conceptual fields:

| Field | Purpose |
| --- | --- |
| `observationId` | Stable identifier for the normalized observation |
| `providerId` | SunRey provider registry identifier |
| `providerCategory` | banking, market_data, oracle, etc. |
| `capability` | Provider operation (e.g. `spot_price`) |
| `data` | Canonical mapped domain payload |
| `source` | Provider, dataset, sanitized `sourceUrl` |
| `time` | Retrieval, source, effective, stale, and expiry timestamps |
| `quality` | Confidence, freshness, validation status |
| `authority.authorityClass` | Wave 0 authority class (see below) |
| `provenance` | Request id, payload hash, schema versions |
| `licensing` | Commercial use and redistribution posture |

Schema version: `sunrey.external-observation.v1`

## Provenance

Every observation is traceable to:

- provider ID and dataset / endpoint
- `retrievedAt` (when SunRey fetched the payload)
- `sourceTimestamp` (when the provider generated the value, if known)
- `normalizationVersion` and `providerSchemaVersion`
- `rawPayloadHash` — SHA-256 digest of what SunRey received

Secrets never persist in provenance. Auth query parameters (`api_key`,
`token`, `access_token`, etc.) are stripped from `sourceUrl` before
storage.

The hash proves what SunRey received. It does **not** prove the
provider content is objectively true.

## Freshness model

Normalized freshness states:

| State | Meaning |
| --- | --- |
| `fresh` | Within policy aging window |
| `aging` | Past half the stale threshold |
| `stale` | Past `staleAfterSeconds` for the capability policy |
| `expired` | Past `expiredAfterSeconds` |
| `unknown` | No reference timestamp available |

TTL is **never global**. Each capability supplies a `FreshnessPolicy`.
Examples shipped in the SDK:

- `MARKET_PRICE_FRESHNESS_POLICY` — seconds to minutes
- `MACRO_STATISTIC_FRESHNESS_POLICY` — days to weeks

## Confidence framework

Confidence is generic and extensible for later multi-source consensus
(Prompt 26).

```typescript
confidence: {
  score: 0.0–1.0 | null,
  basis: ['authoritative_source', 'fresh', 'schema_valid', ...]
}
```

Basis may reflect provider trust, schema validity, freshness,
corroboration, and authority class. When confidence cannot be
reasonably calculated, `score` is `null`.

`authoritative_official` does **not** grant Execution Authority.
Financial actions still pass through Kernel, compliance, and human
approval.

## Authority class

Wave 0 classes travel with every observation:

| Class | Typical use |
| --- | --- |
| `authoritative_official` | Government / central bank official statistics |
| `regulated_provider` | Licensed financial institution feed |
| `reference_data` | Industry reference prices and identifiers |
| `research_data` | Research and analytics providers |
| `community_data` | Crowdsourced or community-maintained data |
| `derived_data` | Computed from other observations |

## Payload hashing

```typescript
import { hashRawPayload, hashRawJsonPayload } from '@solstice/provider-sdk';

const hash = hashRawJsonPayload(providerJson);
// hash.algorithm === 'sha256'
// hash.digest === 64-char hex
```

JSON payloads use canonical key-sorted serialization for deterministic
digests. Use `hashRawPayload` for non-JSON bodies.

## Schema evolution

Three version dimensions are tracked:

1. `providerSchemaVersion` — vendor API schema
2. `normalizationVersion` — SunRey adapter mapping version
3. `canonicalModelVersion` — target domain model version (optional)

Observations normalized under different versions remain distinguishable
for audit and replay.

## Normalization pipeline

```
RawProviderResponse
  → untrusted JSON parse
  → provider schema validation
  → provider parser
  → canonical domain mapping
  → ExternalObservation<T>
  → domain service
```

Adapters supply provider-specific validators, parsers, and mappers.
The SDK supplies the envelope, provenance, freshness, confidence, and
security contracts.

## Deduplication

Policies compose key parts — no one-size-fits-all rule:

- `exact-payload` — provider + dataset + rawPayloadHash
- `source-timestamp-entity` — provider + dataset + sourceTimestamp + entityId
- `capability-payload` — provider + capability + rawPayloadHash

Use `buildDeduplicationKey`, `createInMemoryDeduplicationRegistry`, and
`isDuplicate` hooks; production stores may replace the in-memory registry.

## Validation and security

Generic validators cover required fields, numeric bounds, UTC
timestamps, ISO currency and country codes, asset identifiers, enums,
and unexpected nulls.

Untrusted input defenses:

- max JSON depth, string length, array length, object keys, payload bytes
- prototype pollution key rejection
- malformed JSON rejection
- HTML/script stripping for text fields
- unsafe URL protocol rejection

Do not render provider HTML through the frontend.

## Data quality events

Events integrate with `packages/events` taxonomy under the `provider`
namespace:

| Event | When |
| --- | --- |
| `ProviderDataInvalid` | Schema or bounds validation failed |
| `ProviderDataStale` | Freshness policy exceeded |
| `ProviderSchemaChanged` | Provider schema version mismatch |
| `ProviderDataOutlier` | Statistical outlier detected |
| `ProviderPayloadDuplicate` | Deduplication policy matched |

Create events with `createProviderDataQualityEvent`.

## Financial Agent evidence

Observations map to evidence references via `toAgentEvidenceRef`:

```
ExternalObservation
  → Agent Evidence (reference only)
  → Agent recommendation
  → Suitability / Compliance / User Approval
  → Execution Authority
```

Evidence refs carry `grantsExecutionAuthority: false` and
`treatedAsTradeInstruction: false`. Provider data never bypasses
Kernel gating.

## Related owners

| Domain | Canonical owner |
| --- | --- |
| Oracle observations | `packages/sunrey-chain/src/oracle` |
| Market data quotes | `packages/sunrey-exchange/src/market-data` |
| Provider runtime | `packages/sunrey-chain/src/provider-runtime` |
| Agent tools / evidence | `packages/sunrey-agent` |
| Events transport | `packages/events` |

Extend domain owners with adapters that emit `ExternalObservation`.
Do not duplicate this envelope in parallel packages.
