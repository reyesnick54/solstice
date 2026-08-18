# Chunk 85 — SunRey production genesis ceremony package

This chunk implements the production-genesis and validator-onboarding
ceremony architecture required before a future authorized network
launch.

Owner: `packages/sunrey-chain/src/production-ceremony`.
Capability: `sunrey-production-genesis-ceremony`.

It does **not** launch mainnet. CI uses rehearsal and simulation
credentials only. Automated environments cannot create real production
private keys.

## What exists

- `ProductionGenesisCeremonyPlan` bound to one exact Mainnet RC and one
  exact Production Network Candidate V2 root hash
- Validator dossier, evidence, and acceptance states
- Strict key-purpose separation and fixture/testnet/rehearsal key
  rejection
- Simulation HSM attestation labeled `SIMULATION_ATTESTATION`
- Append-only hash-chained `ProductionCeremonyTranscript`
- Deterministic production-genesis candidate bytes and hash
- `ProductionGenesisAuthorizationPackage`
- `LaunchAuthorizationDossier` that does not execute a launch
- `sunrey-ceremony production` CLI and dress rehearsal

## Bindings

| Artifact | Expected id | Current tree |
| --- | --- | --- |
| Chunk 84 Mainnet RC | `SUNREY_MAINNET_RC_1` | Cryptographic manifest verified via `verifyMainnetReleaseCandidate` |
| Chunk 81 Candidate V2 | `SUNREY_PRODUCTION_NETWORK_CANDIDATE_2` | Canonical `createProductionNetworkCandidateV2` root hash |
| Chunk 82 provider acceptance | `ProductionProviderMatrix` | ENGINEERING_TESTED remains distinct from HUMAN_ACCEPTED / PRODUCTION_ELIGIBLE |
| Chunk 83 audit remediation | Chunk 83 review state | `TEST_FIXTURE_NOT_EXTERNAL_AUDIT` cannot satisfy external review |
| Chunk 71 allocation | `GenesisAssetAllocationManifest` | Production allocation remains unapproved / zero |
| Chunk 64 CryptoPolicy | production-candidate Ed25519 policy | No improvised PQ migration |
| Chunk 65 readiness | engineering feed only | Real ceremony remains EXTERNAL/HUMAN |

Changing the Mainnet RC or Candidate V2 hash requires a new plan
version.

## Dress rehearsal

Identity: `SunRey Production Genesis Ceremony Dress Rehearsal 1`

| Field | Value |
| --- | --- |
| Network ID | `net_sunrey_production_genesis_ceremony_rehearsal_1` |
| Chain ID | `chn_sunrey_production_genesis_ceremony_rehearsal_1` |
| Address HRP | `srpgc` |
| Candidate binding | `SUNREY_PRODUCTION_NETWORK_CANDIDATE_2` |
| RC binding | `SUNREY_MAINNET_RC_1` |

Dress-rehearsal keys, network ID, chain ID, genesis, and approvals are
unusable as real production inputs. Artifact IDs are the canonical
Chunk 81/84 identities; they are not locally constructed stand-ins.

## Eligibility

Deterministic states:

- `GENESIS_PACKAGE_INCOMPLETE`
- `GENESIS_ENGINEERING_READY`
- `AWAITING_EXTERNAL_EVIDENCE`
- `AWAITING_HUMAN_AUTHORIZATION`
- `GENESIS_AUTHORIZATION_PACKAGE_COMPLETE`

The package-complete state does not run production infrastructure.
`realProductionKeysCreated=false`. `mainnetEnabled=false`.

## CLI

```
sunrey-ceremony production plan
sunrey-ceremony production validators
sunrey-ceremony production participants
sunrey-ceremony production provider-check
sunrey-ceremony production contribute
sunrey-ceremony production attest
sunrey-ceremony production genesis
sunrey-ceremony production verify
sunrey-ceremony production transcript
sunrey-ceremony production authorization-dossier
sunrey-ceremony production rehearse
```

Chunk 64 commands (`sunrey-ceremony rehearse`, and the other
non-`production` commands) remain unchanged.
