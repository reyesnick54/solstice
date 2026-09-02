# Wave 4 — Provider Connector Framework

**Version:** 1.0.0-wave4-prompt2  
**Owner:** `packages/provider-sdk/src/connector`  
**Companion:** `docs/architecture/WAVE4_ECONOMIC_AWARENESS_FABRIC.md`

---

## 1. Problem

Hundreds of external economic information sources cannot each use incompatible one-off integrations. Wave 4 Prompt 2 introduces one governed connector architecture shared across human-economy, productive-economy, and reference/context domains.

---

## 2. ProviderDefinition

Versioned schema: `sunrey.provider-definition.v1`

| Field | Purpose |
|-------|---------|
| `providerId` | Stable catalog identifier |
| `providerName` | Display name |
| `domain` | Economic domains (health, energy, workforce, …) |
| `sourceClass` | Independence class (GOVERNMENT, AGGREGATOR, …) |
| `providerType` | Catalog primary category |
| `baseEndpoint` | HTTPS reference (no credentials) |
| `authType` | none, api_key, oauth, … |
| `secretEnvironmentVariable` | Env var **name only** — never the secret value |
| `license` | commercialUse, redistribution, persistencePolicy |
| `rateLimit` | Documented quotas |
| `expectedFreshness` | realtime, daily, weekly, … |
| `jurisdictions` | Geographic scope |
| `dataCategories` | Capability tags |
| `productionApproved` | From launch tier |
| `enabledEnvironments` | simulation, sandbox, preview, production_candidate |
| `connectorType` | REST (others are interface-only) |
| `schemaVersion` | Definition schema version |

Built from catalog entries via `catalogEntryToProviderDefinition()`. Credentials are resolved at runtime through `packages/security` secret references.

---

## 3. Source classes

Canonical classes (`packages/provider-sdk/src/connector/source-class.ts`):

`GOVERNMENT`, `PRIMARY_OPERATOR`, `DIRECT_SENSOR`, `ENTERPRISE_SYSTEM`, `ACADEMIC`, `RESEARCH_DATABASE`, `SATELLITE`, `PUBLIC_DATASET`, `AGGREGATOR`, `DERIVED_MODEL`, `MARKET`, `USER_ATTESTATION`, `THIRD_PARTY_ATTESTATION`

Extensible via `CUSTOM:<name>` prefix.

**Independence rule:** Different `providerId` values do not imply independent sources. Use the lineage registry.

---

## 4. Provider lineage

`ProviderLineageRegistry` records:

- `ORIGINATES` — primary dataset
- `DERIVES_FROM` / `REPUBLISHES` / `AGGREGATES` / `TRANSFORMS` — derived providers

`independenceGroupId` groups providers that share upstream truth. Example: three EIA republishers → `countIndependentSources` returns 1.

Fixture lineage registered at bootstrap:

- `eia` (origin)
- `eia-republisher-a`, `eia-republisher-b` (REPUBLISHES → eia)

---

## 5. Governed connector interface

```typescript
interface GovernedConnector {
  readonly definition: ProviderDefinition;
  fetch(operation, params, context): Promise<ConnectorFetchResult>;
  getOperationalHealth(): ProviderOperationalHealth;
  getLineage(): ProviderLineageRecord | null;
}
```

Responsibilities: authentication, request construction, transport, rate limits, safe retry, raw capture policy, normalization handoff, operational health.

Forbidden: verify facts, GPUV, PEVE, mint, approve issuance.

---

## 6. Connector types

| Type | Status |
|------|--------|
| REST | **Implemented** (`RestGovernedConnector`) |
| GraphQL | Interface contract only |
| WebSocket | Interface contract only |
| FILE_BATCH | Interface contract only |
| DATABASE_FEDERATED | Interface contract only |
| EVENT_STREAM | Interface contract only |
| WEBHOOK | Interface contract only |
| SENSOR_IOT_GATEWAY | Interface contract only |
| FIXTURE | Used in simulation mode |

---

## 7. Secret management

- Catalog stores `environment_variable` names only
- `SecretBackedProviderAuthResolver` resolves `secret://` references
- `redaction.ts` strips API keys, tokens, passwords from logs and URLs
- Tests assert credentials never appear in error messages

---

## 8. Rate limits, retries, deduplication

Reuses `ProviderReliabilityControlPlane`:

- Bounded retry with backoff
- Timeouts and circuit breaker
- Rate limiting and bulkhead

Transport retry identity (`transportRetryIdentity` on `ConnectorRequestContext`) feeds deduplication policy `transport-retry` so retries do not create duplicate economic observations.

---

## 9. Operational health (not trust)

States: `AVAILABLE`, `DEGRADED`, `RATE_LIMITED`, `AUTH_FAILURE`, `SCHEMA_CHANGED`, `UNAVAILABLE`, `DISABLED`

`trustScore` is always `null` on operational health records. Trust evaluation uses `packages/provider-sdk/src/trust`.

---

## 10. Migrated providers (Prompt 2)

| Provider | Domain | Connector |
|----------|--------|-----------|
| `national-grid-eso` | energy / productive | REST fixture |
| `usda-fooddata-central` | health / human | REST fixture + api_key auth ref |
| `arbeitnow` | workforce / human | REST fixture |
| `noozra` | research / human | REST fixture |

Legacy adapters remain; new code should use `GovernedConnectorRegistry`.

Bootstrap: `bootstrapWave4MigratedConnectors(registry)`.

---

## 11. Tests

`packages/provider-sdk/src/connector/connector-framework.test.ts` covers:

- Unknown provider, disabled provider, bad credentials, timeout, retry
- Duplicate retry deduplication, rate limit, schema failure
- Health transitions, lineage, shared upstream, environment restrictions
- License/persistence metadata

---

## 12. Related owners (not duplicated)

| Owner | Role |
|-------|------|
| Chunk 127 `EconomicDataConnectorRuntime` | Productive oracle off-chain collection |
| `packages/external-data` | Domain services and wave adapters |
| `packages/sunrey-chain/src/oracle/production` | Oracle certification and observation drafts |

Wave 4 connector framework is the **catalog-backed universal plane**; domain owners may wrap or delegate to it without creating parallel connector stacks.
