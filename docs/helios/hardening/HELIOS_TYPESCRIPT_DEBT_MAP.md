# HELIOS TypeScript debt map (HEALTH02)

**Objective:** Zero strict TypeScript diagnostics in the HELIOS investment/research scope without raising `scripts/typecheck-baseline.json` or using suppressions.

**Qualification marker:** `HELIOS_STRICT_TYPECHECK_QUALIFIED` (`packages/platform/src/helios/hardening/qualification.ts`)

**Verification:** `node --experimental-strip-types scripts/helios-health02-typecheck-qualify.ts`  
**Project:** `tsconfig.helios-strict.json`

## Scope paths

| Path | Role |
| --- | --- |
| `packages/platform/src/helios/` | HELIOS platform core (AAF, feature fabric, release, research) |
| `packages/strategy-lab/` | Strategy Lab |
| `packages/agentic-capital-mesh/` | Agentic capital / research mesh |
| `packages/external-data/` | External data plane (Wave 4–7, earnings, venue adapters) |
| `packages/provider-sdk/` | Provider SDK, trust engine, connectors |
| `packages/ai-runtime/` | AI runtime (S3M / Grok serving for HELIOS) |

## Initial inventory (pre-HEALTH02)

Captured via `tsc -p tsconfig.helios-strict.json` with strict flags from root `tsconfig.json` (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, etc.).

| Package (scoped) | Initial errors | Dominant codes |
| --- | ---: | --- |
| `provider-sdk` | 111 | TS2300, TS2322, TS2379, TS2459 |
| `external-data` | 82 | TS2322, TS2308, TS2345, TS2379 |
| `ai-runtime` | 13 | TS2322, TS1354, TS2339 |
| `agentic-capital-mesh` | 2 | TS2308, TS2379 |
| `platform/helios` | 2 | TS2322 |
| **Total scoped** | **210** | |

### Root causes (grouped)

1. **Public type / export conflicts (TS2300, TS2308)** — Duplicate HTTP transport aliases in `provider-sdk` (`http-transport-types.ts`, `types.ts`, barrel `index.ts`); barrel `export *` collisions in `external-data/index.ts` (fixtures, `ProviderRiskMonitor`, `AuthorityClass`, `ExternalDataObservation`).
2. **`exactOptionalPropertyTypes` (TS2379, TS2375)** — Optional props passed as `T | undefined` across certification, connectors, trust services, access-live HTTP clients.
3. **Trust engine generics (TS2322, TS2459)** — `CanonicalTrustResult<T>` variance; missing export of `TrustReason`; observation vs canonical type parameters.
4. **Connector fetch generics (TS2322)** — `ConnectorFetchResult` without type parameter on failure paths in `rest-connector.ts`.
5. **Provenance event typing (TS2345 / `never`)** — `createEconomicProvenanceEvent` payload map too narrow in `provider-sdk`; fixed at source so Wave 4 fabric records type-check.
6. **Wave 6 adapter surface (TS7006, TS2307)** — Implicit `any` in adapter index; incorrect relative imports in world integration.
7. **AAF / EARN integration** — AAF08 optional `EvidenceVault`; AAFV2.3 manifest failure type alignment; earnings mesh optional specialist flags.
8. **AI certification fixtures** — Invalid `readonly` on `Record` context; branded `ModelId` in harness tests; incomplete `AiContextObject` in safety tests.
9. **Stale simulation interfaces** — `ObservationSource.displayName` assumed in product data state; macro routing `observedAt` vs canonical observation time fields.

## Resolution summary

| Area | Fix strategy |
| --- | --- |
| Provider SDK transport | Single canonical `ProviderHttp*` surface; removed conflicting deprecated aliases; split barrel exports |
| Provider SDK trust | Generic `#emptyResult` / `#buildResult`; export `TrustReason`; dual type params for observation vs canonical value |
| External data barrels | Explicit re-exports; `Wave5ProviderRiskMonitor` alias; wave4 fixture prefix `WAVE4_*`; shared `loadCatalogProviders` |
| Product authority | `ProductAuthorityClass` vs Wave 6 `AuthorityClass` |
| Platform HELIOS | Conditional optional vault assignment; manifest `Aafv203CompilerFailure` mapping |
| AI runtime | Fixture context typing; canonical Grok model refs from registry |

**Post-HEALTH02 scoped error count:** **0**

## Non-HELIOS legacy debt (same compile graph)

Strict check of `tsconfig.helios-strict.json` still pulls transitive dependencies outside the scope above. Those diagnostics are **not** HEALTH02 blockers but remain repository legacy debt (do not modify `scripts/typecheck-baseline.json` in this program).

Approximate count from the HELIOS strict project graph after HEALTH02: **39** errors, concentrated in:

- `packages/sunrey-chain/` (catalog entries, protocol codec, validators)
- `packages/agent/` (access intent / access fabric)
- `packages/config/` (`activation-gates.ts`)
- `packages/security/` (ZK / blockchain key provider)
- `packages/sunrey-exchange/` (native clearing, crypto HTTP client)
- `packages/platform/src/grow/` (non-helios grow lifecycle)

Full repository `tsc -p tsconfig.json` (with `NODE_OPTIONS=--max-old-space-size=12288`) reported **1444** TypeScript diagnostics after HEALTH02 — below the CI baseline cap (`scripts/typecheck-baseline.json` `maxErrors: 1666`) and unchanged by this program.

## Policy

- No `@ts-ignore`, `@ts-nocheck`, eslint/ts suppression comments, or silencing casts.
- No runtime behavior changes solely to satisfy the compiler.
- Do not increase `scripts/typecheck-baseline.json` `maxErrors`.
