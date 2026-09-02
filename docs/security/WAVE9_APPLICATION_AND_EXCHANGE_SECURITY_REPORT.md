# WAVE 9 — Application and Exchange Security Report

**Date:** 2026-09-02  
**Scope:** Consumer API, Admin/internal API, frontend-adjacent surfaces, wallet, Exchange, Grow My Money agents, Personal Data Vault, Action Center, service-to-service boundaries, session/token handling, dependency supply chain.  
**Posture:** `ENVIRONMENT=simulation`, all `LIVE_*` flags remain `false`. No live infrastructure was attacked.

This report documents safe, repository-native assurance work. It does **not** constitute independent penetration-test certification.

---

## Executive summary

Application-layer compromise was tested against paths that could lead to asset theft, privilege escalation, unauthorized trading, unauthorized data access, governance bypass, or monetary manipulation.

**Result:** Canonical Kernel + Execution Authority gating, agent structural isolation, Vault subject binding, and internal operator fail-closed controls held for tested scenarios. Three clear defects in the Consumer BFF and chain explorer were remediated with regression tests.

| Area | Verdict |
|------|---------|
| Consumer BFF authentication | Protected (session required) |
| Cross-user IDOR (Exchange, agent) | Denied server-side |
| Internal admin / production gates | Fail-closed; consumer clients blocked |
| Card webhooks | **Fixed** — HMAC verification now required before ingest |
| BFF error leakage | **Fixed** — internal exceptions no longer return `error.message` |
| Exchange sandbox | No EA on BFF actor; proposal required to submit |
| Agent / Grow | Injection and adversarial tools refused; no self-approve |
| Vault | Subject-bound; cross-user reads denied (package tests) |
| Action Center | Server-owned transitions; forged outcomes rejected |
| Wallet | Session ≠ signing authority |
| Market manipulation boundary | Exchange plane separate from canonical supply / GPUV / governance |
| Dependencies (`npm audit`) | 0 high/critical at audit time |
| External Lovable frontend | Out of repo — not independently verified here |

---

## Task 1 — API security audit

### Tested

- Broken authentication: unauthenticated `/api/v1/me` → `401 AUTH_REQUIRED`
- Malformed JSON on HTTP adapter → `400` without stack traces (Wave 6 baseline retained)
- Error leakage: handler `catch` previously returned raw `Error.message` → **remediated**
- CORS: disallowed origins → `403 ORIGIN_FORBIDDEN` (consumer HTTP adapter)
- Preview auth: disabled by default → `404` unless explicitly enabled
- Rate-limit policy tiers: sensitive endpoints stricter (Wave 6 baseline)
- Catalog enumeration: `/api/v1/catalog/*` remains unauthenticated by design (API surface map only; no secrets)

### Findings

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| W9-API-01 | Medium | Consumer BFF `catch` returned internal `error.message` to clients | **Fixed** |
| W9-API-02 | Medium | `POST /api/v1/webhooks/cards` accepted unverified bodies when ingest was wired | **Fixed** |
| W9-API-03 | Low | Platform API `nullAuthenticator` default — only scaffold routes today | Accepted risk (documented) |
| W9-API-04 | Info | Card webhook route documented as HMAC but had no gate at BFF boundary | **Fixed** |

---

## Task 2 — Authorization attacks

| Attack | Result |
|--------|--------|
| User A → User B Exchange order | `RESOURCE_NOT_OWNED` |
| User → `/internal/v1/production-gates` | `404` on consumer surface; `403` with `x-sunrey-client: lovable` on internal |
| Agent → admin endpoint | No admin routes on consumer BFF |
| Expired access token | Rejected by identity token verifier |
| Revoked session token | `401 SESSION_INVALID` on BFF |
| Frontend role spoofing | Capabilities derived from server session facts only |

---

## Task 3 — Wallet security

| Attack | Result |
|--------|--------|
| Session → native signing | `SESSION_IS_NOT_SIGNING_AUTHORITY` |
| Server-side self-custody key export | SDK returns `SELF_CUSTODY_KEY_UNAVAILABLE` |
| Mobile sync master keys on server | `masterKeysOnServer = false` (Chunk 96 baseline) |

Wallet link / chain substitution flows are custody-product concerns; BFF exposes orchestration without signing material.

---

## Task 4 — Exchange security

| Attack | Result |
|--------|--------|
| Order ownership bypass | `NOT_OWNED` for foreign `orderId` |
| Submit without approved proposal | `PROPOSAL_REQUIRED` |
| BFF actor with `authorityPresent: false` | Cannot represent production execution authority |
| Duplicate order / settlement | Covered by `packages/sunrey-exchange` idempotency tests (existing) |

Negative-quantity preview is not a hard rejection at preview layer in sandbox; submission remains proposal-gated.

---

## Task 5 — Market manipulation boundary

Sandbox Exchange mechanics do not expose mint, GPUV, PEVE, or governance authorization mutation endpoints on the consumer BFF. `ENVIRONMENT` remains `simulation`. Exchange price and holdings are application-port state, not canonical monetary supply.

---

## Task 6 — Agent prompt / tool abuse

