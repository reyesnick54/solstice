# Chunk 83 — Independent security-review findings remediation

Chunk 90 carries unresolved findings and accepted risks forward across
production releases. A rehearsal is not an external audit. See
[../mainnet/chunk-90-production-handoff.md](../mainnet/chunk-90-production-handoff.md).


Canonical owner remains `packages/sunrey-chain/src/audit`.
Implementation lives at `packages/sunrey-chain/src/audit/remediation`.

This chunk extends Chunk 62. It does **not** create
`packages/audit-remediation`, `packages/security-audit-v2`, or another
audit-bundle owner.

Capability `sunrey-audit-remediation` is `IMPLEMENTED`.
`evaluateChunkRequirements` returns `mustStop: false`.

The workflow receives, triages, remediates, verifies, and packages
findings from an independent security review. Software does not claim
that an independent audit has occurred unless real external findings
and evidence are actually supplied.

Fictional fixtures are labeled `TEST_FIXTURE_NOT_EXTERNAL_AUDIT` and
never satisfy real external-review readiness.

## Commands

```bash
npm run sunrey-audit -- review import path/to/review.json
npm run sunrey-audit -- findings
npm run sunrey-audit -- finding show FND-…
npm run sunrey-audit -- finding reproduce FND-…
npm run sunrey-audit -- remediation FND-…
npm run sunrey-audit -- regression FND-…
npm run sunrey-audit -- retest-package FND-…
npm run sunrey-audit -- risk-acceptance
npm run sunrey-audit -- status
npm run sunrey-audit -- bundle
```

## Related documents

- [Finding lifecycle](./finding-lifecycle.md)
- [Remediation evidence](./remediation-evidence.md)
- [External retest](./external-retest.md)
- [Security risk acceptance](./security-risk-acceptance.md)
- [Runbook](../runbooks/security-finding-remediation.md)
