# Remediation evidence

`FindingRemediationPlan` records root cause, authority boundary,
proposed fix, migration and compatibility impact, security
assumptions, required tests, owner, and target release.

Crypto findings cannot be remediated with homegrown cryptography.
Fixes must use established primitives/providers and protocol
versioning.

Changes to consensus, cryptography, signer safety, native supply,
DVP, custody signing, or governance authority require heightened
review.

## Regression

Every reproducible finding should produce a regression test where
practical. `FindingRegressionEvidence` binds:

- finding ID
- test
- commit
- result
- artifact hash

Formal bindings remain bounded model verification. Fuzz bindings
add a minimized corpus entry. Adversarial bindings use an isolated
Chunk 57/76 scenario (`AUDIT-FINDING-REGRESSION`). Performance
comparison is recorded for critical hot paths. Correctness remains
more important than throughput.

## Bundle

`AuditRemediationBundle` hashes every included evidence artifact.
Changed findings or results invalidate the bundle. Secret material
is excluded.
