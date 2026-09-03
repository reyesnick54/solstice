# SunRey Full Sandbox / Simulation Release Candidate 1

| Field | Value |
| --- | --- |
| **Release candidate name** | `SUNREY SIMULATION RC1` |
| **Package identifier** | `sunrey-backend-v1.0.0-rc.2` |
| **Qualification branch** | `release/simulation-rc1-qualification` |
| **Qualification commit** | `a8235fc92d9b2ad75d59ec919f9b48ab40b5c9ee` |
| **Base commit (pre-qualification fixes)** | `8f20c3fcd5c7928c7e9841454eace9d0cebd870a` |
| **Qualification date** | 2026-09-03 (UTC) |
| **Intended environment** | Fully functional **simulation / sandbox** for `https://app.sunrey.xyz` (Consumer BFF at `/api/v1/*`) |
| **Not** | Live regulated financial production, mainnet, or production authorization |

---

## 1. Architecture summary

SunRey backend is a simulation-only digital banking and dual-economy platform:

- **Compliance Kernel** (`packages/kernel`) — six proofs, monotonic combine; HOLD/BLOCK/DEFER/REQUIRE_MANUAL_REVIEW post nothing.
- **Execution Authority** (`packages/permissions`) — signed, short-lived, scoped; required for ledger mutations.
- **Evidence Vault** (`packages/evidence`) — hash-chained audit of every Kernel outcome.
- **Ledger** (`packages/ledger`) — append-only journals; balances are read projections.
- **Consumer BFF** (`services/api`, port **8443** preview) — canonical Lovable / `app.sunrey.xyz` surface at `/api/v1/*`.
- **Platform API** (`services/api`, port **8080**) — minimal ops/readiness surface; **not** the full consumer route catalog.
- **PostgreSQL** — bounded domains: `solstice_customer`, `solstice_ledger`, `solstice_evidence`, `solstice_security` (customer **V041**, ledger **V010**).

`ENVIRONMENT=simulation`. All `LIVE_*` flags are **false**. `PRODUCTION_READY=false`, `PRODUCTION_ACTIVE=false`.

---

## 2. Services

| Service | Path | Role |
| --- | --- | --- |
| Consumer BFF / preview API | `services/api` (`start:preview`) | Full `/api/v1/*` for frontend |
| Platform API | `services/api` (`start`) | Health, version, minimal `/api/v1` |
| Accounts | `services/accounts` | Kernel-gated money movement |
| Identity | `services/identity` | Sessions, capabilities, KYC metadata |
| Economic graph | `services/economic-graph` | PEG facade |

---

## 3. Database

| Item | Detail |
| --- | --- |
| Engine | PostgreSQL 16 |
| Bootstrap | `npm run db:bootstrap` |
| Migrations | `npm run db:migrate` (versioned SQL under `db/`) |
| Qualification | `npm run qualify:backend-db` — empty DB → latest, prior-schema upgrade, restart invariants, migration failure rollback |
| Integration tests | `SUNREY_PERSISTENCE_TEST=1 npm run test:persistence` — **38 passed** |

---

## 4. APIs

| Spec | Purpose |
| --- | --- |
| `api/sunrey-consumer-bff-v1.openapi.yaml` | Primary frontend contract (`/api/v1/*`) |
| `api/sunrey-consumer-platform-v1.openapi.yaml` | Alternate `/v1/consumer/*` (Phase B/C money) |
| `api/sunrey-exchange-v1.openapi.yaml` | Exchange consumer surface |
| `api/sunrey-chain-v1.openapi.yaml` | Chain / native asset reads |
| `api/sunrey-developer-platform-v1.openapi.yaml` | Developer platform |

**Health:** `GET /health`, `GET /ready` on Consumer BFF.

---

## 5. Frontend integration matrix (concise)

