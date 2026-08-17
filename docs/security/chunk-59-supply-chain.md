# Chunk 59 — SunRey software supply-chain security

Canonical owner: `packages/sunrey-chain` (`src/supply-chain`).

This chunk hardens the SunRey testnet software supply chain. It extends
the Chunk 53 SBOM and release-manifest foundations. It does **not**
create `packages/supply-chain`, a second ledger, or a second Kernel.

`ENVIRONMENT` stays `simulation`. `LIVE_*` flags stay false. No real
bank, FX, or payment-provider network calls are added.

## What is implemented

- Machine-readable `DependencyPolicy` (`APPROVED`, `REVIEW_REQUIRED`,
  `TEMPORARY_EXCEPTION`, `BLOCKED`)
- Committed lockfile enforcement for npm and Cargo
- Local dependency audit classification (advisory, unmaintained,
  license, yanked, duplicate-risk)
- License inventory that flags review without making legal conclusions
- CycloneDX SBOMs for node, RPC, Explorer, faucet, relayer, SDK,
  Exchange, and custody artifacts
- in-toto / SLSA-shaped provenance metadata
- Two-builder comparison that never claims reproducibility on mismatch
- Pinned toolchains, Actions, and container pin file
- `ReleaseAuthority` for artifact signing only
- `sunrey-release` commands: build, sbom, provenance, sign, verify,
  compare-builds
- Append-only release history with `ACTIVE` / `SUPERSEDED` / `REVOKED`
- Chunk 54 upgrade precheck artifact-identity check
- Chunk 40 `UpgradePlan` hash references without protocol activation

## ReleaseAuthority is not Execution Authority

`ReleaseAuthority` signs binaries, images, SBOMs, provenance, and the
release manifest. It cannot:

- issue Execution Authority
- post a ledger journal
- vote as validator governance
- sign custody or wallet material
- activate an `UpgradePlan`

Software release approval is not blockchain governance.

## Failure policy

| Finding | CI effect |
| --- | --- |
| BLOCKED package | fail |
| Unregistered crypto primitive library | fail |
| Missing / unlocked lockfile | fail |
| Known high advisory | fail |
| Yanked dependency | fail |
| License flagged for review | report (not a legal conclusion) |
| Unmaintained warning | warn |
| Duplicate-risk warning | warn |

Popularity is not a security signal.
