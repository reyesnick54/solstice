# SunRey Full Sandbox / Simulation Release Candidate 2

| Field | Value |
| --- | --- |
| **Release candidate name** | `SUNREY SIMULATION RC2` |
| **Package identifier** | `sunrey-backend-v1.0.0-rc.2` |
| **Qualification branch** | `release/sunrey-simulation-rc2` |
| **Release base (main)** | `12b583e61e086c671e8535e7e8209d64b5630c4a` |
| **Qualification commit** | `bb419d72d0cc122ce4fc92b28c94f25f60f8eb82` |
| **Release documentation commit** | `bb419d72d0cc122ce4fc92b28c94f25f60f8eb82` |
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
- **PostgreSQL** — bounded domains: `solstice_customer` (V042), `solstice_ledger` (V010), `solstice_evidence`, `solstice_security`.

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
| Customer schema | **V042** `human_economic_contribution` (HEC durable state, idempotency, monetization locks) |
| Qualification | `SUNREY_PERSISTENCE_TEST=1 npm run qualify:backend-db` — empty DB → latest, prior-schema upgrade, restart invariants, migration failure rollback |
| Integration tests | `SUNREY_PERSISTENCE_TEST=1 npm run test:persistence` — **all pass** (including HEC idempotency suite) |

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
| Exchange | `/api/v1/exchange/*` | GET/POST | Bearer | **Simulated execution** | READY |
| Wallets | `/api/v1/wallets/*` | GET/POST | Bearer | Simulation custody | READY |
| SunRey Coin | `/api/v1/sunrey/*`, `/api/v1/economy` | GET | Bearer | Read-only supply | READY |
| MoonRey Coin | `/api/v1/economy/moonrey-coin` | GET | Bearer | Productive simulation | READY |
| Vault | `/api/v1/data/vault/*` | GET/POST | Bearer | PDV simulation | READY |
| HIN | `/api/v1/hin/*` | GET/POST | Bearer | Rights marketplace sim | READY |
| Profile | `/api/v1/me` | GET/PATCH | Bearer | Simulation | READY |

Full mapping: `docs/productization/SUNREY_LOVABLE_BFF_MAPPING.md`, `docs/productization/SUNREY_LOVABLE_SCREEN_READINESS.md`.

---

## 6. Sandbox functionality (verified)

| Area | Evidence |
| --- | --- |
| Fresh install | `npm ci` |
| DB from zero | `db:bootstrap` + `db:migrate` including **V042** |
| Backend startup | `npm --workspace services/api run start:preview` — `/health` returns `productionReady: false`, `liveConnectivityEnabled: false` |
| Identity / auth | Preview session + `sandbox.<persona>` tokens; unauthenticated `/api/v1/me/home` → **401** |
| User isolation | Distinct sandbox personas return distinct account payloads |
| Persistence / restart | `qualify:backend-db`, `test:persistence` |
| HEC idempotency | `tests/persistence/human-economic-state-idempotency.test.ts` — 8/8 pass |
| Economic integrity | `qualify:wave9:fast` smoke; duplicate monetization/replay tests |
| Package boundaries | `python3 scripts/check-package-boundaries.py` — 0 new violations |
| Full repository tests | `npm test` — 6163 pass, 2 failures fixed on RC2 branch |

---

## 7. Disabled production functionality

All `LIVE_*` flags **false** (`packages/config/src/flags.ts`):

`LIVE_MONEY_ENABLED`, `LIVE_PAYMENTS_ENABLED`, `LIVE_BANKING_RAILS`, `LIVE_EXTERNAL_KYC`, `LIVE_EXTERNAL_BANK_CONNECTION`, `REAL_MONEY_ENABLED`, `LIVE_TRADING_ENABLED`, `LIVE_CRYPTO_ENABLED`, `LIVE_EXCHANGE_ENABLED`, `LIVE_INVESTMENT_EXECUTION`, `LIVE_CUSTODY_ENABLED`, `LIVE_AGENT_FINANCIAL_EXECUTION_ENABLED`, `LIVE_CONNECTIVITY_ENABLED`, `LIVE_MOONREY_PRODUCTIVE_ISSUANCE_ENABLED`, `PRODUCTION_HSM_KMS_CONFIGURED`, and related flags.

`PRODUCTION_READY=false`, `MAINNET_ACTIVE=false`. Production economic activation firewall remains **inactive**.

---

## 8. Test suites executed

