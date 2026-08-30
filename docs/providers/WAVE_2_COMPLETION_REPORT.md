# Wave 2 Completion Report

Date: 2026-08-30  
Status: **Ready for merge (simulation)**

## Provider accounting

| Metric | Count |
| --- | ---: |
| Wave 2 providers in partial catalog | 15 |
| Successfully integrated (simulation adapters) | 12 |
| Production-enabled | 0 |
| Preview-only (simulation) | 12 |
| Blocked | 2 |
| Deprecated / unavailable | 1 |
| Awaiting 126-master-list (NOT_WAVE_2 in catalog) | 0 unexplained in partial catalog |

### By category

| Category | Implemented | Blocked | Deprecated |
| --- | ---: | ---: | ---: |
| macroeconomics | 4 (+fred-commodity) | 0 | 0 |
| foreign_exchange | 2 | 0 | 0 |
| markets | 2 | 1 (yahoo) | 0 |
| commodities | 1 (fred-commodity) | 1 (quandl) | 0 |
| corporate_filings | 1 (sec-edgar) | 0 | 0 |
| government_open_data / fiscal | 2 | 0 | 1 (treasury-direct-legacy-xml) |

## Prompts 8–10 note

Prompts 8–10 were not present as separate merged branches. This PR implements the full Wave 2 economics / markets / FX / commodities plane together with Prompt 11 corporate / fiscal / regulatory scope on top of merged Wave 1 infrastructure (PRs #315–#320).

## Files created

- `packages/external-data/**`
- `packages/provider-sdk/src/observation-types.ts`
- `packages/provider-sdk/src/registry-types.ts`
- `packages/provider-sdk/src/http-transport-types.ts`
- `packages/provider-sdk/src/reliability-types.ts`
- `packages/provider-sdk/src/registry-errors.ts`
- `packages/provider-sdk/src/reliability-errors.ts`
- `packages/provider-sdk/src/transport-errors.ts`
- `config/providers/wave2-catalog-entries.yaml`
- `services/api/src/consumer/world-external-data-adapter.ts`
- `tests/wave-2-completion.test.ts`
- `docs/providers/CORPORATE_AND_FISCAL_PROVIDERS.md`
- `docs/providers/WAVE_2_COMPLETION_REPORT.md`

## Files modified

- `config/providers/free-api-catalog.yaml` (partial population, 15 providers)
- `config/providers/free-api-catalog.schema.json` (`integration_state: implemented`)
- `packages/provider-sdk/src/types.ts`, `index.ts`, `package.json` (merge corruption repair)
- `packages/provider-sdk/src/adapter.ts`, `transport.ts`, `simulate.ts`, `reliability.ts`, `errors.ts`
- `services/api/src/consumer/handler.ts`, `fixtures.ts`, `preview.ts`
- `tests/free-api-catalog.test.ts`
- `package.json` (test glob)

## Canonical services

- `MacroDataService`
- `FxReferenceService`
- `MarketReferenceService`
- `CompanyIntelligenceService`
- `ExternalDataPlane` (orchestrator)

## Integration status

| Surface | Status |
| --- | --- |
| World (`/api/v1/world/*`) | Wired via BFF adapter |
| Grow | `growContextSnapshot` bridge |
| Financial Agent | `agentEvidenceBundle` — evidence only, no execution |
| Exchange | `exchangeReferenceSnapshot` — indicative quotes only |
| MoonRey | `moonReyResourceContext` — commodity context, no issuance |
| Action Center | Backend events (`autoNotify: false`) |
| Search | In-memory filing/entity index |

## Tests

- `packages/external-data/src/wave2.test.ts` — e2e, failure isolation, cache, security, coverage
- `tests/wave-2-completion.test.ts` — BFF adapter
- `packages/provider-sdk/src/*.test.ts` — repaired Wave 1 suite (79 pass)
- `tests/free-api-catalog.test.ts` — partial catalog validation

## Known limitations

- Full 126-provider master list still not supplied; only Wave 2 partial catalog populated.
- All adapters use deterministic fixtures — no live HTTP to free APIs in CI.
- `exchangerate-host` and API-key providers require credential plane wiring for production.
- Financial statement XBRL mapping is intentionally conservative (no aggressive taxonomy merge).

## Wave 3 recommendation

Proceed with crypto / blockchain intelligence providers only after legal review of blocked market data sources and completion of the authoritative 126-provider master list import.
