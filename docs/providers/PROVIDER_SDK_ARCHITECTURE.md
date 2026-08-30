# SunRey Provider SDK Architecture

## Purpose

`packages/provider-sdk` is the canonical runtime framework for SunRey **external-data
providers** — the 126 free/public APIs cataloged in
`config/providers/free-api-catalog.yaml`.

External providers supply **observations and reference data only**. They do not
receive financial authority, compliance decisions, execution authority, custody,
settlement, blockchain consensus, or SunRey/MoonRey issuance authority.

This SDK is distinct from, and complementary to:

| Layer | Location | Scope |
| --- | --- | --- |
| External-data provider SDK | `packages/provider-sdk` | Free/public API catalog, data-plane lifecycle |
| Regulated provider runtime | `packages/sunrey-chain/src/provider-runtime` | Banking, KYC, custody, payments lifecycle |
| Access/travel adapters | `packages/access-economy/src/providers` | Expedia, Airbnb, Turo, etc. |
| AI inference gateway | `packages/ai-runtime` | S3M and model providers |
| Credential plane | `packages/security/src/regulated/credentials` | `secret://` references only |

## Target integration path

```
External API
    ↓
Provider Adapter (implements ProviderAdapter)
    ↓
SunRey Provider SDK (SunReyProvider + ProviderRegistry)
    ↓
Transport / Reliability / Validation (later Wave 1 prompts)
    ↓
Canonical SunRey Domain Services
    ↓
Consumer BFF (services/api)
    ↓
Frontend
```

Domain services resolve providers through the registry:

```typescript
const providers = factory.listByCapability('fx_rates');
```

They must **not** import vendor clients directly (for example `FrankfurterClient`).

## Provider lifecycle

Every runtime provider implements `SunReyProvider`:

1. **Catalog presence** — `provider_id` must exist in `free-api-catalog.yaml`
2. **Registration** — `ProviderRegistry.register()` validates catalog metadata and activation policy
3. **Initialization** — `initialize(context)` with `ProviderRuntimeContext`
4. **Health** — `healthCheck()` returns `ProviderHealthStatus` (no secrets)
5. **Capability discovery** — `getCapabilities()`
6. **Shutdown** — `shutdown()` for graceful teardown

Lifecycle states are tracked per provider instance (`registered` → `ready` → `shutdown`).
Promotion to production connectivity is governed separately by activation policy and
existing regulated runtime gates. `ENVIRONMENT` remains `simulation`; `LIVE_*` flags
stay `false`.

## Provider registry

`ProviderRegistry` supports:

| Method | Behavior |
| --- | --- |
| `register(provider)` | Catalog-backed registration with activation evaluation |
| `unregister(providerId)` | Remove a provider |
| `get(providerId)` | Lookup registration |
| `has(providerId)` | Existence check |
| `list()` | All registrations |
| `listByCategory(category)` | Filter by catalog category |
| `listByCapability(capability)` | Filter by declared capability |
| `listEnabled()` | Runtime-enabled providers only |
| `listProductionCandidates()` | `launch_tier = production_candidate` |
| `getDescriptor(providerId)` | Sanitized metadata (no secret values) |
| `getHealth(providerId)` | Delegates to provider health contract |
| `initialize(providerId, context)` | Initialize when enabled |
| `shutdown(providerId)` | Graceful shutdown and unregister |

The registry prevents:

- Duplicate `provider_id` values
- Registration of IDs absent from the catalog
- Accidental activation of `blocked_pending_review` providers
- Descriptor / ID mismatches

## Catalog relationship

`config/providers/free-api-catalog.yaml` is the **primary metadata source**.

- `provider_id` in the catalog is the canonical `ProviderId`
- Categories, capabilities, domains, launch tier, priority, and verification state
  are loaded from the catalog — not hard-coded across services
- Runtime configuration (timeouts, feature flags) may live in service config but
  must reference catalog IDs
- Validation: `npm run providers:validate`

During Wave 0 the catalog shell may be empty (`population_status: awaiting_master_list`).
The SDK uses test fixtures for unit tests; production registration requires catalog entries.

## Capability model

Known capabilities are declared in `packages/provider-sdk/src/types.ts` (for example
`fx_rates`, `sanctions`, `weather`). Additional capability strings are permitted so
new providers can be added without breaking existing code.