| Suite | Result |
| --- | --- |
| `npm ci` | Pass |
| JSON/YAML integrity | Pass |
| Architecture / package boundaries | Pass |
| Authority map / freeze / production safety | Pass |
| OpenAPI qualification | Pass |
| `npm run qualify:backend-rc` | Pass |
| `SUNREY_PERSISTENCE_TEST=1 npm run qualify:backend-db` | Pass |
| `SUNREY_PERSISTENCE_TEST=1 npm run test:persistence` | Pass |
| `npm run qualify:wave9:fast` | Pass (smoke profile) |
| `npm test` | Pass (after RC2 fixes) |
| `npm run demo` | Pass |
| Rust `cargo fmt --check`, `cargo check`, `cargo clippy`, `cargo test` | Pass |
| Secret scan + SBOM/provenance | Pass |
| Consumer BFF live smoke (`/health`, `/ready`, auth 401, sandbox session) | Pass |

---

## 9. Security checks

| Check | Result |
| --- | --- |
| Secret scan | Pass |
| Unauthenticated protected routes | 401 |
| Cross-user sandbox isolation | Distinct persona data |
| Preview auth simulation-only | Verified |
| `/health` posture | `productionReady: false`, `liveConnectivityEnabled: false` |
| Agent cannot self-execute | Structural + tests |

This is **not** an independent security audit.

---

## 10. Economic integrity (RC2)

| Check | Result |
| --- | --- |
| Duplicate economic claim blocked | HEC idempotency TEST 7 |
| Duplicate monetization blocked | TEST 1–4 |
| Replay protection survives restart | TEST 5 |
| Two instances cannot circumvent uniqueness | TEST 3–4 (multi-pool) |
| DB uniqueness constraints | TEST 6 |
| Canonical Economic Claims do not directly mint | Wave 9 / proof-bound tests |
| SunRey/MoonRey simulated supply governed | Economics policy verify in CI |

---

## 11. Known limitations

- Preview authentication is **simulation-only**; production OAuth/OIDC not wired.
- `npm run typecheck` reports pre-existing strict typing drift in some `tests/wave3-*` and `tests/wave5-*` files.
- Platform API exposes only a **subset** of routes; frontend must use Consumer BFF host.
- External provider catalog population incomplete (102/126).
- `BACKEND_RC_READY_PENDING_EXTERNAL_GATES` — regulatory, counsel, and live provider gates remain open.

---

## 12. Regulatory dependencies

- No corridor marked `CONFIRMED_BY_COUNSEL`.
- KYC/AML/sanctions are **simulated** — not regulatory approval.

---

## 13. Deployment instructions

### From clean checkout

```bash
git clone <repo> && cd solstice
git checkout release/sunrey-simulation-rc2
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

### Verify

```bash
curl -s http://127.0.0.1:8443/health
curl -s http://127.0.0.1:8443/ready
```

---

## 14. Rollback instructions

1. Stop the Consumer BFF / Platform API processes.
2. Revert to tag `sunrey-backend-v1.0.0-rc.1` or prior known-good image.
3. If schema changed, restore PostgreSQL from last known-good backup.
4. Re-run `npm run db:migrate` only forward — do not edit applied migrations.
5. Confirm `/health` shows `productionActive: false` before re-admitting traffic.

---

## 15. Tagging

After CI green on this branch:

```bash
git tag -a sunrey-backend-v1.0.0-rc.2 $(git rev-parse HEAD) -m "SUNREY SIMULATION RC2"
git push origin sunrey-backend-v1.0.0-rc.2
```

---

## Qualification fixes applied on RC2

- Restored corrupted performance baseline JSON (merge artifact blocking CI on main)
- Routed `packages/persistence` env through `@solstice/config` public API (package boundary)
- V042 `human_contribution` schema grants for `customer_app`
- Durable HEC state: ClaimRegistry JSON serialization, idempotency hydration, fingerprint gate
- Repaired corrupted `product-integration/runtime.ts` merge artifact

---

## Release gate

**Designation:** `SUNREY SIMULATION RC2 — PASS` (sandbox / simulation backend for `app.sunrey.xyz`)

**Conditions met:**

- [x] Release base recorded (`12b583e6` on `main`)
- [x] Qualification repairs committed on `release/sunrey-simulation-rc2`
- [x] Backend starts cleanly (`start:preview`)
- [x] DB initializes and migrates from zero (V042 included)
- [x] Persistence integration and restart qualification
- [x] User isolation and security smoke
- [x] Sandbox workflows exercised via e2e suites
- [x] Live regulated execution remains disabled

**Not claimed:** production readiness, mainnet readiness, regulated banking live, or live investment execution.