| Frontend feature | API endpoint | Method | Auth | Sandbox/Real | Status |
| --- | --- | --- | --- | --- | --- |
| Login / session | `/api/v1/auth/preview/session` | POST | preview credentials | Sandbox | READY |
| Home | `/api/v1/me/home` | GET | Bearer | Simulation | READY |
| Money / accounts | `/api/v1/accounts` | GET | Bearer | Simulation | READY |
| Send / payments | `/api/v1/payments` | POST | Bearer + step-up | Simulated rails | READY |
| FX | `/api/v1/fx/quotes` | POST | Bearer | Simulated rates | READY |
| Cards | `/api/v1/cards` | GET/POST | Bearer | Simulated issuer | READY |
| Grow My Money | `/api/v1/grow/*` | GET/POST | Bearer | Simulation | READY |
| Agent / Action Center | `/api/v1/agent/*`, `/api/v1/actions` | GET/POST | Bearer | Proposal only | READY |
| Exchange | `/api/v1/exchange/*` | GET/POST | Bearer | **Simulated execution**; market data sandbox | READY |
| Wallets | `/api/v1/wallets/*` | GET/POST | Bearer | Simulation custody | READY |
| SunRey Coin | `/api/v1/sunrey/*`, `/api/v1/economy` | GET | Bearer | Read-only supply | READY |
| MoonRey Coin | `/api/v1/moonrey/*` | GET | Bearer | Productive simulation | READY |
| Vault | `/api/v1/data/vault/*` | GET/POST | Bearer | PDV simulation | READY |
| HIN | `/api/v1/hin/*` | GET/POST | Bearer | Rights marketplace sim | READY |
| Profile | `/api/v1/me` | GET/PATCH | Bearer | Simulation | READY |

Full mapping: `docs/productization/SUNREY_LOVABLE_BFF_MAPPING.md`, `docs/productization/SUNREY_LOVABLE_SCREEN_READINESS.md`.

**CORS:** set `SUNREY_API_ALLOWED_ORIGINS` to include `https://app.sunrey.xyz` exactly.

---

## 6. Sandbox functionality (verified)

| Area | Evidence |
| --- | --- |
| Fresh install | `npm ci` |
| DB from zero | `db:bootstrap` + `db:migrate` |
| Backend startup | `npm --workspace services/api run start:preview` — `/health` returns `productionReady: false` |
| Identity / auth | Preview session + `sandbox.<persona>` tokens; unauthenticated `/api/v1/me/home` → **401** |
| User isolation | Wave 9 security tests; cross-user denial on exchange, vault, action center |
| Wallets | `consumer-wallets.test.ts`, phase-g exchange e2e |
| SunRey / MoonRey | Wave 8 consumer e2e, economy BFF tests |
| Exchange | Simulated order lifecycle; `liveExchangeEnabled: false` on health |
| Vault / PDV | Phase H SDK e2e, persistence PDV tests |
| EAF / consensus | `wave-4-economic-awareness-fabric.test.ts`, `wave-4-information-consensus.test.ts` |
| HEC / PEVE | `wave6-peve-human-economic-valuation.test.ts` |
| Grow / agent | Phase E/F grow and conversation e2e |
| Compliance simulation | Chunk 69 regulated e2e, kernel compliance adapters |
| Persistence / restart | `qualify:backend-db`, `test:persistence` |
| Idempotency | Phase C/D crash-retry, persistence idempotency tests |

---

## 7. Real-data functionality

| Integration | Class | Notes |
| --- | --- | --- |
| PostgreSQL (local) | **A** internal real implementation | Dev/sim credentials only |
| SunRey Identity sessions | **A** | In-process / PG-backed |
| Ledger / Kernel / Evidence | **A** | Canonical simulation stack |
| External market data (Wave 7) | **B** sandbox third-party | Fixture/catalog providers; not live trading |
| World external data providers | **B/C** | Catalog of 102 providers; population incomplete; no live money |

---

## 8. Simulated functionality

- All fiat payments, FX, cards, withdrawals, ACH/wires
- Exchange matching and settlement (FILLED ≠ live settlement)
- Custody deposits / withdrawals / Travel Rule
- Grow / investment proposals (human approval required; no agent execution)
- KYC / AML / sanctions (simulation adapters)
- SunRey / MoonRey supply and productive oracles
- HIN rights marketplace and contribution valuation (engineering simulation)
- Agent conversations and Action Cards (text is not authorization)

---

## 9. Disabled production functionality

All `LIVE_*` flags **false** (`packages/config/src/flags.ts`):

`LIVE_MONEY_ENABLED`, `LIVE_PAYMENTS_ENABLED`, `LIVE_BANKING_RAILS`, `LIVE_EXTERNAL_KYC`, `LIVE_EXTERNAL_BANK_CONNECTION`, `REAL_MONEY_ENABLED`, `LIVE_TRADING_ENABLED`, `LIVE_CRYPTO_ENABLED`, `LIVE_EXCHANGE_ENABLED`, `LIVE_INVESTMENT_EXECUTION`, `LIVE_CUSTODY_ENABLED`, `LIVE_AGENT_FINANCIAL_EXECUTION_ENABLED`, `LIVE_CONNECTIVITY_ENABLED`, `LIVE_MOONREY_PRODUCTIVE_ISSUANCE_ENABLED`, `PRODUCTION_HSM_KMS_CONFIGURED`, and related flags.

