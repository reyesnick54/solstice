# Phase B Prompt 2 — Authentication, session security, and device trust

Canonical consumer authentication for SunRey. This document records what
was productized, what was extended, and what remains blocked.

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains `false`.
`PRODUCTION_READY=false`. Authentication is not KYC and does not issue
Execution Authority.

Phase B Prompt 1 (`docs/productization/PHASE_B_01_API_GATEWAY.md`) was
**not present on `main`** when this work landed. Auth HTTP is therefore a
**mountable dispatcher**, not a second API runtime. Prompt 3 should mount
`dispatchAuthHttp` on the canonical gateway when that runtime merges.

---

## 1. Distinctions (do not collapse)

| Question | Owner | Outcome |
| --- | --- | --- |
| Who is this user? | `AuthenticationService` | Session + ActorContext |
| What may this user do? | `deriveCapabilities` + Prompt 3 | Capabilities / ActionIntent |
| May this regulated action execute? | Compliance Kernel | Execution Authority |

A successful login is not Kernel ALLOW. Registration is not KYC.
Frontends cannot select `userId` / `identityId` / `actorId`.
AI runtimes cannot mint authenticated sessions.

---

## 2. Authentication architecture

**Canonical owner:** `packages/identity` (ACTIVE_CANONICAL).

Do not create `packages/auth`, `packages/authentication`, or a second
identity model.

| Piece | Path |
| --- | --- |
| Auth service | `packages/identity/src/authentication-service.ts` |
| Identity orchestrator | `packages/identity/src/service.ts` |
| Session / device types | `packages/identity/src/auth.ts` |
| Password KDF | `packages/identity/src/password.ts` (`scrypt` via `node:crypto`) |
| TOTP | `packages/identity/src/totp.ts` (RFC 6238 HMAC-SHA1) |
| Tokens | `packages/identity/src/tokens.ts` |
| Device / session store | `IdentityService` + `AuthenticationStore` |
| HTTP dispatcher | `packages/identity/src/http/auth-http.ts` |
| Facade | `services/identity` |
| Persistence | `packages/persistence/src/identity/pg-auth-store.ts` |

`AuthenticationService` composes `IdentityService`. It does not replace it.

Registration creates a `PersonIdentity`, activates it so the user can
sign in, stores a login-handle lookup hash (email and/or phone), a
scrypt password digest, and a terms-version acknowledgement. KYC is
not recorded. Financial capabilities still require fresh KYC + strong
assurance (`deriveCapabilities`).

---

## 3. Session lifecycle

Authoritative session: `IdentitySession` in `IdentityService`.

Fields:

- `sessionId`, `subjectId` / `actorId`
- `issuedAt` (created), `lastUsedAt` (last seen), `expiresAt`, `revokedAt`
- `deviceId`, `authenticationStrength`, `factors`
- `ipHash`, `userAgentHash` (HMAC, not raw network data)
- `riskState`, `revocationState`

Server status is authoritative. Revoking a session sets
`revocationState=REVOKED` and `revokedAt`, revokes the refresh-token
family, and causes `authenticateRequest` to fail. Middleware never
trusts `userId` from the body.

TTL: session 8 hours (extended on refresh); access token 15 minutes.

---

## 4. Token lifecycle

**Access token** (`sr_at.*`): HMAC-SHA256 via `SESSION_SIGNING`. Claims
are `sid`, `aid`, `iat`, `exp`, `kv` only. No email, phone, or name.

**Refresh token** (`sr_rt.*`): CSPRNG opaque, stored as SHA-256 hash,
family-bound, rotatable. Reuse of a rotated token revokes the family
and the session (`REFRESH_REUSE` / `SUSPICIOUS_AUTHENTICATION`).

Signing material comes from `KeyProvider`. No production secrets are
committed. Simulation keys are generated in-process.

---

## 5. MFA

Canonical factor vocabulary already included `TOTP` and `PASSKEY`.

Implemented now:

- TOTP enroll / confirm / verify (RFC 6238, secret in AES-256-GCM envelope)
- Password + TOTP → `STANDARD` assurance
- Step-up challenges (`beginMfa` / `verifyMfa`)
- `requireAssurance(needed)` — no hardcoded beneficiary / withdrawal /
  Agent / Exchange limits in authentication code

Password-only login is `LOW`. Passkey remains `STRONG`. Passkey +
step-up remains `HIGH_ASSURANCE`.

---

## 6. Passkeys / WebAuthn

Existing interface: `WebAuthnRelyingParty` in `auth.ts`.

- **Simulation:** `SimulatedWebAuthnRelyingParty` (HMAC, labeled not FIDO2).
- **Production:** `ProductionWebAuthnRelyingParty` refuses completion.

Exact missing dependencies:

- `@simplewebauthn/server` — attestation / assertion / COSE / CBOR
- `@simplewebauthn/browser` — Lovable / consumer client

The repository has `node:crypto` ECDSA but no CBOR/COSE decoder.
Homegrown attestation parsing would fake cryptographic guarantees, so
production FIDO2 is explicitly blocked. Simulation passkey routes work
only while `ENVIRONMENT=simulation`.

---

## 7. Device trust

`RegisteredDevice` now includes first/last seen, `trustState`,
`revokedAt`, `riskState`, and `authenticationStrength`.

