# Software supply-chain incident runbook

Simulation / testnet operators only. This runbook does not authorize
mainnet, live rails, or counsel conclusions.

## Dependency vulnerability

1. Record the advisory identifier and the lockfile entry.
2. Classify with `sunrey-release audit` (`known_advisory`,
   `unmaintained_warning`, `yanked_dependency`, `license_issue`,
   `duplicate_risk_warning`).
3. If the package is cryptographic, confirm it is in the crypto
   inventory. Unregistered crypto is a fail.
4. Patch or remove the dependency. Commit the lockfile change.
5. Rebuild, regenerate SBOM/provenance, and sign a new release.
6. Mark the previous release `SUPERSEDED` or `REVOKED`.

## Compromised build credential

1. Treat the `ReleaseAuthority` credential as burned.
2. Do not reuse it for validator governance, custody, wallet, or
   Execution Authority — those are separate keys.
3. Rotate the provider-controlled production credential outside this
   repository.
4. Revoke every release signed with the burned identity.
5. Notify operators through upgrade tooling warnings.

## Malicious release artifact

1. Verify with `sunrey-release verify`. Tamper and SBOM mismatch must
   fail.
2. Revoke the release (`REVOKED`). Do not rewrite blockchain history.
3. Publish the replacement artifact hash. Chunk 40 `UpgradePlan`
   references that hash; release revocation alone does not activate
   a protocol change.

## Revoked release

Operators running `upgradePrecheck` receive a `release-revocation`
warning. Deployment of a `REVOKED` artifact must stop.

## Emergency operator notification

1. Seal evidence in the existing Evidence Vault / ops incident path.
2. Announce the release ID, artifact digest, and revocation status.
3. Do not instruct operators to run an unsigned binary because it
   “has the same version string.”