`PRODUCTION_READY=false`, `MAINNET_ACTIVE=false`. Production economic activation firewall remains **inactive**.

---

## 10. Test suites executed

| Suite | Result |
| --- | --- |
| `npm ci` | Pass |
| `npm run qualify:backend-rc` | Pass |
| `npm run qualify:backend-db` | Pass |
| `SUNREY_PERSISTENCE_TEST=1 npm run test:persistence` | 38/38 pass |
| Workflow e2e (phase B/C/E/G/H, wave 4/6/8/9) | Pass |
| `npm test` (full repository) | Pass after qualification fixes |
| `npm run demo` | Pass |
| `npm run lint:architecture` | Pass |
| `python3 scripts/check-deployment-posture.py` | Pass |
| `node scripts/check-production-safety.mjs` | Pass |
| Security smoke (manual) | 401 unauthenticated; sandbox token 200; preview auth issues session |
| `cargo fmt` (rust workspace) | Fixed during qualification |

---

## 11. CI status

Qualification repaired **pre-existing CI blockers** on `main`:

1. Corrupted JSON performance baselines (merge artifacts)
2. Architectural boundary: `services/api` → `packages/persistence` import
3. Missing `export {` in `packages/human-economic-contribution/src/index.ts`
4. Prometheus alert catalog drift (`VALIDATOR_DOWN`, `CONSENSUS_STALLED`, …)
5. Rust `cargo fmt` drift in `wave9_adversarial.rs`
6. Consumer BFF authorization scope (global route auth + HIN path policy)

After fixes: architectural linter, RC qualification, persistence, and full `npm test` pass in the qualification environment.

**Note:** Full `npm run ci` (including Rust clippy/test, supply-chain stages, and full demo matrix) should be re-run in CI on the qualification PR. Typecheck reports errors in some `tests/wave5-*.test.ts` files (pre-existing strict typing drift).

---

## 12. Security checks

| Check | Result |
| --- | --- |
| Secret scan | Run; fixture/env.example patterns flagged as expected |
| Unauthenticated protected routes | 401 |
| Cross-user access | Denied (403/404) in security e2e |
| Preview auth disabled by default | Verified |
| CORS | Rejects unknown origins when configured |
| Agent cannot self-approve / execute | Structural + tests |
| No production flags on `/health` | `productionActive: false`, `liveConnectivityEnabled: false` |

This is **not** an independent security audit.

---

## 13. Known limitations

- Preview authentication is **simulation-only**; production OAuth/OIDC not wired.
- Mixed-currency wealth without conversion: `MIXED_CURRENCY_WITHOUT_CONVERSION`.
- `SETTLEMENT_TIME_PROMISE` null for sandbox rails.
- Platform API (`api.sunrey.xyz:8080`) exposes only a **subset** of routes; frontend must use Consumer BFF host.
- Dual API paths (`/api/v1/*` vs `/v1/consumer/*`) — frontend must pick one SDK surface.
- External provider catalog population incomplete (102/126).
- `BACKEND_RC_READY_PENDING_EXTERNAL_GATES` — regulatory, counsel, and live provider gates remain open.
- Long-running CI soak / DR campaigns not re-run in this qualification VM.

---

## 14. External dependencies

- Node.js ≥ 22
- PostgreSQL 16 (or Docker Compose `infra/postgres/docker-compose.yml`)
- Rust toolchain (for `packages/sunrey-chain/rust` CI stages)
- Reverse proxy / TLS for `app.sunrey.xyz` (not bundled)

---

## 15. Regulatory dependencies

- ADR legal confidence remains engineering simulation for money movement.
- No corridor marked `CONFIRMED_BY_COUNSEL`.
- KYC/AML/sanctions are **simulated** — not regulatory approval.
- Exchange, custody, and investment live rails require external provider and license gates.

---

## 16. Production blockers

- All `LIVE_*` flags must remain false until governed activation.
- External security review, regulatory review, live banking/payment/FX/card/custody providers.
- `PRODUCTION_READY`, `MAINNET_ACTIVE`, production HSM/KMS.
- Mainnet and exchange production gates (`docs/productization/sunrey-mainnet-readiness-gate.json`).

---

## 17. Deployment instructions

### From clean checkout

```bash
git clone <repo> && cd solstice
git checkout release/simulation-rc1-qualification
npm ci
npm run db:up          # requires Docker, or native PostgreSQL 16
npm run db:bootstrap
npm run db:migrate
```

### Consumer BFF (frontend backend)

