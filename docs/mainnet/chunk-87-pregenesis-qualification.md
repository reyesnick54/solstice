# Chunk 87 — SunRey pre-genesis production qualification

This chunk implements an isolated Pre-Genesis Shadow Network that runs
the intended production topology, artifacts, and operational controls
using distinct rehearsal identities.

Owner: `packages/sunrey-chain/src/pregenesis`.
Capability: `sunrey-pregenesis-qualification`.

It does **not** launch production mainnet. Engineering qualification
is not legal or operator certification.

## Isolated identity

| Field | Value |
| --- | --- |
| Network ID | `net_sunrey_pregenesis_shadow_1` |
| Chain ID | `chn_sunrey_pregenesis_shadow_1` |
| Address HRP | `srpgn` |
| Banner | `PRE-GENESIS SHADOW NETWORK` |

Shadow keys, genesis, and network IDs are unusable as production
authorization. Production ceremony inputs reject them.

## Topology

Candidate V2 shape: 7 validators, sentries, remote signers, RPC,
Explorer, monitoring, backup, oracle collectors, database, and
Exchange/custody sandbox. Provisioning consumes the Chunk 66
infrastructure harness and Chunk 81 Candidate V2 topology. A dedicated
Chunk 86 production-provisioning package is not present on `main`;
`ProductionEnvironmentPlan` is assembled from that existing stack.

## Bindings

| Artifact | Binding |
| --- | --- |
| Chunk 84 Mainnet RC | Exact `SUNREY_MAINNET_RC_1` hash |
| Chunk 81 Candidate V2 | Exact `candidateRootHash` |
| Chunk 82 providers | Local simulated / sandbox / external coverage recorded without overstatement |
| Chunk 83 security review | Open blockers remain visible |
| Chunk 65 readiness | Engineering evidence only |

## Qualification states

- `PREGENESIS_QUALIFICATION_INCOMPLETE`
- `PREGENESIS_QUALIFIED_WITH_FINDINGS`
- `PREGENESIS_ENGINEERING_QUALIFIED`

None of these authorize mainnet. `mainnetEnabled=false`.

## CLI

```
npm run sunrey-ops -- pregenesis create
npm run sunrey-ops -- pregenesis deploy-rehearsal
npm run sunrey-ops -- pregenesis qualify
npm run sunrey-ops -- pregenesis health
npm run sunrey-ops -- pregenesis inject-failure NO_QUORUM_PARTITION
npm run sunrey-ops -- pregenesis recover NO_QUORUM_PARTITION
npm run sunrey-ops -- pregenesis burn-in
npm run sunrey-ops -- pregenesis report
npm run sunrey-ops -- pregenesis verify
```
