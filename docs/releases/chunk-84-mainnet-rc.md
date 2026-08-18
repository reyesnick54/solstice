# Chunk 84 — SunRey Mainnet release candidate

This document describes the first complete SunRey Mainnet Release
Candidate qualification system.

It creates a **Mainnet Release Candidate**. It does not launch
mainnet, enable `LIVE_*` flags, or convert engineering qualification
into production-network authorization.

`ENGINEERING_QUALIFIED` is not `AUTHORIZED_CANDIDATE`.

## Identity

Mainnet release candidates use versioned ids such as
`SUNREY_MAINNET_RC_1`. This extends the Chunk 63 / Chunk 78
release-candidate scheme. It is not a second release authority.

## Owner

Canonical owner: `packages/sunrey-chain/src/release-candidate/mainnet`.
The freeze now binds the actual Chunk 81
`SUNREY_PRODUCTION_NETWORK_CANDIDATE_2` root rather than a locally
constructed substitute. Chunk 86 verifies this cryptographic manifest
before planning infrastructure.

CLI:

```
npm run sunrey-release -- mainnet create --profile smoke
npm run sunrey-release -- mainnet qualify --profile smoke
npm run sunrey-release -- mainnet verify
npm run sunrey-release -- mainnet status
npm run sunrey-release -- mainnet compare
npm run sunrey-release -- mainnet limitations
npm run sunrey-release -- mainnet evidence
npm run sunrey-release -- mainnet supersede
```

Profiles:

- `smoke` — bounded PR/CI qualification
- `full` — complete current-repository qualification
- `extended` — scheduled/manual longer campaign; never claims a
  duration unless that duration actually completed

## Lifecycle

`DRAFT` → `ENGINEERING_QUALIFICATION` → `ENGINEERING_QUALIFIED` /
`AWAITING_EXTERNAL_EVIDENCE` / `AWAITING_HUMAN_AUTHORIZATION` →
`SUPERSEDED`.

No status implies network activation because tests passed.

## Frozen bindings

- Source commit, Rust/Node toolchains, lockfiles, generated protocol
  sources, container image digests, SBOM, provenance, release signature
- Transaction/block/consensus/validator/runtime/state/P2P/governance/
  crypto protocol freeze
- Chunk 78 economic RC policy hashes (SunRey, MoonRey, FeePolicyV2,
  validator economics, MoonRey issuance, protocol treasury)
- Production Network Candidate V2 root hash from the canonical Chunk 81
  candidate (`SUNREY_PRODUCTION_NETWORK_CANDIDATE_2`, domain
  `SUNREY_PRODUCTION_NETWORK_CANDIDATE_V2`)
- Chunk 82 ProductionProviderMatrix (engineering-tested remains distinct
  from HUMAN_ACCEPTED and PRODUCTION_ELIGIBLE)
- Chunk 83/62 security-review snapshot (fixtures cannot satisfy external review)
- Chunk 64 root-of-trust architecture; production ceremony evidence
  remains Chunk 85

## Qualification

The matrix covers the required engineering, economic, provider,
security, legal, and human-authorization categories. States are
`PASS`, `FAIL`, `PENDING`, `EXTERNAL_EVIDENCE_REQUIRED`,
`HUMAN_AUTHORIZATION_REQUIRED`, and `NOT_APPLICABLE`.

ReleaseAuthority signs the manifest, artifact digest set, SBOM,
provenance, and qualification report. The signature is not launch
authorization.

See [mainnet-qualification.md](./mainnet-qualification.md),
[mainnet-freeze-policy.md](./mainnet-freeze-policy.md),
[mainnet-known-limitations.md](./mainnet-known-limitations.md),
and [mainnet-reproducibility.md](./mainnet-reproducibility.md).
