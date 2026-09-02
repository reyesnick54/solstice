# SunRey Data Security Matrix

**Version:** 1.0.0-wave9  
**Status:** Engineering inventory — not legal classification  
**Companion:** `docs/security/WAVE9_PRIVACY_AND_IDENTITY_SECURITY_REPORT.md`, `packages/personal-data-vault/src/taxonomy.ts`, `docs/architecture/WAVE7_PRIVACY_PRESERVING_DATA_ACCESS.md`

---

## Sensitivity classification (Wave 7 policy)

Engineering tiers from `packages/personal-data-vault/src/taxonomy.ts`:

| Tier | Meaning | Examples |
| --- | --- | --- |
| `PERSONAL` | Identifiable personal data | preferences, device summaries |
| `SENSITIVE` | Higher-impact personal data | financial transactions, payroll |
| `HIGHLY_SENSITIVE` | Special-category or biometric-adjacent | health, genetic, biometrics |
| `RESTRICTED` | Highest internal tier | secrets, key material references |

Product overlay (`packages/personal-data-vault/src/product/classification.ts`) adds `PUBLIC` and `SECRET`. PDV DB enforces the four core tiers on `asset.sensitivity`.

---

## Data inventory by store

### PostgreSQL — `customer` database

| Table / area | Migration | Primary data | Sensitivity | Encryption | Retention |
| --- | --- | --- | --- | --- | --- |
| `identity.*` | V002 | sessions, KYC metadata, device bindings | SENSITIVE | password/TOTP hashed; tokens not stored plaintext | policy-driven |
| `economic_graph.*` | V009, V034 | pseudonymous nodes, edges, facts | SENSITIVE | metadata at rest via DB | subject lifecycle |
| `personal_data_vault.*` | V019, V039 | asset metadata, ciphertext payloads | SENSITIVE–RESTRICTED | envelope encryption; no plaintext payload column | tombstone + policy |
| `consent.*` | V020, V038 | grants, revocations, permits, audit | SENSITIVE | signed receipts; `raw_value_logged = FALSE` | immutable ledger |
| `clean_room.*` | V021 | session/job metadata, aggregate receipts | SENSITIVE | no row export by default | job TTL |
| `information_market.*` | V023 | HIN metadata, opportunities | SENSITIVE | `source_record_revealed = FALSE` | subject rights |
| `sunrey_chain.*` | V024 | simulation chain state | PUBLIC–SENSITIVE | commitment-only payloads | append-only |
| `agent_runtime.*` | V037 | mandate/snapshot metadata | SENSITIVE | minimized writes required | versioned |
| `consumer_auth.*` | V029 | auth factors (no plaintext secrets) | RESTRICTED | argon hashes, token hashes | rotate on change |

### PostgreSQL — `ledger` database

| Table / area | Migration | Primary data | Sensitivity | Notes |
| --- | --- | --- | --- | --- |
| `journal`, `posting` | V001+ | monetary journals | SENSITIVE | append-only; Kernel-gated |
| `event_fabric`, `outbox` | V002+ | durable domain events | SENSITIVE | `assertSafeEventPayload` on seal |
| `async_fabric` | V007+ | async operation state | SENSITIVE | no PII by contract |

### PostgreSQL — `evidence` database

| Table | Migration | Primary data | Sensitivity | Notes |
| --- | --- | --- | --- | --- |
| `evidence_record` | V001 | hash-chained Kernel/compliance evidence | SENSITIVE | commitments and refs only |

### PostgreSQL — `security` database

| Table | Migration | Primary data | Sensitivity | Notes |
| --- | --- | --- | --- | --- |
| key metadata | V001–V002 | key IDs, purposes, descriptor refs | RESTRICTED | no private key bytes |

### PostgreSQL — `explorer` database

| Table | Migration | Primary data | Sensitivity | Notes |
| --- | --- | --- | --- | --- |
| explorer index | V001 | public chain projection | PUBLIC | `ExplorerExposurePolicy` default-deny |

---

## Events

| Surface | Owner | Sensitivity | Controls |
| --- | --- | --- | --- |
| Durable envelope | `packages/events` | SENSITIVE | recursive `assertSafeEventPayload`; simulation-only environment |
| Outbox / inbox | `db/ledger` | SENSITIVE | same envelope contract |
| Taxonomy | `api/sunrey-events-v1.md` | — | schema refs; no raw provider bodies |

