# Authentication architecture

Owner: `packages/identity`

## Flows reviewed (Wave 6 Prompt 17)

| Flow | Implementation | Notes |
| --- | --- | --- |
| Registration | `AuthenticationService.register` | Does not imply KYC |
| Login | password + optional MFA | Rate limited (`auth-rate-limit.ts`) |
| OAuth | provider-candidate fixtures only | No live IdP in simulation |
| Session issuance | HMAC access token + opaque refresh | 15m / 30d TTL |
| Refresh | hash stored, reuse revokes family | `tokens.ts` |
| Logout | session revoke | |
| Password reset | uniform response (no enumeration) | `authentication-service.test.ts` |
| MFA (TOTP) | step-up capable | enrollment + verify |
| Device handling | server-issued deviceId | client ref not trusted |

## Token security tests

| Case | Result |
| --- | --- |
| Tampered signature | rejected |
| Expired access token | rejected |
| Wrong prefix/format | rejected |
| Replayed refresh (family) | family revoked |
| Revoked session | authenticateRequest fails |
| Revoked device | DEVICE_REVOKED |

## Session fixation

New session issued on authentication; refresh rotation on use. Client does not supply session identifiers as authority proof.

## CSRF

Primary API uses bearer tokens in `Authorization` header, not cookie session for mutations. CSRF is not applicable to bearer-authenticated JSON API routes. Any future cookie-authenticated routes must adopt SameSite + CSRF token per `SUNREY_SECURITY_BASELINE.md`.

## MFA capability

TOTP implemented. WebAuthn production path in `webauthn-production.ts` (candidate). Step-up required for high-risk Grow approvals.

## Evidence

```
npm test -- packages/identity/src/authentication-service.test.ts
npm test -- packages/identity/src/authorization.test.ts
npm test -- tests/wave-6-prompt-17-security-assurance.test.ts
```