Capabilities are **discovery metadata**. They do not grant a SunRey domain permission
to execute financial actions.

## Domain mappings

Catalog entries declare `sunrey.domain` values such as `world`, `exchange`,
`compliance`, and `travel`. A provider may map to multiple domains.

Domain mapping is metadata for routing and discovery only. Compliance Kernel authority,
Execution Authority, and ledger posting remain in their canonical owners.

## Enablement policy

`ProviderActivationPolicy` evaluates whether a provider may run:

| Mode | Meaning |
| --- | --- |
| `disabled` | Registered in catalog but not active |
| `preview_only` | Internal/preview consumption |
| `enabled` | Active in non-production environments |
| `production_enabled` | Requires verified catalog metadata and non-simulation environment |
| `blocked` | Cannot activate |

Policy inputs:

- `verification.status`
- `sunrey.launch_tier`
- `commercial_use.status`
- `ENVIRONMENT`
- Explicit feature flag
- Required credential availability (environment variable **name** only)

Example progression:

```
OpenSanctions in catalog
    → adapter implemented
    → preview_only activation
    → commercial/legal review completed
    → production_enabled (only when policy + environment allow)
```

## Adapter responsibilities

`ProviderAdapter` implementations **should**:

- Translate provider-specific request shapes
- Call the shared transport layer (future prompt)
- Validate external responses
- Normalize into canonical observation types

Adapters **must not**:

- Implement retry algorithms, circuit breakers, or global caching
- Store or log secrets
- Post ledger journals or issue Execution Authority
- Encode business/compliance decisions

## Prohibited responsibilities (SDK-wide)

The Provider SDK and adapters must never:

- Expose credential values in descriptors, health payloads, logs, or BFF responses
- Bypass the Compliance Kernel for consequential state
- Create a parallel provider registry in application services
- Activate `blocked_pending_review` providers

Secret configuration uses environment variable **names** in the catalog and
`secret://` references at runtime through the security credential plane.

## Example future adapter (not integrated)

```typescript
import {
  createAdapterContract,
  type AdapterRequest,
  type ProviderAdapter,
} from '@solstice/provider-sdk';

// Future Wave 2+ adapter — NOT wired in Prompt 2.
export const exampleFxAdapter: ProviderAdapter<{ base: string; quote: string }, { rate: string }> =
  createAdapterContract({
    providerId: 'frankfurter',
    supportedOperations: ['latest_rate'],
    translateRequest(request: AdapterRequest<{ base: string; quote: string }>) {
      return { from: request.params.base, to: request.params.quote };
    },
    validateResponse(raw: unknown) {
      if (!raw || typeof raw !== 'object') throw new TypeError('invalid FX payload');
    },
    normalize(raw, context) {
      return {
        data: { rate: String((raw as { rates: Record<string, number> }).rates[context.consumerDomain] ?? '0') },
        metadata: {
          providerId: 'frankfurter',
          requestId: context.requestId,
          correlationId: context.correlationId,
          observedAt: context.nowUtc,
          cacheHit: false,
          simulationOnly: true,
        },
      };
    },
  });
```

## Test fixtures

Offline mock providers live in `packages/provider-sdk/src/mocks/`:

- `MockHealthyProvider`
- `MockFailingProvider`
- `MockSlowProvider`
- `MockMalformedProvider`

Unit tests use `packages/provider-sdk/src/test-fixtures/catalog.ts` and do not
require external network access.

## Related documentation

- `docs/providers/FREE_API_MASTER_CATALOG.md` — Wave 0 catalog framework
- `docs/providers/chunk-91-provider-runtime.md` — regulated provider runtime
- `docs/productization/SUNREY_PROVIDER_INTEGRATION_STANDARD.md` — integration standard
- `config/providers/free-api-catalog.schema.json` — catalog JSON Schema

## Recommended next steps (Wave 1 Prompt 3+)

1. Universal HTTP transport with simulation-only guards
2. Shared retry / circuit-breaker layer (consumed by adapters, not reimplemented)
3. Credential binding through `packages/security` secret references
4. Domain service wiring for economics / FX / markets (Wave 2)
5. Catalog population when the authoritative 126-provider master list is supplied
