# Final Post-Merge Recovery — Prompt 1/4

## Summary

Post-merge stabilization repair for integration corruption introduced when stale feature branches (RC1 qualification #447, economic-state idempotency #444, package boundaries #443, EAF canonicalization #446) were merged into `main`. This pass restores structurally valid JSON baselines, cleans `runtime.ts` merge duplication, extends package-boundary enforcement to `services/` and `package.json` exports, and re-baselines grandfathered service deep-imports.

## SHAs

| | SHA |
|---|---|
| **Starting** | `12b583e61e086c671e8535e7e8209d64b5630c4a` |
| **Ending** | `9b70fc83` (HEC persistence round-trip + integration test fixes) |

## Files repaired

| File | Repair |
|---|---|
| `docs/productization/PHASE_C_PERFORMANCE_BASELINE.json` | Restored single canonical sample block from `b814c63f` (pre-corruption) |
| `docs/productization/PHASE_H_PERFORMANCE_BASELINE.json` | Restored single canonical sample array from `b814c63f` |
| `docs/productization/phase-g-performance-baseline.json` | Restored single canonical sample array from `b814c63f` |
| `services/api/src/product-integration/runtime.ts` | Removed unreachable mode resolution, duplicate `agentSnapshot`, duplicate persist calls |
| `services/accounts/src/product-durable-adapters.ts` | Static imports from `@solstice/persistence` public index |
| `deploy/sunrey-testnet/docker/sunrey-watcher.Dockerfile` | Added missing `HEALTHCHECK` (CI testnet manifest gate) |
| `scripts/lib/package_boundary.py` | Services scan, `package.json` export validation, absolute-path fix |
| `tools/architectural-linter/src/package-boundary-guards.ts` | Mirror: services scan + export validation |
| `tools/architectural-linter/src/package-boundary-guards.test.ts` | Tests H–I for declared/undeclared subpath exports |
| `services/api/src/product-integration/durable-human-economic-state.ts` | Serialize/deserialize `ClaimRegistry` for DB snapshot round-trip |
| `tests/persistence/human-economic-state-idempotency.test.ts` | Pool lifecycle + TEST 7 duplicate-fingerprint pattern |

## Merge corruptions found

1. **Performance baseline JSON** — duplicate benchmark blocks concatenated without commas (symptoms: missing separators, duplicate keys, triple `median_ms` / `elapsedMs` / `ns` fields).
2. **`runtime.ts`** — parallel durable-mode implementations left unreachable env-resolution code, duplicate `loadAgentRuntimeState` hydration, and double persist (wrapper + direct persistence).
3. **`sunrey-watcher.Dockerfile`** — missing `HEALTHCHECK` required by `scripts/sunrey-testnet-validate-manifests.mjs` (blocked full `scripts/ci.sh` tail).
4. **Package boundary baseline** — services layer was not scanned; 663 production service deep-imports were invisible to CI.

## Root cause

Concurrent merges landed overlapping durable-runtime, RC1 qualification, and architecture-enforcement work without re-validating JSON integrity or deduplicating integration paths. Git merge combined performance measurement objects instead of choosing one canonical result per field.

## Validation results

| Check | Before | Root cause | Repair | Final result |
|---|---|---|---|---|
| JSON integrity | **FAIL** — 3 malformed files | Concatenated merge artifacts in performance baselines | Restored last valid pre-corruption versions (`b814c63f`) | **PASS** — `integrity:check` green |
| `runtime.ts` | Duplicate persist/hydrate paths | Parallel durable branches merged | Single adapter path via `product-durable-adapters` | **PASS** — clean single implementation |
| Package boundaries | Packages only; alias=subpath treated as public | Incomplete scanner scope | Services scan + `exports` map validation | **PASS** — 5351 grandfathered, 0 new |
| Architecture linter | Same gaps as Python scanner | Missing TS mirror updates | Updated guards + tests H/I | **PASS** |
| `npm test` | Not reached on GitHub (JSON preflight) | JSON blocked CI | JSON + runtime fixes | **PASS** — 6180 pass, 0 fail, 1 skip |
| EAF regression | Canonical owner intact | N/A (verified) | No competing consensus in `packages/economic-awareness-fabric` | **PASS** — 17/17 package tests |
| Rust fmt/clippy/tests | Passed in local full CI run | N/A | Dockerfile fix unblocks tail | **PASS** (local `ci.sh` through Rust) |
| Testnet manifests | **FAIL** — watcher Dockerfile | Missing HEALTHCHECK | Added HEALTHCHECK line | **PASS** |
| OpenAPI / migrations | Passed in integrity stage | N/A | — | **PASS** |
| Persistence integration | **FAIL** on `a349f037` — ClaimRegistry JSON round-trip + pool lifecycle | Maps/Sets serialized as `{}`; tests closed pools mid-run | Serialize proof-bound claims; fix TEST 3/4/6/7 | **PENDING** — GitHub `[DATABASE]` job on `9b70fc83` |
| TypeScript typecheck | **FAIL** — ~1689 errors on `main` | Post-`d919aa69` merge type drift (not JSON/runtime) | Not fully repaired in this prompt | **FAIL** — `tsc` exit 2 |
| Full `scripts/ci.sh` | **FAIL** at JSON then Dockerfile | Above | Partial | **BLOCKED** at typecheck until TS errors addressed |
| Production flags | Simulation | N/A | Verified unchanged | **PASS** — `ENVIRONMENT=simulation`, `LIVE_*` false |

## Remaining warnings / blockers

### Blocker: TypeScript typecheck (~1689 errors)

- Last fully green CI on `main`: `d919aa69a8152d24631efc5eaa865830976472fe` (0 `tsc` errors).
- Current `main` after merges #443–#447: ~1689 errors (`tsc --noEmit` exit 2).
- GitHub CI has not reached the typecheck stage recently because JSON integrity failed first.
- **Do not merge** until typecheck is green or a follow-up stabilization pass repairs the type drift.

### Non-blocker

- Local persistence integration tests require Docker (`npm run db:up`); GitHub `[DATABASE]` job covers this.
- 5351 grandfathered package/service deep-imports remain (policy: detect new violations only).

## Human economic durable wiring (verified)

- `db/customer/migrations/V042__human_economic_contribution.sql` — present, unique constraints on replay/monetization/fingerprint keys.
- `services/api/src/product-integration/durable-human-economic-state.ts` — wired with `requireDurable: true` in durable mode.
- `services/accounts/src/human-economic-persistence.ts` — port bridge to persistence pg-store.
- `packages/persistence/src/human-economic-contribution/pg-store.ts` — DB-enforced idempotency reservations.
- `runtime.ts` — injects `DurableHumanEconomicStateService` in durable mode only; single persist path.

## EAF canonicalization (verified)

- `packages/economic-awareness-fabric/` — orchestration adapter; consensus implementation in `packages/sunrey-chain/src/economic-awareness-fabric/`.
- Public export `@solstice/sunrey-chain/economic-awareness-fabric` declared in `packages/sunrey-chain/package.json`.
- Canonical regression tests pass (independent sources, no duplicate confidence inflation, no direct issuance authorization).

## Production safety

Verified via `check-deployment-posture.py` and source inspection: `ENVIRONMENT=simulation`, all `LIVE_*` flags false, no production banking/custody/mainnet activation paths enabled.
