# SunRey Sandbox Launch Acceptance

**Prompt:** Launch Acceptance 4 of 4 — Full Sandbox Product Acceptance  
**Evaluated:** 2026-09-03 (UTC)  
**Targets:** `https://app.sunrey.xyz` → `https://api.sunrey.xyz`  
**Evaluator posture:** Simulation-only; no architecture changes; no live regulated execution

---

## Final verdict

# SUNREY SANDBOX LAUNCH — FAIL

Minimum blockers to reach PASS are listed in [§21 Zero-red launch gate](#21-zero-red-launch-gate).

---

## 1. Deployed build identity

| Field | Recorded value |
| --- | --- |
| **Approved release name** | `SUNREY SIMULATION RC1` (repository qualification record; prompt references “Simulation RC2” — see note below) |
| **Package / RC identifier** | `sunrey-backend-v1.0.0-rc.2` |
| **Qualification commit (git SHA)** | `a8235fc92d9b2ad75d59ec919f9b48ab40b5c9ee` |
| **Qualification branch** | `release/simulation-rc1-qualification` (merged to `main` as `12b583e6`) |
| **Base pre-qualification commit** | `8f20c3fcd5c7928c7e9841454eace9d0cebd870a` |
| **Release tag** | No `simulation-rc*` git tag published; RC is commit-pinned in `docs/releases/SUNREY_SIMULATION_RC_1.md` |
| **Deployed git SHA (runtime)** | **Not exposed** by `/health`, `/ready`, or `/api/v1/*` (gap). Posture and route catalog are consistent with RC-qualified Consumer BFF preview. |
| **Deployment time (observed)** | `2026-09-03T11:08:12Z` (API `Date` header on `/health`) |
| **Environment** | `simulation` |
| **Frontend deployment id** | `39b7da6a483d546dcce27647f5175a1ea024d8c4d3b11ee2fdf5cf00fcf88159` (`x-deployment-id` on `app.sunrey.xyz`) |
| **Service** | `sunrey-consumer-bff` |

**Naming note:** The qualification artifact is **RC1** with backend package **v1.0.0-rc.2**. There is no separate `SUNREY SIMULATION RC2` document in the repository at qualification time.

**Evidence (health):**

```json
{
  "ok": true,
  "service": "sunrey-consumer-bff",
  "environment": "simulation",
  "productionReady": false,
  "productionActive": false,
  "liveConnectivityEnabled": false
}
```

---

## 2. Health

| Check | Result |
| --- | --- |
| `GET https://api.sunrey.xyz/health` | **PASS** — HTTP 200, `ok: true` |
| `GET https://api.sunrey.xyz/ready` | **PASS** — HTTP 200, `ready: true` |
| Environment | **PASS** — `simulation` |
| Production active | **PASS** — `false` |
| Live connectivity | **PASS** — `false` |

---

## 3. CORS

| Check | Result |
| --- | --- |
| `Origin: https://app.sunrey.xyz` | **PASS** — HTTP 204, `access-control-allow-origin: https://app.sunrey.xyz`, credentials allowed |
| Unknown origin (`https://evil.example.com`) | **PASS** — HTTP 403, `ORIGIN_FORBIDDEN` JSON body |
| Wildcard `*` CORS | **PASS** — not present; origin is explicit |

---

## 4. Authentication

| Check | Result | Notes |
| --- | --- | --- |
| Preview auth bridge enabled | **PASS** | `POST /api/v1/auth/preview/session` returns 401 on bad credentials (not 404) |
| Invalid credentials fail | **PASS** | `AUTH_REQUIRED` / “email or password is incorrect” |
| Invalid / expired tokens fail | **PASS** | Sandbox and fake `ses_*` tokens → 401 |
| Protected routes require auth | **PASS** | `/api/v1/me/home` without token → 401 |
| Logout | **PASS** | `POST /api/v1/auth/logout` with sandbox token returns `sunrey.auth-logout.v1` |
| Sandbox persona tokens | **PASS** (partial) | `sandbox.basic_verified`, `sandbox.exchange`, `sandbox.grow`, etc. authenticate |
| Broken personas | **FAIL** | `sandbox.hin_ready`, `sandbox.vault_ready` → `SESSION_INVALID` |
| Browser login at `app.sunrey.xyz` | **FAIL** | Login form present; preview password not available to acceptance runner; no in-app sandbox persona picker |

**Sandbox personas exposed:** `GET /api/v1/sandbox/personas` returns 32 fixtures labeled `SANDBOX_FIXTURE_NON_PRODUCTION`.

---

## 5. Home

| Check | Result | Notes |
| --- | --- | --- |
| `GET /api/v1/me/home` | **PASS** | `sunrey.consumer.home.v1` |
| Wealth projection | **PASS** | Server-owned `wealth` object with availability state |
| Accounts | **PASS** | 4 accounts for `sandbox.exchange` |
| Grow summary | **PASS** | `grow` block present |
| Recent activity | **PASS** | 4 items |
| Action Center on home | **YELLOW** | `actionCenter` absent on home; actions via `/api/v1/me/actions` |
| Sandbox banner on home | **YELLOW** | `sandbox` metadata not present in deployed home payload (present in CI e2e fixture) |

---

## 6. Money

| Check | Result | Notes |
| --- | --- | --- |
| View accounts | **PASS** | `GET /api/v1/accounts` — ledger-derived balances |
| View balances | **PASS** | Integer minor units, `productionMoneyMovement: false` |
| Payment quote | **PASS** | `POST /api/v1/payments/quote` returns quote id |
| Payment execute | **YELLOW** | Quote succeeds; execute requires valid destination / recipient setup |
| FX reference | **PASS** | `GET /api/v1/fx/reference` — provider precedence list |
| FX quote | **YELLOW** | Endpoint exists; strict body validation; not fully exercised end-to-end |
| Simulated movement only | **PASS** | `liveBanking: false`, `productionMoneyMovement: false` |

---

## 7. Wallets

| Check | Result | Notes |
| --- | --- | --- |
| List wallets | **PASS** | `GET /api/v1/wallets` — SunRey Coin wallet with balance |
| Wallet identity | **PASS** | `walletId`, `addressRefs`, `custodyModel: SUNREY_NATIVE` |
| Balances | **PASS** | `1500000` minor units SunRey for exchange persona |
| Transaction history route | **PASS** | Catalog lists `/api/v1/wallets/transactions` |
| Open MoonRey wallet | **YELLOW** | Only `SUNREY_COIN` wallet returned for exchange persona |
| Deposit simulate | **FAIL** | `POST /api/v1/wallets/deposits/simulate` → 405 (lifecycle exchange not mounted) |
| Re-login persistence | **NOT TESTED** | Requires preview session + process restart on deployed infra |

---

## 8. SunRey / MoonRey

| Check | Result | Notes |
| --- | --- | --- |
| Assets in supply read | **PASS** | `SUNREY_COIN`, `MOONREY_COIN` in `GET /api/v1/economy/supply` |
| Sandbox identifiers | **PASS** | `DEVELOPMENT_ACTIVE`, `NOT_ASSIGNED` ticker, `network: DEVELOPMENT` |
| Privileged supply mutation | **PASS** | `POST /api/v1/economy/supply` → 405 |
| Mainnet issuance | **PASS** | `mainnetEconomics: UNRESOLVED`, `productionActive: false` |
| MoonRey coin detail route | **YELLOW** | `GET /api/v1/economy/moonrey-coin` → 404 on deployed surface |

---

## 9. Markets

| Check | Result | Notes |
| --- | --- | --- |
| Exchange markets | **PASS** | `GET /api/v1/exchange/markets` — `market:sunrey-coin-usd-simulation` |
| Consumer crypto markets | **FAIL** | `GET /api/v1/markets/crypto` — empty / no schema |
| World markets | **FAIL** | `GET /api/v1/world/markets` → 404 |
| Markets reference | **FAIL** | `GET /api/v1/markets/reference` → 404 |
| Data source identified | **YELLOW** | Exchange market lists simulation instrument; no live feed attribution on empty routes |
| Stale/error handling | **NOT TESTED** | Provider-down persona loads home; market feed kill not exercised on deployed |

---

## 10. Exchange

| Check | Result | Notes |
| --- | --- | --- |
| Market selection | **PASS** | Market list and detail routes |
| Quote / preview | **PASS** | `POST /api/v1/exchange/preview` — eligibility, `productionTradingEnabled: false` |
| Order book / ticker | **YELLOW** | Routes exist; ticker/book return minimal/empty on deployed |
| Proposal lifecycle | **FAIL** | `POST /api/v1/exchange/proposals` → **405**; `POST /api/v1/exchange/fund` → **405** |
| Order submit | **FAIL** | `POST /api/v1/exchange/orders` → “agent-originated orders require an approved proposal” |
| Holdings read | **PASS** | `GET /api/v1/exchange/holdings` |
| Fills / orders history | **PASS** | Routes return 200 (empty until orders execute) |
| Duplicate / insufficient balance | **NOT TESTED** | Blocked upstream by missing proposal path |
| Live execution mislabel | **PASS** | `productionTradingEnabled: false`, `liveExchangeEnabled` absent/false |

**Root cause:** Deployed runtime mounts `ExchangeProductSurface` (read/preview/submitOrder) rather than full `ExchangeLifecycleSurface` (fund → proposal → approve → submit). CI Phase G e2e expects lifecycle routes.

---

## 11. Portfolio

| Check | Result | Notes |
| --- | --- | --- |
| `GET /api/v1/portfolio` | **PASS** | HTTP 200, `liveInvestmentExecution: false` |
| Holdings reconcile | **YELLOW** | Empty holdings until exchange orders execute |
| Grow portfolio | **PASS** | `GET /api/v1/grow/portfolio` available per catalog |

---

## 12. Vault

| Check | Result | Notes |
| --- | --- | --- |
| View records | **PASS** | `sandbox.vault_minimal` — `GET /api/v1/data/vault/records` |
| View single record | **PASS** | Record detail by id |
| Access history | **PASS** | `GET /api/v1/data/vault/access` |
| Cross-user denial | **PASS** | Other user → `RESOURCE_NOT_OWNED` |
| `vault_ready` persona | **FAIL** | Token → `SESSION_INVALID` |
| Create / permissions / revoke | **NOT TESTED** | Write paths not exercised on deployed |

---

## 13. HIN / Human Economic Contribution

| Check | Result | Notes |
| --- | --- | --- |
| List contributions | **PASS** | `GET /api/v1/hin/contributions` — 200 (empty for exchange persona) |
| Summary | **PASS** | `GET /api/v1/hin/me/summary` |
| Create contribution | **FAIL** | `POST /api/v1/hin/contributions` → 405 |
| `hin_ready` persona | **FAIL** | `SESSION_INVALID` |
| Monetization duplicate block | **NOT TESTED** | No write path on deployed |

---

## 14. Grow My Money

| Check | Result | Notes |
| --- | --- | --- |
| Grow home | **PASS** | `GET /api/v1/grow` — ledger-derived snapshot |
| Opportunities | **PASS** | `GET /api/v1/grow/opportunities` |
| Plan read | **PASS** | `GET /api/v1/grow/plan` |
| Enter goals | **FAIL** | `POST /api/v1/grow/goals` → “Goal editing is not enabled in the unified preview yet” |
| Agent recommendation | **YELLOW** | `GET /api/v1/grow/agent` → `FEATURE_UNAVAILABLE` for grow persona |
| Agent cannot execute | **PASS** | Agent message: “I cannot authorize money movement” |
| Allocation / approval boundaries | **NOT TESTED** | Goal and proposal writes blocked |

---

## 15. Action Center

| Check | Result | Notes |
| --- | --- | --- |
| Actions load | **PASS** | `GET /api/v1/me/actions` — 1 item for `agent_enabled` |
| Unified `/api/v1/action-center` | **FAIL** | 404 on deployed |
| Kernel bypass | **PASS** | Exchange preview requires `EXECUTION_AUTHORITY`; direct order blocked |
| Dismiss workflow | **NOT TESTED** | Dismiss route exists in catalog; not exercised |

---

## 16. Cross-user security

| Resource | Test | Result |
| --- | --- | --- |
| Wallet | User A wallet id with User B token | **PASS** — denied |
| Vault record | `vault_minimal` record with `basic_verified` | **PASS** — `RESOURCE_NOT_OWNED` |
| Exchange order | No orders to probe | **NOT TESTED** |
| Profile | Implicit via principal scoping | **PASS** — customer-bound responses |

---

## 17. Persistence

| Check | Result |
| --- | --- |
| Backend process restart | **NOT TESTED** — no operator access to production sandbox pods |
| DB survival | **INFERRED PASS** — RC1 qualification includes PostgreSQL migrate/restart suite (`npm run qualify:backend-db`, 38 persistence tests) |
| Deployed re-login | **NOT TESTED** |

---

## 18. Failure behavior

| Scenario | Result |
| --- | --- |
| Database unavailable | **NOT TESTED** on deployed |
| Market data unavailable | **NOT TESTED** on deployed |
| Provider unavailable | **YELLOW** — `sandbox.provider_down` persona still loads home |
| `/ready` degradation | **NOT TESTED** |
| No live fallback | **PASS** — health confirms `liveConnectivityEnabled: false` |

---

## 19. Frontend mock audit

**App inventory (from bundle + browser):** Home, Money, Accounts, Activity, Cards, Move/Send, Exchange, Markets, Grow, Vault, HIN/Data, Agent/Conversation, Access, Profile, Login, Soon/Create-account.

**API base:** Frontend bundles reference `api.sunrey.xyz` (confirmed in `endpoints-*.js`).

| Feature / screen | Data source classification |
| --- | --- |
| Login | **REAL BACKEND** — `POST /api/v1/auth/preview/session` |
| Home, accounts, wealth | **REAL BACKEND** — `/api/v1/me/home`, `/api/v1/accounts` |
| Money / payments / FX | **SANDBOX EXECUTION** — server-owned quotes; simulation rails |
| Wallets | **SANDBOX EXECUTION** — custody read model |
| Exchange UI | **SANDBOX EXECUTION** (read/preview only on deployed) |
| Markets UI | **MOCK / PLACEHOLDER risk** — backend market routes empty/404 |
| Grow UI | **REAL BACKEND** (read); goal write **MOCK / PLACEHOLDER** |
| Vault UI | **REAL BACKEND** when using working personas |
| HIN UI | **REAL BACKEND** (read-only on deployed) |
| Agent / conversation | **REAL BACKEND** — simulated inference |
| Cards | **SANDBOX EXECUTION** — empty state, simulated issuing |
| Create account | **STATIC CONTENT** — `/soon/create-account` |
| Branding / theme | **STATIC CONTENT** |

**Remaining mocks / gaps (launch-relevant):**

1. No client-side authoritative balance math detected; risk is **empty backend routes** presented as broken screens, not Lovable hardcoded wealth.
2. Markets screens likely show empty/error unless wired to `/api/v1/exchange/markets` only.
3. Account creation is explicitly “coming soon”.
4. Grow goal entry blocked server-side.
5. Exchange trade completion blocked server-side (no proposal lifecycle).

---

## 20. Product feature matrix

| Area | Score | Rationale |
| --- | --- | --- |
| Authentication | **YELLOW** | API auth works; browser needs secret preview password; 2 personas broken |
| Home | **GREEN** | Backend home payload usable |
| Money | **GREEN** | Accounts and balances from ledger |
| Payments | **YELLOW** | Quote works; execute not fully verified |
| FX | **YELLOW** | Reference providers listed; quote/execute partial |
| Cards | **YELLOW** | Surface available; empty simulated state |
| Wallets | **YELLOW** | SunRey wallet works; MoonRey/deposit simulate missing |
| SunRey | **GREEN** | Supply read, wallet balance, correct sandbox ids |
| MoonRey | **YELLOW** | Supply read only; no wallet/detail route on deployed |
| Markets | **RED** | Consumer/world market routes empty or 404 |
| Exchange | **RED** | Cannot complete simulated order lifecycle on deployed |
| Portfolio | **YELLOW** | Reads work; empty without exchange fills |
| Vault | **YELLOW** | Works for `vault_minimal`; `vault_ready` broken |
| HIN | **YELLOW** | Read-only; no contribution write |
| HEC | **YELLOW** | Same as HIN; monetization not exercised |
| Grow My Money | **RED** | Goal entry disabled; grow agent unavailable |
| Agent | **YELLOW** | Conversation works; policy route 404; no autonomous execution (correct) |
| Action Center | **YELLOW** | `/api/v1/me/actions` works; unified route 404 |
| Profile | **GREEN** | `GET /api/v1/me` |
| Persistence | **YELLOW** | Qualified in RC1 CI; not re-tested live |
| Security | **GREEN** | Cross-user denial; supply mutation blocked; simulation flags |
| API | **GREEN** | Stable health/ready; correct error envelopes |
| Frontend Integration | **RED** | Cannot complete browser E2E without preview password; exchange/markets broken |

---

## 21. Zero-red launch gate

**SUNREY SANDBOX LAUNCH — PASS** requires no RED in core user flows.

### RED items (minimum blockers)

1. **Exchange** — Simulated order lifecycle cannot complete (`proposals`/`fund` 405; `orders` requires unreachable approved proposal).
2. **Markets** — Primary market data routes empty or 404 outside exchange instrument list.
3. **Grow My Money** — Users cannot enter goals (`POST /api/v1/grow/goals` disabled).
4. **Frontend integration** — `app.sunrey.xyz` login requires undisclosed preview password; acceptance could not verify end-to-end UI flows.

### Recommended fixes (smallest path to PASS)

1. Mount `ExchangeLifecycleSurface` on deployed Consumer BFF (or enable proposal/approve/submit on current surface) and verify one BUY fill on `api.sunrey.xyz`.
2. Wire markets screens to `/api/v1/exchange/markets` + ticker/book or implement `/api/v1/markets/crypto`.
3. Enable grow goal `POST` in unified preview (or document persona-only workaround if intentional).
4. Distribute preview password to sandbox users **or** add an in-app sandbox persona picker for `app.sunrey.xyz`.
5. Fix `sandbox.hin_ready` / `sandbox.vault_ready` session mapping (`SESSION_INVALID`).
6. Expose `git` SHA / RC id on `/health` or `/ready` for deployment verification.

---

## 22. Scope reminder

This acceptance evaluates a **publicly accessible functional sandbox / preview**.

It does **not** claim:

- Regulated banking approval
- Live securities brokerage
- Live crypto exchange licensing
- Live custody authorization
- Live payment processing
- Mainnet monetary issuance
- Production HSM/KMS authorization

---

## Evidence commands (reproducible)

```bash
# Health
curl -sS https://api.sunrey.xyz/health | jq .
curl -sS https://api.sunrey.xyz/ready | jq .

# CORS
curl -sSI -X OPTIONS https://api.sunrey.xyz/health \
  -H "Origin: https://app.sunrey.xyz" \
  -H "Access-Control-Request-Method: GET"

# Authenticated home
curl -sS https://api.sunrey.xyz/api/v1/me/home \
  -H "Authorization: Bearer sandbox.exchange" | jq .

# Exchange preview (works)
curl -sS -X POST https://api.sunrey.xyz/api/v1/exchange/preview \
  -H "Authorization: Bearer sandbox.exchange" \
  -H "Content-Type: application/json" \
  -d '{"side":"BUY","quantity":"2","notionalUsdMinor":"50000"}' | jq .

# Exchange proposal (fails on deployed)
curl -sS -X POST https://api.sunrey.xyz/api/v1/exchange/proposals \
  -H "Authorization: Bearer sandbox.exchange" \
  -H "Content-Type: application/json" \
  -d '{"side":"BUY","quantity":"2","notionalUsdMinor":"50000"}' | jq .

# Grow goal (fails on deployed)
curl -sS -X POST https://api.sunrey.xyz/api/v1/grow/goals \
  -H "Authorization: Bearer sandbox.grow" \
  -H "Content-Type: application/json" \
  -d '{"name":"Emergency fund","targetMinorUnits":"100000","currency":"USD","horizonMonths":12}' | jq .
```

---

## References

- `docs/releases/SUNREY_SIMULATION_RC_1.md` (on `release/simulation-rc1-qualification`)
- `docs/productization/sunrey-backend-release-candidate.json`
- `deploy/sunrey-preproduction/README.md`
- `docs/productization/SUNREY_LOVABLE_SCREEN_READINESS.md`
- `tests/phase-g-exchange-e2e.test.ts` (expected exchange lifecycle)
