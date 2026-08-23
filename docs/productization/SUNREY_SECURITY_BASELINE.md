# SunRey security baseline

Mandatory production controls for a future preproduction or production
deployment. This document is an engineering baseline.

It is **not** production authorization.

`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`PRODUCTION_HSM_KMS_CONFIGURED=false`
`LIVE_CONNECTIVITY_ENABLED=false`
`ENVIRONMENT=simulation`

Independent external audit completion is **not** claimed.

Canonical owner: `packages/security` at
`packages/security/src/productization`.

Do not create `packages/hsm`, `packages/pki`, `packages/zero-trust`,
or `packages/security-v2`.

---

## 1. Secrets

- Production configuration holds `secret://` `SecretReference` values only.
- Plaintext API keys, database URLs with passwords, PEM private keys, and
  `sk_live_` tokens are refused in configuration.
- Every class in `SECRET_CLASSES` has storage, access, rotation, audit,
  and environment requirements.
- Validator consensus keys are never general service secrets.

## 2. Encryption and key management

- Application signing and envelope encryption go through `KeyProvider`.
- HSM-class operations go through `HsmKmsProvider`. Private material is
  not exported.
- Future cloud KMS, secret manager, Vault, and HSM adapters implement
  those ports. No vendor SDK is hardcoded.

## 3. HSM / KMS

- `PRODUCTION_HSM_KMS_CONFIGURED` is compiled `false`.
- Software interfaces may be complete while the external service is absent.
- Production signing of Execution Authority, administration, validator,
  wallet, genesis, governance, and release purposes fails closed.
- `DevelopmentHsmSimulator` is not a launch key.

## 4. Key purpose separation

Trust domains are separate:

| Domain | Purposes / material |
| --- | --- |
| Session / token signing | `SESSION_SIGNING` |
| Provider auth | `PROVIDER_AUTHENTICATION`, `SERVICE_AUTHENTICATION`, `WEBHOOK_SIGNING` |
| Ledger / evidence | `EXECUTION_AUTHORITY_SIGNING`, `EVIDENCE_INTEGRITY` |
| Chain validator | consensus, proposal, P2P, genesis, governance |
| Chain wallet / custody | `WALLET_SIGNING` |
| TLS | `TLS_PRIVATE_KEY` secret class + mTLS certificate references |
| Encryption | `DATA_ENCRYPTION`, `BACKUP_ENCRYPTION` |
| Administration | `ADMINISTRATION_SIGNING` |

One compromised key must not authorize another domain.

## 5. Rotation

- Versioned rotation with overlapping verification.
- Session rotation does not invalidate all sessions without policy.
- Historical envelopes decrypt at their `keyVersion` until retire.
- Validator rotation is a ceremony and does not break historical verify.
- Emergency revocation requires a recorded reason.

## 6. Service identity and internal transport

- Distinct service identity per role. No shared universal internal API key.
- Approved methods: mTLS certificate identity (`secret://` cert/key refs)
  or short-lived service-specific credentials.
- No certificates or private keys are committed.

## 7. Network surfaces

Default deny. Explicit allows only.

| Surface | Typical peers |
| --- | --- |
| PUBLIC_API | INTERNAL_API |
| PUBLIC_RPC | sentry / finalized read path |
| INTERNAL_API | DATABASE, MESSAGE_QUEUE, custody API |
| ADMIN_OPERATIONS | INTERNAL_API after step-up |
| DATABASE | application roles only |
| MESSAGE_QUEUE | INTERNAL_API |
| VALIDATOR | signer, sentry |
| CUSTODY_KEY_SERVICES | custody / Exchange API only |
| MONITORING | health endpoints |

Public API and public RPC cannot reach databases, HSM, or admin.

## 8. Privileged access

Required: strong authentication, step-up, named role, short-lived session,
audit, no shared accounts.

Break-glass:

1. Named operator opens a recorded break-glass record with a reason.
2. Short TTL.
3. Close is recorded.
4. Usage is listable. Unrecorded break-glass is refused.

## 9. Database

- TLS `verify-full` for the production candidate.
- Separate migrator, application, and reader roles.
- No application connection as `postgres` / superuser / bootstrap.
- Migrator does not serve traffic.
- Backup encryption required.
- Credentials are secret references, not inline passwords.

## 10. Application, webhook, chain, Agent

- Authentication and authorization are distinct from Kernel ALLOW.
- CORS wildcard is forbidden on production/staging authenticated APIs.
- IDOR and privileged mass assignment are refused.
- Webhooks require signature, timestamp, replay protection, environment
  match, raw-body hash, idempotency, and the canonical domain state machine.
- Mainnet remains off. RPC cannot reach HSM.
- Agent context cannot contain secrets, provider credentials, private
  keys, or Execution Authority. Privileged tools cannot be injected.

## 11. Containers and supply chain

- Minimal / distroless bases where used.
- Non-root user.
- Health checks.
- No baked secrets.
- Release images require digest pins
  (`packages/sunrey-chain/supply-chain/image-pins.json`).
- GitHub Actions are SHA-pinned.
- SBOM command: `npm run testnet:sbom`.
- Full bit-for-bit reproducible build is not claimed.

## 12. External gates (still open)

- External independent security audit
- External penetration test
- Commercial HSM / KMS evidence
- Counsel-confirmed corridors
- Live provider connectivity

Those gates remaining open is the correct state.
