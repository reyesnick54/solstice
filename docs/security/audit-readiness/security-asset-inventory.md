# Security asset inventory

Wave 6 Prompt 17 internal inventory. Maps sensitive assets to lifecycle stages.

**Legend:** E=enters, S=stored, P=processed, T=transmitted, L=logged, D=deleted/retained

## Identity and access

| Asset | Owner | E | S | P | T | L | D |
| --- | --- | --- | --- | --- | --- | --- | --- |
| User identities | `packages/identity` | registration/OAuth | PostgreSQL identity DB | session resolution | TLS API | actorId only; PII redacted | retention per policy |
| Password hashes | `packages/identity` | login | auth store (argon) | verify only | never plaintext | never | rotate on change |
| MFA secrets (TOTP) | `packages/identity` | enrollment | encrypted store | verify | never export | never | revoke on disable |
| Access tokens | `packages/identity` | login/MFA | not stored (stateless HMAC) | every request | Authorization header | redacted | expire 15m |
| Refresh tokens | `packages/identity` | login | SHA-256 hash only | rotate/reuse detect | HTTPS body | redacted | revoke on logout/reuse |
| Sessions | `packages/identity` | auth | session store | capability bind | cookie/bearer | sessionId only | explicit revoke |
| Device bindings | `packages/identity` | login | device registry | trust checks | API | deviceId | revoke per device |
| Admin privileges | `packages/identity` staff | operator login | role grants | step-up gates | admin surface | audit events | SoD enforced |

## Financial

| Asset | Owner | E | S | P | T | L | D |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Ledger journals | `packages/ledger` | Kernel ALLOW | PostgreSQL ledger | balance read | internal only | journal refs | append-only |
| Account positions | `services/accounts` | open/deposit | accounts DB | orchestration | API (aggregated) | no stored balance field | close per policy |
| Execution Authority | `packages/permissions` | Kernel issue | not persisted raw | verify before mutate | internal HMAC | authority id only | TTL expiry |
| Grow proposals | `packages/platform/grow` | server generation | grow store | approval bind | API | proposal id/hash | versioned supersede |
| Payment orders | `packages/payments` | user intent | persistence | state machine | provider sandbox | corridor id | terminal states |

## Personal / regulated data

| Asset | Owner | E | S | P | T | L | D |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HIN records | `packages/information-market` | consent flows | PDV envelope | read via consent | API scoped | redacted (Prompt 17) | subject erase |
| Health reference data | `packages/external-data` wave6 | provider fixture | cache | normalization | sandbox HTTP | redacted | TTL cache |
| KYC metadata | `packages/identity` | provider callback | identity DB | compliance | internal | redacted fields | legal hold |
| PDV objects | `packages/personal-data-vault` | subject upload | encrypted blob | decrypt at port | never public chain | never plaintext | subject-bound delete |

## Provider and cloud credentials

| Asset | Owner | E | S | P | T | L | D |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Bank provider creds | `packages/payments` | secret manager ref | `secret://` only | adapter auth | TLS to approved host | redacted | rotate per class |
| Investment provider creds | `packages/investments` | config ref | SecretReference | quote/execute | sandbox | redacted | rotate |
| Custody credentials | `packages/custody` | HSM ref | provider-candidate | withdrawal workflow | mTLS refs | redacted | ceremony rotate |
| AI provider keys | `packages/ai-runtime` | env/secret ref | SecretReference | inference only | egress policy | never prompt dump | rotate |
| Database credentials | `packages/persistence` | deploy mount | external secret mgr | pool | private network | never | rotate |
| Cloud/service creds | `packages/security` | bootstrap | KMS/Vault port | workload identity | mTLS | redacted | automated rotate |
| Webhook signing keys | `packages/security` | provision | SecretReference | verify inbound | HTTPS | redacted | versioned |

## Cryptographic material

| Asset | Owner | E | S | P | T | L | D |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Session signing keys | `packages/security` | ceremony | KeyProvider | token sign/verify | N/A | key version only | rotate overlap |
| Wallet keys | `packages/custody` / chain wallet | user ceremony | HSM contract | sign only | RPC never exports | never | revoke |
| Validator keys | `packages/sunrey-chain` | genesis ceremony | validator zone | consensus | P2P | pubkey only | ceremony rotate |
| Interop keys | `packages/sunrey-chain/rust/interop` | ceremony | relayer/signer split | packet sign | bridge channel | key id | revoke list |
| PQC hybrid envelopes | `packages/sunrey-chain/pqc` | wire | local keystore sim | verify | chain/RPC | alg id only | alg downgrade blocked |

## Operations

| Asset | Owner | E | S | P | T | L | D |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Audit logs | `packages/evidence` | every Kernel decision | hash-chained vault | verify | internal | structured | immutable |
| Security events | `packages/identity` | auth failures | events store | SIEM port | internal | redacted | retention policy |
| Merchant identities | `packages/access-economy` | onboarding | merchant registry | offer auth | API | merchant id | suspend/delete |
| Provider certification artifacts | chain oracles | sandbox test | certification store | conformance | internal | pass/fail | versioned |

## Prohibited storage patterns (enforced)

- Plaintext API keys in config (`packages/security` productization refuses)
- Balances on Account objects (ledger read only)
- Raw credentials in domain packages
- Private keys in git (secret scan CI gate)
