# Mainnet RC reproducibility

Where the build environment supports deterministic comparison, release
artifacts are compared across approved builders. Unavoidable
nondeterminism is reported explicitly.

## Verified in qualification

- SBOM generation and digest binding
- Provenance generation and digest binding
- Dependency policy audit
- Two-builder comparison of the frozen artifact digest set
- Signed release manifest
- Immutable (digest-pinned) container images; floating tags rejected

## Tamper detection

Changing a binary, container, policy, network candidate, provider
state, security finding, qualification result, known limitation, SBOM,
or provenance invalidates the signed bundle.

## What reproducibility is not

Reproducibility of the Mainnet RC bundle is not network activation,
not a production TPS guarantee, and not a substitute for human
release approval.
