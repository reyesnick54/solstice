# Phase I Prompt 2 — Security hardening, HSM/KMS, secrets, PKI, and zero-trust service identity

Productization record for backend Phase I Prompt 2.

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains `false`.
`PRODUCTION_HSM_KMS_CONFIGURED=false`.
`PRODUCTION_READY=false`.
`PRODUCTION_ACTIVE=false`.

Phase I Prompt 1 did not have a productization record on `main` when
this work landed. Prompt 2 proceeds because the protected capabilities
it extends — `KeyProvider`, `SecretReference`, `HsmKmsProvider`, Chunk 64
root of trust, Chunk 66 infrastructure, and Chunk 149 credentials — are
already `IMPLEMENTED`. This prompt does not start Prompt 3.

---

## 1. Findings before modification

| Area | Finding |
| --- | --- |
| Secret handling | Canonical `SecretReference` existed; plaintext still possible in ad-hoc config |
| HSM/KMS | Port + simulators existed; no `PRODUCTION_HSM_KMS_CONFIGURED` gate |
| Key purposes | Application vs chain split existed; TLS / admin / provider domains needed explicit crossing checks |
| Service identity | Registry existed with a narrow role set |
| mTLS | Provider auth method existed; no deployable certificate-identity object |
| Network | Chunk 66 zones existed; prompt surfaces (PUBLIC_API, DATABASE, …) were not listed together |
| Privileged access | Auth step-up existed; break-glass recording did not |
| Database | Production profile has TLS and roles; superuser refusal needed a first-class assert |
| Webhooks | Signature / replay existed; environment binding on the guard was incomplete |
| External audit | Correctly not claimed |

## 2. What was extended

Canonical owner: `packages/security`. Reserved path:
`packages/security/src/productization`.

Also extended:

- `packages/security/src/purposes.ts` — `PROVIDER_AUTHENTICATION`, `ADMINISTRATION_SIGNING`
- `packages/security/src/identity.ts` — additional service roles / capabilities
- `packages/security/src/regulated/webhook.ts` — environment binding
- `packages/config/src/flags.ts` — `PRODUCTION_HSM_KMS_CONFIGURED=false`
- `packages/persistence/src/production/database-security.ts`
- `scripts/check-production-safety.mjs` — gate must remain false

No parallel security, HSM, PKI, or zero-trust package was created.

## 3. What remains external

- Actual HSM/KMS connection: **no**
- Independent audit: **no**
- External pentest execution: **no**
- Populated container digests for every image
- Live providers, mainnet, counsel-confirmed corridors

## 4. Documents

- `docs/productization/SUNREY_SECURITY_BASELINE.md`
- `docs/productization/SUNREY_SYSTEM_THREAT_MODEL.md`
- `docs/productization/SUNREY_EXTERNAL_PENTEST_SCOPE.md`
- `docs/productization/SUNREY_EXTERNAL_SECURITY_AUDIT_PACKAGE.md`

## 5. Tests

`packages/security/src/productization.test.ts` covers privilege
escalation, IDOR, cross-user/admin boundary, secret leakage, invalid
and replayed webhooks, provider environment crossing, key-purpose
crossing, Agent secrets, RPC/HSM boundary, and missing production HSM.

`SAFE_TO_PROCEED_TO_PHASE_I_PROMPT_3` is recorded only after those
suites and the production-safety gate remain green.

Prompt 2 does not start Prompt 3.
