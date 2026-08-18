# Chunk 83 — Independent security-review findings remediation

See [../audit/chunk-83-audit-remediation.md](../audit/chunk-83-audit-remediation.md).

Capability `sunrey-audit-remediation` is `IMPLEMENTED` at
`packages/sunrey-chain/src/audit/remediation`. This extends Chunk 62.
It does not create a second audit-bundle owner and does not claim
that an independent audit occurred.

Do not create `packages/audit-remediation` or
`packages/security-audit-v2`.
