# Release verification

```
npm run sunrey-release -- verify
```

Inputs:

- artifact
- release manifest
- signature
- SBOM
- provenance

Checks:

| Check | Meaning |
| --- | --- |
| digest | artifact SHA-256 matches the signed digest and the manifest |
| signer | Ed25519 signature verifies under `ReleaseAuthority` |
| source-commit | provenance and manifest name the same commit |
| toolchain | pinned toolchain metadata is present |
| protocol-version | artifact is compatible with the declared protocol |
| network-compatibility | artifact is compatible with the named network |
| sbom | SBOM digest matches the manifest |
| provenance | provenance digest matches and subject digest equals the artifact |
| revocation | release status is `ACTIVE` |

A modified artifact after signing fails. An artifact paired with the
wrong SBOM or provenance fails. A random binary that only shares a
version string fails the Chunk 54 upgrade precheck.