```bash
export ENVIRONMENT=simulation
export SUNREY_PREVIEW_SANDBOX_PERSONAS=true
export SUNREY_PREVIEW_AUTH_ENABLED=true
export SUNREY_PREVIEW_AUTH_EMAIL=preview@sunrey.xyz
export SUNREY_PREVIEW_AUTH_PASSWORD=<secret-min-12-chars>
export SUNREY_API_ALLOWED_ORIGINS=https://app.sunrey.xyz
npm --workspace services/api run start:preview
```

See `deploy/sunrey-preproduction/README.md` and `infra/sandbox/env.example`.

### Verify

```bash
curl -s http://127.0.0.1:8443/health
curl -s http://127.0.0.1:8443/ready
```

---

## 18. Rollback instructions

1. Stop the Consumer BFF / Platform API processes.
2. Revert to the previous container image or git tag.
3. If schema changed, restore PostgreSQL from last known-good backup (bounded domains).
4. Re-run `npm run db:migrate` only forward — do not edit applied migrations.
5. Confirm `/health` shows `productionActive: false` before re-admitting traffic.

---

## 19. Required environment variables (names only)

`ENVIRONMENT`, `SUNREY_DEPLOYMENT_TIER`, `SUNREY_INTERNAL_OPERATOR_TOKEN`, `SUNREY_DATABASE_URL`, `SUNREY_FEATURE_REQUIRE_PERSISTENCE_FOR_READY`, `SUNREY_API_HOST`, `SUNREY_API_PORT`, `SUNREY_PREVIEW_SANDBOX_PERSONAS`, `SUNREY_PREVIEW_AUTH_ENABLED`, `SUNREY_PREVIEW_ALLOW_LOCAL_ORIGINS`, `SUNREY_API_ALLOWED_ORIGINS`, `SUNREY_PREVIEW_AUTH_EMAIL`, `SUNREY_PREVIEW_AUTH_PASSWORD`, `SUNREY_PUBLIC_APP_ORIGIN`, `SUNREY_PUBLIC_API_ORIGIN`, `LIVE_CONNECTIVITY_ENABLED`, `PRODUCTION_ACTIVE`, `SUNREY_PG_HOST`, `SUNREY_PG_PORT`, `SUNREY_PG_BOOTSTRAP_USER`, `SUNREY_PG_BOOTSTRAP_PASSWORD`, `SUNREY_PG_MIGRATOR_USER`, `SUNREY_PG_MIGRATOR_PASSWORD`, `SUNREY_PG_CUSTOMER_USER`, `SUNREY_PG_CUSTOMER_PASSWORD`, `SUNREY_PG_LEDGER_USER`, `SUNREY_PG_LEDGER_PASSWORD`, `SUNREY_PG_EVIDENCE_USER`, `SUNREY_PG_EVIDENCE_PASSWORD`, `SUNREY_PG_SECURITY_USER`, `SUNREY_PG_SECURITY_PASSWORD`, `SUNREY_PERSISTENCE_TEST`

---

## 20. Operational health checks

| Check | Endpoint / command | Expect |
| --- | --- | --- |
| Liveness | `GET /health` | `ok: true`, `productionReady: false` |
| Readiness | `GET /ready` | `ready: true` (when persistence optional in preview) |
| Simulation posture | `npm run check:posture` | simulation-only |
| Production safety | `node scripts/check-production-safety.mjs` | all flags false |
| Migrations | `npm run db:migrate` | idempotent apply |
| Persistence | `SUNREY_PERSISTENCE_TEST=1 npm run test:persistence` | all pass |

---

## Qualification fixes applied on this branch

- Restored corrupted performance baseline JSON files
- Moved persistence detection to `packages/config`; routed durable adapters through `services/accounts`
- Fixed HEC package export syntax; synced ops alert catalog with Prometheus rules
- Fixed Wave 8 route authorization scope; global BFF route auth in `dispatchAuthenticated`
- Rust formatting for `wave9_adversarial.rs`

---

## Release gate

**Designation:** `SUNREY SIMULATION RC1 — PASS` (sandbox / simulation backend for `app.sunrey.xyz`)

**Conditions met (post-fixes):**

- [x] Backend starts cleanly (`start:preview`)
- [x] DB initializes and migrates from zero
- [x] Persistence integration and restart qualification
- [x] User isolation and security smoke
- [x] Sandbox workflows exercised via e2e suites
- [x] API contracts present and RC qualification script passes
- [x] Live regulated execution remains disabled
- [x] Full `npm test` green after qualification repairs

**Not claimed:** production readiness, mainnet readiness, regulated banking live, or live investment execution.
