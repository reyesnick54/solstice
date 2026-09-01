# Deployment assumptions and hardening

## Represented in repository

| Control | Evidence |
| --- | --- |
| `ENVIRONMENT=simulation` | `packages/config/src/flags.ts`, Dockerfile |
| `PRODUCTION_AUTHORIZED=false` | Dockerfile, `services/api/src/config.ts` |
| Non-root container user (65532) | `Dockerfile` |
| Security headers | `services/api/src/security.ts` |
| Body size limit | `services/api/src/security.ts` readBody |
| Health/readiness | `services/api` server tests |
| Request timeout | config |
| CORS | API config (explicit origins) |
| Secret scan CI | `scripts/secret-scan.py` |
| Kernel gating CI | `scripts/check-kernel-gating.mjs` |

## External controls (not in repo — auditor must verify)

| Control | Required for production |
| --- | --- |
| TLS termination / cert management | Yes |
| WAF / DDoS edge | Recommended |
| Cloud KMS / HSM | Yes (`PRODUCTION_HSM_KMS_CONFIGURED` currently false) |
| Database encryption at rest | Infrastructure |
| Network segmentation (zones) | `docs/infrastructure/network-zones.md` |
| SIEM / log aggregation | Operations |
| Backup encryption | `BACKUP_ENCRYPTION` key class |

## Debug surfaces

- `featureFlags.testRoutes` — test only, not production default
- Control room read-only in adversarial range invariants
- No stack traces in API error envelope (verified in tests)

## Container image

Single `Dockerfile` for platform API. Slim base, curl for healthcheck only.
No embedded secrets. `SOURCE_COMMIT` build arg for traceability.

## Environment validation

`validatePlatformApiConfig` fails on production flag mismatch.
