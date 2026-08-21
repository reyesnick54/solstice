# Phase A closure report

PHASE A does not mean SunRey is production ready.

PHASE A means the existing architecture is sufficiently stabilized, mapped,
frozen and protected to begin productionizing the platform.

This report closes all four Phase A prompts. It does not start Phase B.
No production activation occurred.

## PHASE A OBJECTIVE

Make the current SunRey backend a stable, mapped, frozen, and
CI-protected foundation for financial-platform productization — without
turning production on.

## REPOSITORY STATUS

`main` at the start of Prompt 4 still carried merge leftovers that the
integrity lock is designed to catch:

- duplicate `package.json` `test` keys (native-asset vs ceremony/mainnet globs)
- duplicate `notes` keys on `sunrey-production-handoff` in `docs/architecture/manifest.json`
- duplicate counts in `docs/architecture/integrity-baseline.json`

Prompt 4 repaired those so the integrity gate fails closed on the next
collision instead of silently keeping the last JSON key. The canonical
`test` script is now the union of both surfaces.

Canonical inventory remains:

- `docs/architecture/constitution.md`
- `docs/architecture/manifest.json`
- `docs/architecture/SUNREY_ENGINEERING_CLOSURE.md`
- `docs/build-status.md`

## CANONICAL ARCHITECTURE STATUS

Frozen for productization in:

- `docs/productization/sunrey-authority-map.json`
- `docs/productization/sunrey-architecture-freeze.json`

These encode the engineering-closure authority graph and the
non-negotiable roles:

| Authority | Role | Owner |
| --- | --- | --- |
| Ledger | authoritative financial journal | `packages/ledger` |
| Kernel | policy/regulatory control | `packages/kernel` |
| Execution Authority | regulated execution boundary | `packages/permissions` |
| AI / Agent | analysis/proposal only | `packages/ai-runtime`, `packages/sunrey-agent`, `packages/agent` |
| Frontend | client of controlled APIs | `apps/explorer` |
| SunRey Chain | native blockchain authority | `packages/sunrey-chain` |
| SUNREY_COIN / MOONREY_COIN | proprietary native assets | `packages/sunrey-chain` AssetSupplyBook |
| Providers | adapters behind domain interfaces | payments / custody / identity candidates |
| Production | disabled | flags + launch process |

Duplicate architectures remain identified as forbidden packages
(`packages/ledger-v2`, `packages/moonrey-coin`, `packages/sunrey-core`,
and the engineering-closure super-package list). They must not appear.

## CI STATUS

`.github/workflows/ci.yml` keeps the existing strong sequential pipeline
and adds named groups plus isolated jobs:

- `[INTEGRITY]`
- `[ARCHITECTURE]`
- `[TYPECHECK]`
- `[RUST]`
- `[TEST]`
- `[DATABASE]`
- `[API]`
- `[SECURITY]`
- `[GENERATED DRIFT]`
- `[PRODUCTION SAFETY]`

Preserved: JSON/merge integrity, architectural invariants, deployment
posture, Kernel gating, Rust, dependency audit, license inventory, SBOM,
provenance, reproducible builds, artifact signing, security-review
bundle, generated drift, static analysis, full tests, fuzz/formal smoke,
persistence/PostgreSQL.

Local preflight: `npm run productization:preflight`.

## KNOWN SIMULATION-ONLY COMPONENTS

Almost every customer, payments, Exchange, custody, Chain, oracle, and
AI surface is `IMPLEMENTED_SIMULATION_ONLY`. `ENVIRONMENT=simulation`.
`LIVE_*` flags are compiled false. Provider candidates use injected or
fixture transports only.

## KNOWN PROVIDER PLACEHOLDERS

Fixture / production-candidate adapters only:

- banking / payment-rail / FX (`packages/payments/src/production-candidate`)
- regulated KYC / AML / Travel Rule / surveillance candidates (Chunk 152)
- custody provider-candidate framework (Chunk 153)
- oracle external-provider candidates (Chunk 150)
- credential plane handles, not raw production secrets (Chunk 149)

None of these are live bank, rail, FX, KYC, or HSM integrations.

## P0 PRODUCTIZATION BLOCKERS

Engineering work that Phase B must confront before a production-shaped
backend exists. These are not permission to activate production.

1. No production API / BFF architecture — current `api/` specs are
   public/developer contracts, not a complete controlled backend surface.
2. Frontend is an explorer client, not a balance-authoritative app, and
   has no production BFF.
3. Provider adapters are sandbox/fixture candidates; named-network
   membership and live connectivity are absent by design.
4. OpenAPI documents are mostly path/summary contracts; production
   request/response schemas are incomplete.
5. Account and money-movement human-review path under
   `services/accounts` is still the application facade, not a shipped
   production serving stack.

## P1 PRODUCTIZATION BLOCKERS

1. Historical Solstice naming aliases remain compatibility debt.
2. Some non-PR workflows still use floating `actions/checkout@v4`
   (`fuzz-extended.yml`, `sunrey-bench-nightly.yml`).
3. Chain OpenAPI operation IDs are derived from method+path until Phase B
   assigns explicit IDs.
4. Persistence integration still depends on CI/local PostgreSQL rather
   than an always-on developer database.
5. MoonRey public-product placeholder capability remains SUPERSEDED and
   must not be reintroduced as a package.

## EXTERNAL PRODUCTION BLOCKERS

Unchanged from engineering closure. All `present=false`:

- production economic parameter selections
- real human governance signatures
- external security audit and pentest
- counsel opinions, licenses, regulatory approvals
- bank / BaaS, payment-rail, FX, KYC/AML, Travel Rule agreements
- custody provider, oracle/data licenses, HSM/KMS evidence
- real validator operators, infrastructure, DNS/certs, staffing, on-call

Human decisions (tickers, supply, conversion, activation) remain
`unresolved=true` and `aiMayDecide=false`.

## CURRENT PRODUCTION FLAGS

```
CORE_CODE_COMPLETE_CANDIDATE=true
PRODUCTION_READY=false
PRODUCTION_ACTIVE=false
LIVE_CONNECTIVITY_ENABLED=false
production_authorized=false
```

`CORE_CODE_COMPLETE_CANDIDATE` is an engineering label only.

## RECOMMENDATION FOR PHASE B

`READY_FOR_PHASE_B=true`

Phase B should build the production API/BFF architecture on top of the
frozen authorities. It must not create a second ledger, Kernel,
Execution Authority, or mint, and it must not flip production flags.

## Prompt map

| Prompt | Outcome |
| --- | --- |
| 1 Stabilize merge | Integrity lock remains; leftover duplicate keys repaired on this branch |
| 2 Canonical inventory | Constitution, manifest, engineering closure, build-status |
| 3 Architecture freeze + authority map | `docs/productization/sunrey-authority-map.json` and freeze guardrails |
| 4 Production-grade CI | Named quality-gate groups, production-safety, API, migrations, preflight |