| Adversarial instruction | Result |
|-------------------------|--------|
| Ignore mandate / admin access | `detectDirectInjection` → blocked in conversation path |
| Forge user on tool call | `ADVERSARIAL_TOOL_REFUSED` |
| Memory: "you can approve transactions" | `MEMORY_POISON_REJECTED` |
| Mint / disable audit phrasing | Blocked via injection taxonomy (existing) |

Agents cannot import `ExecutionAuthority` or call `Ledger.postJournal` (architecture guards).

---

## Task 7 — Agent confused-deputy attacks

Indirect injection from merchant/market text is refused (`INDIRECT_PROMPT_INJECTION`). Cross-user conversation and action IDs are denied even when guessed.

---

## Task 8 — Vault security

Package-level tests confirm cross-subject read/export/delete denial. BFF `dispatchVault` requires verified `ActorContext` before any Vault call. Forbidden payload keys (PAN, mnemonics, etc.) enforced in Vault product layer.

---

## Task 9 — Action Center

Action transitions are server-owned. Forged `outcome` posts with fake `executionAuthorityRef` from a different persona are rejected. Action IDs are not enumerable across users.

---

## Task 10 — Admin API

Internal operator API (`/internal/v1/*`) requires:

1. `x-sunrey-operator-role` ∈ governance roles
2. `x-sunrey-internal-token` matching configured secret
3. `x-sunrey-client` ∉ `{lovable, consumer, bff, agent}`

Fails closed when token not configured. No ordinary admin mint or Kernel bypass path identified.

---

## Task 11 — Session / token security

- Access tokens: HMAC-signed, short-lived, tamper-detected
- Revoked sessions: not accepted on BFF
- Preview auth: timing-safe compare; disabled by default
- SDK default: in-memory token store (not `localStorage`)
- Cookie settings: consumer auth responses use `no-store`

---

## Task 12 — Frontend security

| Item | Status |
|------|--------|
| Client secrets in repo | None in application code; CI secret scan |
| Explorer XSS (`innerHTML`) | **Fixed** — `escapeHtml` on home/search fields |
| Lovable external app | Not in repository |
| Source maps | Not audited for sensitive data in this wave |

---

## Task 13 — Dependency / supply chain

```
npm audit --audit-level=high
→ 0 high, 0 critical (244 total dependencies at audit time)
```

No uncontrolled mass upgrades performed. Follow `docs/security/dependency-policy.md` for ongoing monitoring.

---

## Task 14 — Remediation (fixed defects)

### W9-API-01 — BFF internal error leakage

- Added `bffFailClosedInternal()` in `services/api/src/consumer/errors.ts`
- Handler `catch` returns generic message; HTTP `500` for `category: INTERNAL`

### W9-API-02 / W9-API-04 — Card webhook verification gate

- Added `services/api/src/consumer/card-webhook.ts`
- Replaced unauthenticated `ingestCardWebhook` callback with `cardWebhook` bridge requiring `ProviderWebhookGuard` validation before ingest

### W9-FE-01 — Explorer reflected XSS

- `apps/explorer/app.js` — `escapeHtml()` applied to home metrics, lag line, and search JSON rendering

### Regression tests

- `tests/wave-9-application-exchange-security.test.ts` (19 cases)
- Added to `npm run test:security` suite

---

## Unresolved / accepted risks

1. **External Lovable frontend** — token storage, CSP, and XSS must be validated in that deployment.
2. **Platform API `nullAuthenticator`** — wire real session validation before expanding `/api/v1` beyond scaffold.
3. **Internal operator auth** — shared secret + header role; mTLS/JWT not yet productized.
4. **Unauthenticated catalog endpoints** — intentional developer surface map; monitor for information disclosure sensitivity.
5. **Preview / sandbox persona flags** — must remain disabled outside controlled dev networks.
6. **Independent audit** — `INDEPENDENT_AUDIT_REQUIRED: true` in audit-readiness build status.

---

## Files changed

| File | Change |
|------|--------|
| `services/api/src/consumer/errors.ts` | `bffFailClosedInternal`, INTERNAL → HTTP 500 |
| `services/api/src/consumer/card-webhook.ts` | New verified webhook gate |
| `services/api/src/consumer/handler.ts` | Fail-closed errors; verified card webhook path |
| `apps/explorer/app.js` | XSS escaping on home/search |
| `tests/wave-9-application-exchange-security.test.ts` | New regression suite |
| `scripts/run-repository-tests.mjs` | Include wave-9 in `test:security` |
| `docs/security/WAVE9_APPLICATION_AND_EXCHANGE_SECURITY_REPORT.md` | This report |

---

## Validation

| Suite | Result |
|-------|--------|
| `tests/wave-9-application-exchange-security.test.ts` | 19/19 pass |
| `npm run test:security` | 97/97 pass |
| `services/api/src/consumer-http.test.ts` | pass |
| `services/api/src/consumer-agent.test.ts` | pass |
| `services/api/src/production-gates.test.ts` | pass |
| `tests/chunk-96-wallet-security.test.ts` | pass |
| `npm audit --audit-level=high` | 0 high/critical |

---

## Conclusion

Tested application-plane controls prevent the modeled compromise classes from reaching canonical ledger, mint, or governance authorization under simulation posture. Remaining risk is concentrated in external frontend deployment, future Platform API auth wiring, and pre-production operator hardening — not in undetected BFF error leakage or unverified card webhook ingestion (both now fixed).
