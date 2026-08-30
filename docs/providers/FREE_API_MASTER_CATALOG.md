# SunRey Free API Master Catalog

## Purpose

SunRey is building a normalized **external-data plane** rather than allowing
individual application components to make uncontrolled third-party HTTP requests.
The free API master catalog is the authoritative, machine-readable registry for
the 126 external free/public APIs identified for platform integration.

External providers supply **observations and reference data only**. They do not
receive decision authority over financial execution, customer balances,
settlement, custody, compliance approval, blockchain consensus, SunRey Coin
issuance, or MoonRey Coin issuance.

## Wave 0 status

**Authoritative 126 API list not found.** During Wave 0 preflight inspection,
no complete master list of 126 free/public APIs was located anywhere in the
SunRey repository (searched `docs/`, `packages/`, `config/`, provider/oracle
documentation, and related matrices).

The catalog **framework is ready** (schema, validation, tests, documentation),
but the source list must be supplied before population. Do not invent providers
to reach 126 entries.

| Artifact | Path |
| --- | --- |
| Catalog (YAML) | `config/providers/free-api-catalog.yaml` |
| JSON Schema | `config/providers/free-api-catalog.schema.json` |
| Validator | `scripts/lib/free-api-catalog-validator.mjs` |
| CLI | `npm run providers:validate` |
| Tests | `tests/free-api-catalog.test.ts` |

When the master list is supplied, set `population_status` to `populated` (or
`partial` during incremental import) and record provenance in `source_list`.

## Architecture

External data must never be fetched directly by the frontend or by ad hoc service
HTTP clients. The target integration path is:

```
External Provider
    ↓
SunRey provider adapter (domain-owned port)
    ↓
Universal Provider Runtime (packages/sunrey-chain/src/provider-runtime)
    ↓
Transport / Auth (Chunk 149 credential plane — secret:// references only)
    ↓
Rate Limit / Retry / Circuit Breaker
    ↓
Validation
    ↓
Normalization
    ↓
Provenance
    ↓
Caching
    ↓
Canonical SunRey Domain Service
    ↓
Consumer BFF (services/api)
    ↓
SunRey Application
```

**Do not create** `packages/provider-sdk`, `packages/providers`, or a parallel
provider runtime. Extend the canonical owner:

- Runtime and lifecycle: `packages/sunrey-chain/src/provider-runtime`
- Regulated adapters: domain packages (`payments`, `identity`, `kernel`,
  `custody`, `access-economy`, `ai-runtime`, oracle external candidates)
- Credentials: `packages/security/src/regulated/credentials` (descriptor refs
  only; never raw secrets in git)

Frontend consumers should eventually request SunRey resources such as:

- `/api/v1/world/economy`
- `/api/v1/world/resources`
- `/api/v1/exchange/markets`
- `/api/v1/travel/search`

…without knowing which external provider supplied the underlying observation.

## Existing provider architecture (inspected)

| Layer | Location | Role |
| --- | --- | --- |
| Universal Provider Runtime | `packages/sunrey-chain/src/provider-runtime` | Registration, lifecycle, health, failover |
| Production binding | `packages/sunrey-chain/src/providers/production-binding` | Environment binding, credential refs |
| Oracle external candidates | `packages/sunrey-chain/src/oracle/production/external-provider-candidate` | Economic-data provider profiles |
| Access / travel adapters | `packages/access-economy/src/providers` | Expedia, Airbnb, Turo, DoorDash, Amazon (simulation/sandbox) |
| AI model gateway | `packages/ai-runtime/src/gateway.ts` | S3M, HTTPS generic, local test inference |
| Regulated fixtures (Chunk 152) | `identity`, `kernel/compliance`, `custody`, `market-surveillance` provider-candidate dirs | KYC, sanctions, AML, custody, surveillance |
| Payments / FX candidates | `packages/payments/src/production-candidate` | Banking, rail, FX profiles (sandbox) |

Posture remains simulation-only: `ENVIRONMENT=simulation`, all `LIVE_*` and
`REAL_*_PROVIDER_CONNECTED` flags are `false`.

## Provider statistics

Run `npm run providers:validate` for live counts. As of Wave 0 (empty catalog):

| Metric | Count |
| --- | ---: |
| Total providers | 0 |
| Expected | 126 |
| Verified | 0 |
| Partially verified | 0 |
| Unverified | 0 |
| Production candidates | 0 |
| Authentication required | 0 |
| No authentication | 0 |
| Commercial use verified | 0 |
| Legal review required | 0 |

Statistics are computed from the catalog at validation time — never hard-coded.

## Catalog entry requirements

Every populated provider must include:

- **Identity:** `provider_id`, name, short name, description, category,
  capabilities
- **Endpoints:** base URL, API version, documentation URL, status URL (null when
  unknown)
- **Authentication:** type, registration requirement, environment variable name
  (never a secret value)
- **Access:** free-access classification (`verified_free`, `free_tier`, etc.)
- **Commercial use** and **redistribution** status (use `unknown` / `unclear`
  when not verified)
- **Rate limits** when officially documented; otherwise null
- **Data characteristics:** freshness, geography, historical/real-time flags
- **SunRey mapping:** domains, `authority_class`, priority, launch tier
- **Verification:** status, last verified date, notes

### Authority classes

External public APIs are generally **data sources**, not authorities:

| Class | Meaning |
| --- | --- |
| `authoritative_official` | Government or official statistical issuer |
| `regulated_provider` | Regulated financial or identity vendor |
| `reference_data` | Widely used reference feeds (markets, FX quotes) |
| `research_data` | Academic or research-oriented datasets |
| `community_data` | Community-maintained open data |
| `derived_data` | Aggregated or computed third-party data |

### SunRey domains

`world`, `grow`, `financial_agent`, `exchange`, `blockchain_intelligence`,
`moonrey`, `hin`, `vault`, `travel`, `compliance`, `cybersecurity`,
`economic_graph`, `action_center`, `research`, `infrastructure`

## Integration waves (future — not Wave 0)

| Wave | Scope |
| --- | --- |
| **Wave 1** | Universal provider infrastructure (runtime wiring, credential binding, transport guards) |
| **Wave 2** | Economics / markets / FX |
| **Wave 3** | Crypto / blockchain intelligence |
| **Wave 4** | Compliance / KYB / fraud / cybersecurity |
| **Wave 5** | Energy / resources / weather / travel / geo / logistics |
| **Wave 6** | HIN / health / jobs / research / open data / AI |
| **Wave 7** | Product wiring / data quality / production hardening |

## Validation

```bash
npm run providers:validate
```

Strict mode (fails unless exactly 126 providers are present):

```bash
npm run providers:validate -- --strict-count
```

## Security

- No API keys, passwords, bearer tokens, or private certificates in catalog
  files.
- Environment variable **names** only (e.g. `FRED_API_KEY`).
- Catalog files are safe to commit publicly.
- Provider credentials resolve through the Chunk 149 credential plane at
  runtime, never through the Consumer BFF.

## Related documentation

- `docs/productization/SUNREY_PROVIDER_INTEGRATION_STANDARD.md`
- `docs/productization/SUNREY_EXTERNAL_PROVIDER_INTEGRATION_PACKAGE.md`
- `docs/providers/chunk-91-provider-runtime.md`
- `docs/economics/chunk-150-external-economic-provider-candidates.md`
