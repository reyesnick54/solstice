# SunRey CI quality gate

Phase A production-grade engineering quality gate.
This does **not** activate production.

A change is not mergeable if it breaks repository integrity, architecture
authority boundaries, TypeScript, Rust, tests, financial invariants,
database migrations, API schemas, security scanning, build reproducibility,
or generated artifacts.

## 1. Required check groups

GitHub Actions step and job names are prefixed so a failing job identifies
the group without reading unrelated logs:

| Group | Job / step prefix | Protects |
| --- | --- | --- |
| REPOSITORY INTEGRITY | `[INTEGRITY]` | Strict JSON, YAML, merge markers, lockfiles, duplicate keys |
| ARCHITECTURE | `[ARCHITECTURE]` | Authority map, freeze, Kernel, Execution Authority, agent privilege |
| TYPESCRIPT | `[TYPECHECK]` | Install, `tsc --noEmit`, static security lint |
| RUST | `[RUST]` | `fmt`, `clippy -D warnings`, crate tests |
| DATABASE | `[DATABASE]` | Migration order + empty Postgres apply + persistence tests |
| API CONTRACTS | `[API]` | OpenAPI parse, refs, unique operation IDs, versioned metadata |
| FINANCIAL INVARIANTS | `[TEST]` | Covered by `npm test` (ledger, money, Kernel, Exchange) |
| SECURITY | `[SECURITY]` | Secret scan, dependency audit, licenses, SBOM, pins |
| SUPPLY CHAIN | `[SECURITY]` | SBOM, provenance, two-builder reproducibility, sign/verify |
| GENERATED DRIFT | `[GENERATED DRIFT]` | Stale generated manifests/specs |
| PRODUCTION SAFETY | `[PRODUCTION SAFETY]` | Production-off default posture |

Main workflow: `.github/workflows/ci.yml`.
Local full pipeline: `npm run ci` / `scripts/ci.sh`.
Local pre-PR subset: `npm run productization:preflight`.

Existing scheduled / manual workflows are preserved:

- `sunrey-release.yml` — signed testnet bundle
- `sunrey-audit.yml` — independent security-review bundle
- `sunrey-engineering-closure.yml` — closure burn-in
- `sunrey-full-platform-candidate.yml` — weekly/manual full-platform
- `fuzz-extended.yml`, `formal-extended.yml` — expensive campaigns
- `sunrey-bench-nightly.yml`, RC/pregenesis endurance workflows

## 2. What each check protects

### Integrity

- `scripts/check-json-integrity.mjs` — strict parse, duplicate keys, architecture IDs
- `scripts/check-merge-integrity.mjs` — merge markers, single `test` script, baseline counts
- `scripts/check-yaml-integrity.mjs` — workflow/API YAML sanity
- `scripts/check-lockfiles.mjs` — npm + Cargo lockfiles and action pins

### Architecture

- Python invariant linter + extraction dry-run
- `npm run lint:architecture` including productization freeze guards
- `scripts/check-authority-map.mjs` — `docs/productization/sunrey-authority-map.json`
- `scripts/check-architecture-freeze.mjs` — forbidden packages, agent privilege, no alternate ledger
- `npm run gate` — Kernel authorization of mutators

### Production safety

Default repository posture must remain:

```
PRODUCTION_READY=false
PRODUCTION_ACTIVE=false
LIVE_CONNECTIVITY_ENABLED=false
production_authorized=false
```

Enforced by `scripts/check-production-safety.mjs` and
`scripts/check-deployment-posture.py`. An authorized launch process may
change these later. An ordinary feature PR must not.

### TypeScript / Rust / tests

Unchanged strong controls: `npm ci --ignore-scripts`, `npm run typecheck`,
Rust 1.83/1.88 fmt/clippy/test, `npm test`, fuzz/formal smoke, demo matrix.

### Database

`scripts/check-migration-quality.mjs` proves `V001` start and increasing
versions. The `[DATABASE]` job starts empty PostgreSQL 16, applies every
migration, then runs `npm run test:persistence`. No production credentials.

### API

`scripts/check-api-specs.mjs` validates `api/*.yaml` and `api/*.json`:
OpenAPI 3.x, versioned metadata, unique operation identities, resolved
`$ref`s, and no real secrets in examples.

