# Known risks and external blockers

## Open (require external action)

1. **No independent audit letter** — engage firm per `INDEPENDENT_SECURITY_AUDIT_SCOPE.md`
2. **No penetration test report** — simulation candidate only
3. **No production HSM/KMS** — `PRODUCTION_HSM_KMS_CONFIGURED=false`
4. **Live provider connectivity disabled** — all `LIVE_*` false
5. **Mainnet inactive** — genesis/production ceremony is rehearsal
6. **Counsel-confirmed corridors absent** — unknown corridors `RESEARCH_REQUIRED`
7. **Edge WAF / cloud KMS / DB encryption at rest** — infrastructure outside repo

## Residual engineering risks (mitigated, not eliminated)

| Risk | Mitigation | External review |
| --- | --- | --- |
| Stolen access token | 15m TTL, revoke, MFA step-up | Session management review |
| Break-glass operator abuse | evidence + time bound | Admin surface pentest |
| Agent ALLOW misunderstanding | no EA issuance | AI red-team |
| Supply chain | lockfiles + scan + SBOM | dependency audit |
| Container image digests | release manifest | image scanning |

## False positive categories (static tools)

- Test fixtures with synthetic tokens (mitigated by dynamic construction)
- Documentation examples with placeholder `secret://` refs
- Simulation key material in `createSimulationKeyProvider` (non-production)

## Risk acceptance

Unresolved items in `vulnerability-register.json` with `status: open` are **not** accepted for production.
Items marked `accepted-risk-pending-external` require explicit external sign-off.

## Not claimed

- `SECURITY_CERTIFIED`
- `EXTERNAL_AUDIT_COMPLETE`
- PCI / SOC 2 / ISO 27001 attestation
