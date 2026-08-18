# Chunk 86 — SunRey production environment provisioning control plane

Owner: `packages/sunrey-chain/src/infra/provisioning` (extends Chunk 66).

This control plane deterministically prepares a future SunRey production
environment from approved Candidate V2 and Mainnet RC artifacts. It
does not activate mainnet, execute genesis, or enable `LIVE_*` flags.

## Bindings

The plan consumes the actual merged implementations:

- `ProductionNetworkCandidateV2` (`SUNREY_PRODUCTION_NETWORK_CANDIDATE_2`)
- `SUNREY_MAINNET_RC_1` cryptographic manifest
- Chunk 82 `ProductionProviderMatrix`
- Chunk 83 audit remediation state
- Chunk 65 `MainnetReadinessRegistry`

Engineering-tested providers remain distinct from `HUMAN_ACCEPTED` and
`PRODUCTION_ELIGIBLE`. Internal fixtures cannot satisfy external review.

## Environment classes

`LOCAL`, `TESTNET`, `MAINNET_REHEARSAL`, `PRODUCTION_CANDIDATE`, and
`PRODUCTION` are explicit. Automated CI uses non-production classes.
The `PRODUCTION` path requires a human-authorized deployment package.

## Invariants

- Plan first. No external mutation without an approved plan hash.
- Semantic plan hash excludes local timestamps.
- Plans may contain `SecretReference` IDs, never secret values or private keys.
- Floating container references do not qualify.
- Validators receive signer references, not private-key values.
- Default-deny network policy remains authoritative.
- Genesis execution is not part of this chunk.
- Customer capabilities stay independently gated.

`productionAuthorized=false`. `mainnetEnabled=false`.
