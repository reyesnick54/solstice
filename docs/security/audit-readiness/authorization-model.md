# Authorization model

## Principles

1. Authorization context is **server-owned** (`deriveAuthorizationContext`).
2. Client-supplied `userId`, `accountId`, or roles are never proof of ownership.
3. Capabilities are monotonic narrow from mandates/tokens.
4. Financial mutations require Kernel ALLOW + Execution Authority verification.

## Isolation surfaces

| Surface | Isolation mechanism | Test |
| --- | --- | --- |
| User ↔ user | subject/customer ownership registry | `authorization.test.ts`, phase-c |
| Merchant ↔ merchant | merchant scoped credentials | access-economy tests |
| Admin | staff roles + step-up | `packages/identity/src/staff` |
| Financial actions | capability + Kernel | phase-c-security |
| Grow proposals | server-generated, versioned | grow.test.ts |
| Exchange orders | eligibility + surveillance ports | exchange productization tests |
| Access Economy | entitlement ports | access chaos tests |
| Wallet ops | custody state machine | custody tests |
| Provider status | read-only public fixtures | provider certification |
| Build/admin | feature flags + simulation gates | config tests |

## IDOR / BOLA

`ResourceOwnershipRegistry.assertOwnedBySubject` is the canonical pattern.
Consumer orchestrator calls `accounts.authorizeRead` before returning account data.

Changing an ID in the URL or body must not grant access to another subject's resources.

## Agent isolation

`packages/sunrey-agent` cannot import Execution Authority. Proposals ≠ ActionIntent.

## Evidence

```
npm test -- packages/identity/src/authorization.test.ts
npm test -- tests/phase-c-security.test.ts
npm test -- packages/sunrey-agent/src/productization-security.test.ts
```