Clients may send an opaque `deviceRef`. The server issues `deviceId`.
A client-supplied `deviceId` is never treated as authenticated identity.
`BLOCKED` devices revoke their sessions and fail subsequent login with
that `deviceRef`. Trusting a device requires `STANDARD` assurance
(step-up), not a client flag.

---

## 8. Recovery

`beginRecovery` always returns `{ accepted: true }` — no user
enumeration. Challenges are short-lived (15 minutes), hashed, and rate
limited. Completion rotates the password, revokes all sessions and
refresh tokens, and emits security events. TOTP-enrolled accounts
require the TOTP code (high-risk recovery). No security questions.

---

## 9. Security events

Kind set: registration, login success/failure, MFA challenge/failure,
new device, device trusted/revoked, credential change, passkey added,
session revoked, recovery started/completed, suspicious authentication.

Stored in `AuthenticationStore` and emitted as
`IdentitySecurityRecorded` into the domain event log / evidence vault.
Payloads use identity/session/device ids and reason codes only.
Passwords, emails, TOTP secrets, and refresh tokens are not written.

---

## 10. API endpoints

Mount with `dispatchAuthHttp(auth, request)`.

| Method | Path |
| --- | --- |
| POST | `/api/v1/auth/register` |
| POST | `/api/v1/auth/login` |
| POST | `/api/v1/auth/logout` |
| POST | `/api/v1/auth/refresh` |
| GET | `/api/v1/auth/sessions` |
| DELETE | `/api/v1/auth/sessions/:id` |
| DELETE | `/api/v1/auth/sessions/others` |
| GET | `/api/v1/auth/devices` |
| DELETE | `/api/v1/auth/devices/:id` |
| POST | `/api/v1/auth/devices/:id/trust` |
| POST | `/api/v1/auth/mfa/enroll` |
| POST | `/api/v1/auth/mfa/enroll/confirm` |
| POST | `/api/v1/auth/mfa/begin` |
| POST | `/api/v1/auth/mfa/verify` |
| POST | `/api/v1/auth/passkey/register/begin` |
| POST | `/api/v1/auth/passkey/register/complete` |
| POST | `/api/v1/auth/passkey/authenticate/begin` |
| POST | `/api/v1/auth/passkey/authenticate/complete` |
| POST | `/api/v1/auth/recovery/begin` |
| POST | `/api/v1/auth/recovery/complete` |
| POST | `/api/v1/auth/credentials/password` |
| GET | `/api/v1/auth/me` |
| POST | `/api/v1/auth/step-up/evaluate` |

Errors use the canonical envelope (`error_code`, `category`, `message`,
`retryable`, `details_safe_for_client`, `request_id`, `api_version`).

---

## 11. Frontend integration notes

1. Register with email/phone + password + `termsVersion`. Do not expect a session.
2. Login; if `{ status: "MFA_REQUIRED" }`, collect TOTP and call `/mfa/verify`.
3. Store access + refresh tokens in a first-party cookie or OS keystore — not
   as session authority in `localStorage` (freeze: frontend is not SoR).
4. Send `Authorization: Bearer <access>`. Never send `userId`.
5. On 401, try `/refresh`. On `REFRESH_REUSE`, force re-login.
6. Send a stable opaque `deviceRef` (install id). Ignore any local device UUID
   as server identity.
7. For sensitive UX, call `/step-up/evaluate` with the required assurance.
   Do not encode financial limits in the client.
8. Successful auth is not KYC and not Execution Authority.

---

## 12. Threat assumptions

- Attackers can replay stolen access tokens until expiry or revocation.
- Refresh-token theft is detected on reuse of a rotated token.
- Login-handle hashes are HMAC under `SESSION_SIGNING`; a key leak
  enables offline identifier confirmation.
- scrypt parameters (`N=16384,r=8,p=1`) resist casual brute force;
  they are not Argon2id.
- Simulated WebAuthn is not FIDO2.
- Rate limits are in-process and reset on restart (risk-aware /
  distributed limiter is later).
- Recovery tokens are not delivered over email/SMS in this prompt
  (no live notification provider). Tests use the simulation peek hook.

---

## 13. Remaining external dependencies

| Dependency | Why |
| --- | --- |
| `@simplewebauthn/server` + `@simplewebauthn/browser` | Production passkeys |
| Email / SMS provider | Out-of-band recovery and handle verification |
| Distributed rate-limit / risk engine | Cross-instance and risk-aware policies |
| Phase B Prompt 1 API runtime | Mount `dispatchAuthHttp` on the gateway |
| Prompt 3 authorization middleware | Capability / Kernel / Execution Authority |

---

## 14. Persistence

Migration: `db/customer/migrations/V029__consumer_authentication.sql`

Tables: `login_handle`, `password_credential`, `totp_credential`,
`refresh_session`, `auth_challenge`, `security_event`,
`terms_acknowledgement`, plus session/device column extensions.

No plaintext passwords, TOTP secrets, refresh tokens, or raw emails.

---

## 15. Production remains disabled

Do not flip `ENVIRONMENT`, `LIVE_*`, `PRODUCTION_READY`, or
`PRODUCTION_ACTIVE`. Do not connect a live IdP, email, or SMS vendor
from this package.
