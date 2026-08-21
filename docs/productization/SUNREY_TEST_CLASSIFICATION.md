# SunRey test classification

This is the productization test map. It does not invent a second test runner.
Canonical commands remain `npm test`, `npm run test:persistence`, `npm run test:sunrey-node`, and the CI workflow.

Critical financial-control tests are not optional for speed.

## Categories

| Category | What it protects | Typical location | Every PR? |
| --- | --- | --- | --- |
| UNIT | Domain types, money arithmetic, policy, isolation | `packages/*/src/*.test.ts` | Yes — `npm test` |
| INTEGRATION | Kernel → authority → ledger / service wiring | `packages/*/src/**/*.test.ts`, `services/accounts` | Yes — `npm test` |
| PERSISTENCE | Empty Postgres → migrations → repository behavior | `tests/persistence/`, `db/*/migrations` | Yes — dedicated `[DATABASE]` job |
| CONTRACT | OpenAPI / webhook / SDK vector specs | `api/`, `scripts/check-api-specs.mjs` | Yes — `[API]` |
| ARCHITECTURE | Authority map, freeze, Kernel / EA / agent boundaries | `tools/architectural-linter`, `docs/productization/` | Yes — `[ARCHITECTURE]` |
| SECURITY | Secrets, dependency audit, licenses, container pins | `scripts/secret-scan.py`, `scripts/sunrey-release.mjs audit` | Yes — `[SECURITY]` |
| CHAIN | Consensus, native assets, monetary constitution | `packages/sunrey-chain`, Rust crates | Yes — unit + `[RUST]` |
| EXCHANGE | Matching, DVP, consumer/institutional accounting | `packages/sunrey-exchange` | Yes — `npm test` + demos |
| AGENT | ProposalGate, isolation, no Execution Authority | `packages/agent`, `packages/sunrey-agent` | Yes — `npm test` |
| SIMULATION | Demo / fixture campaigns that prove simulation-only | `npm run demo:*` | Yes — main CI demo steps |
| REHEARSAL | Ceremony, launch, post-genesis, abort | `sunrey-ceremony`, `sunrey-launch`, RC smoke | Yes — smoke profiles on every PR |
| PRODUCTION-CONTROL | Production-off flags, activation firewall, freeze hashes | `scripts/check-production-safety.mjs`, engineering closure | Yes — `[PRODUCTION SAFETY]` |

## Separate from every PR when prohibitively expensive

These remain available and must not replace the PR-required financial controls:

| Suite | Command / workflow | Cadence |
| --- | --- | --- |
| Extended fuzz | `npm run test:fuzz-extended` / `fuzz-extended.yml` | Nightly / manual |
| Extended formal | `npm run test:formal-extended` / `formal-extended.yml` | Nightly / manual |
| Bench / soak | `sunrey-bench-nightly.yml` | Nightly / manual |
| Full-platform candidate | `sunrey-full-platform-candidate.yml` | Weekly / manual |
| Engineering closure burn-in | `sunrey-engineering-closure.yml` | Manual |
| Pregenesis / RC endurance | `sunrey-pregenesis-burn-in.yml`, `sunrey-rc-endurance.yml`, `sunrey-*-rc-extended.yml` | Manual / scheduled |

PR CI still runs fuzz smoke, formal smoke, RC smoke, and production-safety smoke.

## Financial-control tests that stay on every PR

These must not be moved to nightly solely for runtime:

- bigint / minor-unit money tests (`packages/money`)
- Ledger `postJournal` authority tests (`packages/ledger`)
- Kernel six-proof and gating tests (`packages/kernel`, `npm run gate`)
- Account open / movement Execution Authority tests (`services/accounts`, architectural linter)
- Exchange / custody / settlement integrity tests included by `npm test`
- Production-off posture and architecture freeze

## Local commands

```bash
npm test
npm run test:persistence    # requires local PostgreSQL
npm run test:sunrey-node    # requires Rust
npm run productization:preflight
```
