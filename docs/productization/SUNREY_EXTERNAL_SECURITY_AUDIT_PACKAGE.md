# SunRey external security audit package

Engineering package for a future independent auditor.

**This document does not claim that an external independent audit has
been commissioned, executed, or passed.**

`EXTERNAL_AUDIT_COMPLETE=false`

---

## 1. What this package is

A map of canonical architecture, controls, and test evidence an auditor
would need to start a review of the simulation / preproduction candidate.

It is not:

- a SOC 2, ISO 27001, or PCI attestation
- a counsel opinion
- production authorization
- evidence that a commercial HSM exists

---

## 2. Architecture references

| Topic | Canonical reference |
| --- | --- |
| Constitution | `docs/architecture/constitution.md` |
| Manifest | `docs/architecture/manifest.json` |
| Authority map | `docs/productization/sunrey-authority-map.json` |
| Architecture freeze | `docs/productization/SUNREY_PRODUCTION_ARCHITECTURE_FREEZE.md` |
| Cryptographic ADR | `docs/architecture/adr/ADR-0009-cryptographic-infrastructure.md` |
| Root of trust | `docs/security/chunk-64-root-of-trust.md` |
| Production infrastructure | `docs/infrastructure/chunk-66-production-infrastructure.md` |
| Secrets / KMS / HSM | `docs/infrastructure/secrets-kms-hsm.md` |
| Network zones | `docs/infrastructure/network-zones.md` |
| Workload identity | `docs/infrastructure/workload-identity.md` |
| Security baseline | `docs/productization/SUNREY_SECURITY_BASELINE.md` |
| Threat model | `docs/productization/SUNREY_SYSTEM_THREAT_MODEL.md` |
| Pentest scope | `docs/productization/SUNREY_EXTERNAL_PENTEST_SCOPE.md` |
| Agent threat model | `docs/productization/SUNREY_AGENT_THREAT_MODEL.md` |
| Chain threat model | `docs/security/sunrey-blockchain-threat-model.md` |

## 3. Code owners the auditor should inspect

| Control | Path |
| --- | --- |
| SecretReference / KeyProvider | `packages/security/src/secrets.ts`, `provider.ts` |
| HSM/KMS port | `packages/security/src/hsm-kms.ts` |
| Production HSM gate | `packages/security/src/productization/posture.ts` |
| Credential plane | `packages/security/src/regulated/credentials` |
| Service identity / mTLS refs | `packages/security/src/identity.ts`, `src/productization/identity.ts` |
| Webhooks | `packages/security/src/regulated/webhook.ts` |
| Privileged access | `packages/security/src/productization/privileged.ts` |
| Identity / sessions | `packages/identity` |
| API / BFF | `services/api` |
| Persistence / DB roles | `packages/persistence/src/production` |
| Agent isolation | `packages/sunrey-agent/src/productization` |
| Chain infra zones | `packages/sunrey-chain/src/infra` |

## 4. Test evidence to attach

Run and retain output of:

```
npm run productization:preflight
npm run typecheck
npm test -- packages/security/src/productization.test.ts packages/security/src/security.test.ts packages/security/src/hsm.test.ts packages/security/src/regulated.test.ts
npm test -- packages/sunrey-agent/src/productization-invariants.test.ts
npm test -- packages/sunrey-exchange/src/productization
npm test -- packages/personal-data-vault
npm run scan:secrets
npm run testnet:sbom
npm run lint:architecture
```

Plus existing Agent, Exchange, and chain red-team suites. Those suites
are engineering tests. They are not an external audit.

## 5. Known external blockers (auditor should treat as open)

1. No commercial HSM / cloud KMS is connected
   (`PRODUCTION_HSM_KMS_CONFIGURED=false`).
2. No independent audit letter exists.
3. No external pentest report exists.
4. Container image digests are required for release but not all populated.
5. Live provider connectivity is forbidden by compiled flags.
6. Counsel-confirmed corridors are not present (and must not be marked
   `CONFIRMED_BY_COUNSEL` here).
7. Mainnet is off; genesis / production ceremony evidence is rehearsal.

An auditor marking those as “missing” is consistent with repository
truth.

## 6. Status

`EXTERNAL_AUDIT_COMPLETE=false`
`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
