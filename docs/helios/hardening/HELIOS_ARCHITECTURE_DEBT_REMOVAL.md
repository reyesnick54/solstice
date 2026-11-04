# HELIOS HEALTH03 — architecture debt removal

Package-boundary and type-safety cleanup for HELIOS assimilation paths (AAF, OSS/native, earnings).

## Scope

| Audit root | Role |
| --- | --- |
| `packages/platform/src/helios/` | HELIOS core runtime |
| `packages/strategy-lab/` | Strategy Lab / genome evaluation |
| `packages/agentic-capital-mesh/` | Agentic research mesh |
| `packages/external-data/` | External reference data plane |
| `packages/provider-sdk/` | Provider SDK and trust |

## Metrics

| Metric | Before | After |
| --- | ---: | ---: |
| Package-boundary violations (audit scope, grandfathered) | 671 | 0 |
| `@ts-nocheck` (HELIOS AAF08/AAF09 + external paths) | 5 | 0 |
| `@ts-ignore` (audit packages) | 0 | 0 |
| Deep cross-package `*/src/*` imports (audit scope) | 660 | 0 |

Repository-wide grandfathered boundary count decreased by **671** (baseline regenerated); **0 new** violations vs baseline.

## Remediation pattern

1. **Canonical owner** — keep contracts on the owning package; do not add parallel packages.
2. **Public surface** — consume `@solstice/<package>` or an explicit `package.json` `exports` subpath only.
3. **Migrate imports** — replaced relative deep paths with public APIs (`scripts/helios-health03-migrate-imports.py`).
4. **Shrink baseline** — removed matching entries from `docs/architecture/package-boundary-baseline.json`.

### New or extended export surfaces

- `@solstice/platform` — `./helios/aaf08-external-equities`, `./helios/market-observation`, `./helios/feature-coverage`, `./helios/strategy-lab-bridge`
- `@solstice/sunrey-exchange` — `./capital-market`, `./crypto-market/catalog-entries`, `./crypto-market/coingecko-adapter`
- `@solstice/sunrey-chain` — health/productive-economy, provider-runtime, catalog-entry subpaths
- `@solstice/payments` — `./fx-reference/catalog-entries`
- `@solstice/investments` — exports `quantityScaleFactor` on the root barrel

### Relocation (boundary fix)

- `createAaf08CapitalMarketProviderPort` moved from `packages/external-data/src/helios/` to `packages/platform/src/helios/adaptive-alpha-fabric/aaf08-external-equities/exchange-capital-market-port.ts` (Exchange→HELIOS port binding belongs on platform).

### Type safety (AAF08/AAF09)

Removed `@ts-nocheck` and aligned observation/trust envelopes with `@solstice/provider-sdk` (`buildExternalObservation`, market trust payloads, entitlement class `provider_feed_real_time`).

## Qualification

Runtime marker: `HELIOS_ARCHITECTURE_CLEAN_QUALIFIED` (`packages/platform/src/helios/hardening/architecture-clean-qualification.ts`).

All audit gates at zero violations and zero suppressions qualify.

## Verification

```bash
python3 scripts/check-package-boundaries.py
node --experimental-strip-types --disable-warning=ExperimentalWarning --test tests/helios-aaf08-external-equities-observation.test.ts
```