---

## Graph

| Surface | Owner | Sensitivity | Controls |
| --- | --- | --- | --- |
| PEG nodes/edges/facts | `packages/personal-economic-graph` | SENSITIVE | `VIEW_ECONOMIC_GRAPH` + subject match |
| Economic knowledge graph | `db/customer` V041 | SENSITIVE | commitment refs; no raw HIN |
| Projections | `projection.ts` | SENSITIVE | minimized event-driven projection |

---

## Cache

| Surface | Owner | TTL class | Controls |
| --- | --- | --- | --- |
| Provider response caches | `packages/external-data` | ~90 days per asset inventory | fixture/sandbox only; no live egress |
| HTTP/SWR caches | services/api | TEMPORARY_CACHES (7-day category) | no credential keys in cache keys |
| Clean-room ephemeral rows | `packages/clean-room` | session-scoped | never persisted; egress aggregate-only |

---

## Logs, traces, metrics

| Surface | Owner | Sensitivity | Controls |
| --- | --- | --- | --- |
| API structured logs | `services/api/src/logging.ts` | SENSITIVE | `redactRecord` |
| Canonical safe logging | `packages/security/src/safe-logging.ts` | SENSITIVE | key/value pattern redaction |
| Provider transport errors | `packages/provider-sdk/src/redaction.ts` | RESTRICTED | URL/query secret strip |
| Rail metrics labels | `packages/payments/src/rail-metrics.ts` | — | no PII in labels by contract |
| Admin audit | `packages/security/src/productization/admin-audit.ts` | SENSITIVE | sealed privileged actions |

---

## Blockchain state

| Surface | Owner | Sensitivity | Controls |
| --- | --- | --- | --- |
| Block payloads | `packages/sunrey-chain` | PUBLIC commitments | `scanForForbiddenBlockPayload`, ADR-0030 |
| HIN anchors | `packages/information-market/.../chain-anchor` | PUBLIC commitments | `HIN_ANCHOR_FORBIDDEN_KEYS`; `RAW_PERSONAL_DATA_ON_CHAIN: false` |
| Wallet push | `packages/sunrey-chain/.../push.ts` | — | forbidden push markers |
| Explorer projection | `packages/sunrey-explorer` | PUBLIC | default-deny field policy |

---

## Evidence Vault

| Surface | Owner | Sensitivity | Controls |
| --- | --- | --- | --- |
| In-memory vault | `packages/evidence` | SENSITIVE | hash-chained append |
| PostgreSQL evidence | `db/evidence` | SENSITIVE | mutation triggers blocked |

---

## Backups

| Class | Owner | Encryption required | Plaintext secrets allowed |
| --- | --- | --- | --- |
| `BLOCKCHAIN_STATE` | `packages/sunrey-chain/src/ops/backup.ts` | No | No — state is public commitments |
| `SIGNER_SAFETY` | same | Yes (`BACKUP_ENCRYPTION`) | No |
| `POSTGRES_APPLICATION_DATA` | same | Yes | No — ciphertext + hashes |
| `CUSTODY_METADATA` | same | Yes | No |
| `ENCRYPTED_CONFIGURATION` | same | Yes | No vendor credentials in source |
| Evidence exports | ops runbooks | Yes | No private keys |

---

## Capability classification summary

| Capability | Status | Privacy guarantee |
| --- | --- | --- |
| Claim-based disclosure | IMPLEMENTED | purpose-bound assertions |
| PDV envelope encryption | IMPLEMENTED | ciphertext at rest |
| Consent firewall | IMPLEMENTED | revocation blocks permits |
| Clean-room egress | PARTIAL | aggregate-only; engineering thresholds |
| Selective disclosure (SD-JWT/BBS+) | INTERFACE_ONLY | not a production guarantee |
| Verifiable credentials | INTERFACE_ONLY | fixture verifier only |
| Zero-knowledge proofs | INTERFACE_ONLY | port only |
| Differential privacy | INTERFACE_ONLY | not configured |
| BFF/API adapters | PARTIAL | assertion mapping in progress |

---

## Cross-reference

- Exposure surface catalog: `packages/personal-data-vault/src/disclosure/audit.ts`
- Asset lifecycle map: `docs/security/audit-readiness/security-asset-inventory.md`
- Retention model: `docs/architecture/SUNREY_DATA_RETENTION_AND_RESIDENCY_MODEL.md`
