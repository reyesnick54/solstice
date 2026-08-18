# SunRey independent security-review package

This directory is the reviewer-facing documentation for Chunk 62 and
the Chunk 83 findings-remediation workflow.

It prepares SunRey for independent review. It does **not** claim that
an external audit has occurred or passed.

Canonical implementation: `packages/sunrey-chain/src/audit`.
Do not create `packages/sunrey-audit`, `packages/audit`,
`packages/security-review`, or `packages/audit-evidence`.

## Commands

```bash
npm run sunrey-audit -- generate
npm run sunrey-audit -- verify dist/sunrey-audit
npm run sunrey-audit -- reproduce
npm run sunrey-audit -- readiness
```

## Documents

- [Reviewer guide](./reviewer-guide.md)
- [Scope](./scope.md)
- [Trust boundaries](./trust-boundaries.md)
- [Control catalog](./control-catalog.md)
- [Known limitations](./known-limitations.md)
- [Finding lifecycle](./finding-lifecycle.md)
- [Reproduction](./reproduction.md)
- [Chunk 83 remediation](./chunk-83-audit-remediation.md)
- [Remediation evidence](./remediation-evidence.md)
- [External retest](./external-retest.md)
- [Security risk acceptance](./security-risk-acceptance.md)

## Status

`AuditReadinessReport` is an engineering package status:

- `READY_FOR_EXTERNAL_REVIEW`
- `READY_WITH_KNOWN_LIMITATIONS`
- `MISSING_REVIEW_ARTIFACT`

Current classification is `READY_WITH_KNOWN_LIMITATIONS` because
formal machine-checked proofs, production HSM integration, and
production cryptographic approval are not completed, and no external
audit is claimed.
