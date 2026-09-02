# SunRey Provider Registry

**Version:** 1.0.0-wave4-prompt2  
**Catalog:** `config/providers/free-api-catalog.yaml` (+ wave overlay YAML files)  
**Runtime registry:** `packages/provider-sdk/src/connector/connector-registry.ts`

---

## Inventory summary (audit date: 2026-09-02)

| Metric | Value |
|--------|-------|
| Unique providers discovered | **124** |
| Free API catalog entries | 102 |
| Overlay YAML entries (additional) | 22+ unique ids merged |

### By economic plane

| Plane | Count |
|-------|-------|
| HUMAN_ECONOMY | 26 |
| PRODUCTIVE_ECONOMY | 22 |
| REFERENCE_CONTEXT | 76 |

### By default source class (from authority_class mapping)

| Source class | Count |
|--------------|-------|
| GOVERNMENT | 35 |
| PUBLIC_DATASET | 67 |
| DERIVED_MODEL | 12 |
| ENTERPRISE_SYSTEM | 4 |
| RESEARCH_DATABASE | 3 |
| AGGREGATOR | 3 |

---

## Catalog files

| File | Role |
|------|------|
| `config/providers/free-api-catalog.yaml` | Primary merged catalog (102 providers) |
| `config/providers/free-api-catalog.schema.json` | JSON Schema validation |
| `config/providers/wave2-catalog-entries.yaml` | Wave 2 macro/FX overlays |
| `config/providers/wave3-crypto-catalog-entries.yaml` | Crypto market overlays |
| `config/providers/wave4-catalog-entries.yaml` | Compliance / cyber overlays |
| `config/providers/wave5-energy-resource-catalog-entries.yaml` | Energy overlays |
| `config/providers/wave5-physical-economy-catalog-entries.yaml` | Physical economy (EIA, …) |
| `config/providers/wave5-travel-catalog-entries.yaml` | Travel / mobility |
| `config/providers/wave6-health-hin-catalog-entries.yaml` | Health / HIN reference |
| `config/providers/wave6-opportunity-skills-catalog-entries.yaml` | Jobs / skills |
| `config/providers/wave2-access-discovery-catalog-entries.yaml` | Access discovery |

Run audit: `auditProviderCatalogs()` in `packages/provider-sdk/src/connector/inventory.ts`.

---

## Domain classification

Providers are classified into economic domains (see `domain-taxonomy.ts`):

**Human economy:** health, research, education, workforce, skills, publications, identity_attestations, other_human_contribution

**Productive economy:** energy, compute, ai_compute, manufacturing, resources, agriculture, food, real_estate, infrastructure, logistics, transportation, bandwidth, water, other_productive

**Reference / context:** weather, geospatial, economic_statistics, market_data, regulatory, government, filings, other_reference

---

## Migration status (Wave 4 Prompt 2)

| Provider | Status | Framework connector |
|----------|--------|---------------------|
| `national-grid-eso` | **MIGRATED** | `RestGovernedConnector` |
| `usda-fooddata-central` | **MIGRATED** | `RestGovernedConnector` |
| `arbeitnow` | **MIGRATED** | `RestGovernedConnector` |
| `noozra` | **MIGRATED** | `RestGovernedConnector` |
| All others with `existing_adapter` | LEGACY_ADAPTER | Prior wave adapters |
| Catalog-only entries | CATALOG_ONLY | Metadata only |

---

## Registration API

```typescript
import {
  createGovernedConnectorRegistry,
  bootstrapWave4MigratedConnectors,
} from '@solstice/provider-sdk';

const registry = createGovernedConnectorRegistry();
bootstrapWave4MigratedConnectors(registry);

const connector = registry.getConnector('national-grid-eso');
const definition = registry.getDefinition('national-grid-eso');
```

`ProviderRegistry` (`packages/provider-sdk/src/registry.ts`) remains the lifecycle registry for `SunReyProvider` implementations. `GovernedConnectorRegistry` is the Wave 4 connector plane.

---

## Credentials

Never store API keys, OAuth tokens, or passwords in catalog YAML or `ProviderDefinition`. Use:

- `authentication.environment_variable` in catalog (name only)
- `secret://environment/<VAR>` resolution at transport boundary
- Redaction catalog for logs

---

## Maintenance

1. Add provider to appropriate YAML overlay + merge into `free-api-catalog.yaml` when canonical
2. Map `sourceClass` and lineage when upstream is known
3. Implement or migrate connector via `GovernedConnectorRegistry`
4. Update this document migration table
5. Run `packages/provider-sdk/src/connector/connector-framework.test.ts`
