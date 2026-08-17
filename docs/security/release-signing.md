# Release signing

Signing uses the established Ed25519 suite from `packages/security`.
No invented algorithm.

## Local / test path

CI and developers use `localTestReleaseAuthority()`. The key is a
fixture derived from a labeled seed and is `NOT_FOR_PRODUCTION`.

## Production path

Production credential integration remains provider-controlled. This
repository does not embed a live Cosign, KMS, or HSM secret. The
`COSIGN_PORT` name on the existing testnet signing port is a port,
not a live integration.

## What is signed

- binaries / content-addressed artifacts
- container digest records
- release manifest
- SBOM / provenance bundle

## What signing is not

`ReleaseAuthority` does not change blockchain state, issue Execution
Authority, or replace validator / custody / wallet signers.

## Update process for Actions pins

1. Read the upstream action repository commit SHA for the intended
   version tag.
2. Update `.github/workflows/*.yml` to `uses: <action>@<sha>`.
3. Update `packages/sunrey-chain/supply-chain/action-pins.json` in the
   same PR.
4. Do not use floating `@stable` or unpinned major tags on
   security-sensitive workflows.