### Security / supply chain / generated drift

Preserved: secret scan, `sunrey-release.mjs audit/sbom/provenance/compare-builds/sign/verify`,
`sunrey-audit.mjs`, `check-generated-drift.mjs`, `check-container-pins.mjs`.

## 3. Local equivalent commands

| CI group | Local command |
| --- | --- |
| Integrity | `npm run integrity:check` |
| Architecture | `npm run lint:architecture && npm run check:authority-map && npm run check:architecture-freeze && npm run gate` |
| Production safety | `npm run check:posture && npm run check:production-safety` |
| TypeScript | `npm run typecheck` |
| Tests | `npm test` |
| Rust | `npm run test:sunrey-node` or `cd packages/sunrey-chain/rust && cargo fmt --check && cargo clippy --all-targets --locked -- -D warnings && cargo test --workspace --locked` |
| API | `npm run check:api` |
| Migrations | `npm run check:migrations` |
| Persistence | `npm run db:migrate && npm run test:persistence` |
| Secrets | `npm run scan:secrets` |
| Generated drift | `npm run supply-chain:generated` |
| Pre-PR subset | `npm run productization:preflight` |
| Full local CI | `npm run ci` |

## 4. PR expectations

A PR must keep:

1. Exactly one `package.json` `test` script covering required families
2. Architecture freeze and authority map valid
3. Production flags off
4. Typecheck and `npm test` green
5. Rust fmt/clippy/test green when chain/Rust files change (CI always runs them)
6. API specs valid
7. Migrations apply from empty Postgres
8. No secret or generated-artifact drift

Do not skip, reorder, or weaken the seven historical CI stages. This gate
adds named groups around them.

## 5. Production-safety checks

The gate fails if a default assignment of `PRODUCTION_READY`,
`PRODUCTION_ACTIVE`, `LIVE_CONNECTIVITY_ENABLED`, or
`production_authorized` becomes true. It also fails if those assignments
disappear. `ENVIRONMENT` stays `simulation`. `LIVE_*` stay false.

## 6. Migration testing

```
EMPTY DATABASE → ALL MIGRATIONS → CURRENT SCHEMA → PERSISTENCE TESTS
```

Local PostgreSQL is optional for preflight. CI always starts a clean
`postgres:16` service. Dev password is the documented simulation secret
`solstice_dev_only_not_for_production`.

## 7. API validation

Specs under `api/` must parse, carry version metadata, expose unique
operation identities (explicit `operationId` or derived `method_path`),
resolve `$ref`s, and contain no live credentials.

## 8. Architecture freeze validation

CI validates:

- `docs/productization/sunrey-authority-map.json`
- `docs/productization/sunrey-architecture-freeze.json`

Failing conditions include malformed maps, duplicate canonical
authorities, prohibited deprecated packages, Agent access to
`AuthorityIssuer` / `postJournal`, an alternate ledger package, and
production flags flipped on.

## 9. Security controls

Preserved and still required on every PR: secret scan, dependency audit,
license inventory, SBOM, provenance, reproducible builds, artifact
signing/verification, security-review bundle, container digest pins.

## 10. Failure remediation

| Prefix | What to do |
| --- | --- |
| `[INTEGRITY]` | Repair JSON/YAML; do not keep a second `test` key; remove merge markers |
| `[ARCHITECTURE]` | Restore the frozen owner; do not add a second ledger/Kernel/EA |
| `[PRODUCTION SAFETY]` | Revert production/live flag changes; launch is a separate process |
| `[TYPECHECK]` | Fix TypeScript; run `npm run typecheck` |
| `[RUST]` | `cargo fmt`, fix clippy, run crate tests |
| `[TEST]` | Fix the named suite; financial tests are not skippable |
| `[DATABASE]` | Fix `VNNN__name.sql` order or persistence adapter |
| `[API]` | Fix the spec under `api/`; do not invent a second public API |
| `[SECURITY]` | Remove secrets, restore pins, rerun audit/SBOM |
| `[GENERATED DRIFT]` | Regenerate and commit the required artifact |

PHASE A does not mean SunRey is production ready.
PHASE A means the architecture is stabilized, mapped, frozen, and protected.
