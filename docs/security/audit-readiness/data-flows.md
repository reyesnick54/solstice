# Primary data flows

## Consumer login → account read

1. Client POST `/auth/login` → Identity verifies password/MFA
2. Issues access + refresh tokens (HMAC, opaque hash)
3. Client GET `/api/v1/accounts/{id}` with bearer
4. API resolves session → authorization context
5. Orchestrator `authorizeRead(accountId, customerId, subjectId)`
6. Accounts service reads ledger-derived balance
7. Response envelope; no stack traces; logs redacted

## Grow investment execution

1. Server generates proposal from PEG/mandate (not client body)
2. User approves with step-up when required
3. Approval binds `proposalContentHash` + version
4. Execution command created with idempotency key
5. `revalidateBeforeExecution` checks live facts
6. Kernel submit → ALLOW issues scoped Execution Authority
7. Ledger post via `postJournal` only with verified EA

## Provider outbound quote

1. Service requests quote via provider-sdk transport
2. Destination built from approved base URL only
3. SSRF policy enforced before fetch
4. Response normalized; secrets redacted in logs
5. No direct ledger write from provider adapter

## HIN consent read

1. Subject consent checked at PDV/consent ports
2. Encrypted payload decrypted inside vault boundary
3. API returns scoped fields only
4. HIN fields redacted if logged (Prompt 17)

## Chain interop (simulation)

1. Foreign header submitted to interop engine
2. Chain ID + genesis + proof verified
3. Relayer signs with isolated key material
4. Packet state prevents replay

Sensitive data must not appear on public chain (PII, credentials, raw HIN).
