# SunRey desktop dashboard (`dashboard.sunrey.xyz`)

A zero-dependency, institutional desktop client for the canonical Consumer BFF
(`/api/v1`). It holds **no financial state**: every balance, order, position and
status on screen is a response from the backend, rendered as returned. Money is
formatted from integer minor-unit strings with string/BigInt arithmetic; no
floating point touches amounts. Totals are never blended across asset classes or
currencies, and SR/MR are never given a USD value.

**Design.** The look is the sunrey.xyz design system (SunRey-website
`CLAUDE.md` §5): black ground `#060505`, warm gold `#E3B23C` used sparingly,
Jost for display, Inter for UI, JetBrains Mono for labels, and the light field
(diagonal hairlines at ~18° from vertical, 120px apart, under one low sun).
Tokens live at the top of `src/styles.css` with the website's names. The three
faces are self-hosted from `src/assets/fonts/` (OFL), so the CSP allows fonts
and styles from `'self'` only; no third-party font request is made.

| Section | Backend surfaces |
|---|---|
| Home | `/accounts`, `/exchange/portfolio`, `/grow/plan`, `/agent/actions`, `/me/capabilities`, `/economy/status` |
| Money & Banking | `/accounts`, `POST /accounts`, `POST /sandbox/funding`, `/payments`, `/accounts/{id}/activity`, `/money/history` |
| Grow My Money | `/grow/plan`, `/grow/controls/status`, `/grow/active-capital`, `/grow/results`, `/grow/strategies`, `/grow/opportunities` |
| Helios desk | `/grow/overview`, `/grow/agent-state`, `/grow/strategies`, `/grow/positions`, `/grow/results`, `/grow/activity` |
| Exchange | `/exchange/markets`, `/markets/{id}`, `/order-book`, `/candles`, `POST /exchange/quotes`, `POST /exchange/orders`, `/cancel`, `/portfolio`, `/fills`, `/transactions` |
| Wallets & Chain | `/wallets`, `POST /wallets`, `/wallets/SRC`, `/wallets/MRC`, `/wallets/transactions`, `/economy/sunrey-coin`, `/economy/moonrey-coin` |
| Financial Agent | `/agent`, `/agent/actions`, `/approve`, `/reject`, `/agent/settings`, `/agent/pause`, `/agent/revoke`, `/agent/escalations` |
| Access | `/access/overview`, `/entitlements`, `/reservations`, `/categories` |
| Vault & HIN | `/data/consents`, `/revoke`, `/data/vault`, `/hin/me/summary`, `/data/vault/sources`, `/data/access-history` |
| Settings & Security | `/auth/session`, `/auth/mfa/*`, `/me/capabilities`, `/notifications` |

Every panel renders exactly one of: loading, error (with request id and retry),
**not available for your account** (capability disabled / not bound / not
exposed by this release), **permission not granted** (names the capability),
empty, or content.

## Authentication

Uses the BFF's durable customer auth (`POST /auth/register`, `/auth/login`,
`/auth/refresh`, `/auth/logout`, `/auth/mfa/*`). It never uses the shared
preview login. Financial actions call `requireStrong()`: the Compliance Kernel
requires a STRONG session, so the user enrolls TOTP once and confirms with a
code (password + TOTP + step-up). Tokens live in `sessionStorage` and are sent
as a bearer header; there are no cookies, so CSRF does not apply. One active
session per identity: signing in elsewhere ends this one.

## Build and run locally

```bash
SUNREY_DASHBOARD_API_BASE=http://127.0.0.1:8443 node apps/dashboard/build.mjs
node apps/dashboard/serve-local.mjs     # http://127.0.0.1:8788, same headers as Pages
```

The BFF must allow the origin (`SUNREY_API_ALLOWED_ORIGINS=http://127.0.0.1:8788`)
and run with customer auth (see below). `scripts/dashboard-acceptance.py`
exercises the API journey and restart persistence.

## Deployment (Cloudflare Pages)

Static site; no Worker, no Cloudflare-side state. `.github/workflows/dashboard-pages.yml`
builds on every PR, deploys PR previews, and deploys production from `main`
through the protected `dashboard-production` GitHub environment, then verifies
the live site serves the release SHA and the security headers.

`build.mjs` writes `js/config.js` and `_headers` (strict CSP with `connect-src`
pinned to the API origin, HSTS, `frame-ancestors 'none'`, no-referrer,
`noindex`) and `_redirects` (SPA fallback).

**Rollback:** Cloudflare dashboard → Pages → `sunrey-dashboard` → Deployments →
pick the previous production deployment → *Rollback*. Or re-run the workflow on
the previous `main` SHA.

## One-time setup (requires account owners)

1. **Cloudflare Pages:** create project `sunrey-dashboard` (Direct Upload), add
   custom domain `dashboard.sunrey.xyz` (creates the proxied CNAME; TLS is
   automatic). Do not change `sunrey.xyz` or `app.sunrey.xyz`.
2. **API token:** create a token scoped to *Account → Cloudflare Pages → Edit*
   only. Add repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`;
   optional variable `SUNREY_EXPLORER_URL`.
3. **Enable deploys:** set repository variable `DASHBOARD_DEPLOY_ENABLED=true`
   (deploy jobs are skipped until then; the build and guards always run).
4. **GitHub environments:** `dashboard-production` with required reviewers and
   `main` only; `dashboard-preview` for PR previews.
5. **Previews:** protect `*.sunrey-dashboard.pages.dev` with Cloudflare Access
   (Zero Trust → Access → Applications) so previews are not public.
6. **Edge controls on `api.sunrey.xyz`:** WAF managed rules on; rate-limit
   `POST /api/v1/auth/login|register|mfa/*` (e.g. 10/min per IP); Bot Fight Mode.
7. **Backend (Hetzner, `deploy/sunrey-sandbox-hetzner`):**
   ```
   SUNREY_API_ALLOWED_ORIGINS=https://app.sunrey.xyz,https://dashboard.sunrey.xyz
   SUNREY_CUSTOMER_AUTH_ENABLED=true
   SUNREY_RUNTIME_CLOCK=SYSTEM
   SUNREY_RUNTIME_KEY_SEED=<>= 32 random chars from the secret manager; never rotate casually>
   ```
   Rotating the key seed signs every customer out and invalidates their TOTP
   enrollment, by design. Back up PostgreSQL before the first switch.

## Activation gates (what stays off)

| Capability | State | Gate to change it |
|---|---|---|
| Website, auth, durable sandbox state | Deployable after setup above | Release approval in `dashboard-production` |
| Sandbox banking, faucet, own-account transfers | SANDBOX | n/a (simulated) |
| Paper / Helios Grow | SANDBOX, bound to a sandbox persona only | Durable per-customer Helios binding (engineering) |
| Testnet SR/MR exchange | SANDBOX (internal liquidity) | n/a |
| Real deposits / withdrawals | OFF | Licensed partner contract + certification + counsel + human release |
| Real trading | OFF | Broker agreement, mandate, Risk Engine qualification, human release |
| Token sales / live exchange / mainnet | OFF | Legal classification, custody, security audit, board sign-off |

No `LIVE_*`, `PRODUCTION_ACTIVE` or `MAINNET_ACTIVE` flag is changed by this app.
