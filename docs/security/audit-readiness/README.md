# SunRey security audit-readiness package

**Wave 6 Prompt 17 — internal security assurance evidence**

This package prepares an independent security firm to begin assessment.
It does **not** claim independent audit completion, penetration-test
certification, or `SECURITY_CERTIFIED` status.

## Status

| Flag | Value |
| --- | --- |
| `INTERNAL_SECURITY_REVIEW_COMPLETE` | `true` (engineering pass, 2026-08-31) |
| `INDEPENDENT_AUDIT_REQUIRED` | `true` |
| `PENETRATION_TEST_REQUIRED` | `true` |
| `BLOCKED_BY_FINDING` | `false` |
| `SECURITY_CERTIFIED` | `false` |
| `EXTERNAL_AUDIT_COMPLETE` | `false` |

See `build-status.json` for machine-readable status.

## Contents

| Document | Purpose |
| --- | --- |
| [security-asset-inventory.md](./security-asset-inventory.md) | Sensitive assets and lifecycle |
| [trust-boundaries.md](./trust-boundaries.md) | Trust zones and crossing controls |
| [threat-model-stride.md](./threat-model-stride.md) | STRIDE + domain-specific threats |
| [data-flows.md](./data-flows.md) | Primary data movement |
| [auth-architecture.md](./auth-architecture.md) | Login, session, MFA, tokens |
| [authorization-model.md](./authorization-model.md) | Capability and ownership model |
| [financial-action-model.md](./financial-action-model.md) | Grow / Kernel / EA binding |
| [interop-security.md](./interop-security.md) | Bridge, relayer, replay controls |
| [provider-security-model.md](./provider-security-model.md) | Egress, webhooks, credentials |
| [ai-security-boundary.md](./ai-security-boundary.md) | Inference isolation |
| [deployment-assumptions.md](./deployment-assumptions.md) | Container, TLS, external controls |
| [sbom-generation.md](./sbom-generation.md) | CycloneDX build instructions |
| [test-instructions.md](./test-instructions.md) | Reproducible security commands |
| [known-risks.md](./known-risks.md) | Residual and external blockers |
| [vulnerability-register.json](./vulnerability-register.json) | Structured finding register |
| [../INDEPENDENT_SECURITY_AUDIT_SCOPE.md](../INDEPENDENT_SECURITY_AUDIT_SCOPE.md) | Recommended external scope |

## Canonical references (existing)

- Constitution: `docs/architecture/constitution.md`
- Security baseline: `docs/productization/SUNREY_SECURITY_BASELINE.md`
- System threat model: `docs/productization/SUNREY_SYSTEM_THREAT_MODEL.md`
- Blockchain threat model: `docs/security/sunrey-blockchain-threat-model.md`
- Agent threat model: `docs/productization/SUNREY_AGENT_THREAT_MODEL.md`
- Cryptographic inventory: `docs/security/cryptographic-inventory.md`
- External pentest scope: `docs/productization/SUNREY_EXTERNAL_PENTEST_SCOPE.md`

## Quick start for auditors

```bash
npm install
npm run security:test
npm run scan:secrets
npm run lint:architecture
npm run testnet:sbom
```

Internal Cursor/agent testing is **not** independent assurance.
