# SunRey frontend authentication guide

For a frontend implementer. Do not inspect internal packages.

`ENVIRONMENT` is `simulation`. Production flags stay false.

## How to authenticate

1. `POST /v1/consumer/auth/register` with `{ "home_jurisdiction": "GB" }`.
2. `POST /v1/consumer/auth/passkey/register/begin` with the `identity_id`.
3. Complete WebAuthn locally, then
   `POST /v1/consumer/auth/passkey/register/complete`.
4. Login: `begin` then `complete` on `/v1/consumer/auth/passkey/login/*`.
5. Store `access_token` as a Bearer token. Never persist server secrets.

Sandbox development only:

```
SUNREY_SANDBOX_PERSONAS=1
POST /v1/consumer/auth/sandbox/personas/{personaId}/session
```

Personas fail closed unless the runtime is simulation and the flag is
explicitly enabled. They are not available as a production bypass.

## Registration

Registration creates an `ACTIVE` person identity. It does not open a
bank account and does not issue Execution Authority. Next step is
always passkey registration.

## Login

Login is passkey-only. There is no password grant. TOTP enrollment is
not implemented; `GET /v1/consumer/auth/mfa` reports
`totp_enrolled: false`.

## Session lifecycle

- Server session TTL is eight hours.
- Access tokens are opaque and short-lived (15 minutes of ActorContext).
- `GET /v1/consumer/sessions` lists identity sessions.
- `DELETE /v1/consumer/sessions/{sessionId}` revokes one session.

## Refresh

`POST /v1/consumer/auth/refresh` with the current Bearer token.
If the underlying session is still `ACTIVE`, a new access token is
issued. If the session is expired or revoked, the API returns
`SESSION_EXPIRED` or `SESSION_REVOKED`. The user must sign in again.

The TypeScript client accepts `onUnauthorized` so the UI can refresh
or route to login.

## Logout

`POST /v1/consumer/auth/logout` revokes the current session. Subsequent
authenticated calls fail. Evidence of logout is sealed.

## MFA

Passkey is the implemented factor and yields `STRONG` assurance.
Step-up on sandbox personas that need financial grants uses the
existing Identity step-up path. TOTP is documented as unimplemented.

## Passkey flows

Use the begin/complete pair. Challenges expire. Replayed or mismatched
challenges return `PASSKEY_CHALLENGE_INVALID`.

## Device trust

`GET /v1/consumer/devices` lists devices.
`POST /v1/consumer/devices/{deviceId}/trust` sets
`KNOWN | TRUSTED | REVIEW_REQUIRED | BLOCKED`.
A blocked device revokes its sessions.

## Expired session behavior

Callers receive `401` with `SESSION_EXPIRED`. Do not retry as if the
user were still signed in. Refresh first; if refresh fails, send the
user to login.

## Account recovery

`POST /v1/consumer/auth/recovery` starts recovery. Completion requires
a high-assurance step-up session on the Identity service. There is no
support-agent bypass and no email magic-link in this API.

## What the frontend must never do

- Treat the access token as Execution Authority
- Calculate balances
- Write the ledger
- Store privileged server secrets
- Infer capabilities from Agent text
