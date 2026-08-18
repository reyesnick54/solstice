# Chunk 81 — SunRey Production Network Candidate V2

This chunk binds the complete engineering stack through Chunk 80 into
one deterministic, verifiable production-network candidate.

It does **not** launch mainnet, enable `LIVE_*` flags, assign public
tickers, or convert missing legal, regulatory, licensing, partner,
audit, commercial HSM, or human-authorization evidence into approved
evidence.

Owner: `packages/sunrey-chain/src/mainnet/candidate-v2`.
Capability: `sunrey-production-network-candidate`.

## Candidate identity

| Field | Value |
| --- | --- |
| Candidate ID | `SUNREY_PRODUCTION_NETWORK_CANDIDATE_2` |
| Display name | SunRey Production Candidate 2 |
| Network ID | `net_sunrey_production_candidate_2` |
| Chain ID | `chn_sunrey_production_candidate_2` |
| Address HRP | `srprd` (Chunk 65 established production-candidate HRP) |
| Protocol version | `1` |
| Genesis format | `candidate-2` |
| Status | `CANDIDATE` |
| `mainnetEnabled` | `false` |
| `productionAuthorized` | `false` |

The candidate does not reuse testnet, economic-rehearsal, or Candidate
V1 network or chain IDs.

## 76–80 reconciliation

Overlapping branches for Chunks 76–80 left compatibility substitutes
and a damaged architecture manifest. This chunk:

- Qualifies the Chunk 78 economic RC from canonical
  `EconomicStressReport` (Chunk 76) and `ProtocolTreasuryPolicy` plus
  treasury formal/stress evidence (Chunk 77)
- Binds `GovernanceOperationPackage` to the actual Chunk 78
  `EconomicReleaseCandidate`
- Re-runs Chunk 80 economic rehearsal against those merged
  implementations and records exact integrated evidence hashes
- Restores a valid `docs/architecture/manifest.json` with one owner
  per protected component

## Bundles

- `ProductionProtocolBundle` — transaction envelope, block format,
  consensus, validator, governance, execution, state, fee, and interop
  hashes. Interop remains disabled.
- `ProductionEconomicBundle` — SunRey/MoonRey monetary policy,
  validator economics, FeePolicyV2, MoonRey productive issuance,
  protocol treasury, and economic governance. Production parameters
  remain `UNCONFIGURED`. Tickers remain `NOT_ASSIGNED`.
- `ProductionSecurityBundle` — CryptoSuite, CryptoPolicy, PQC
  migration, root-of-trust, release authority, formal/fuzz/adversarial
  /stress/audit-preparation hashes. Independent audit is not claimed.
- Infrastructure and storage bundles consume Chunk 66 and Chunk 67.

## Topology and services

`ProductionTopologyManifest` and `ProductionServiceManifest` describe
candidate validators, sentries, RPC, Explorer, oracle collectors,
monitoring, backup, database, Exchange, custody, and the release
service. Unknown external values remain `UNKNOWN` / `NOT_PROVIDED`.
Services reference immutable `sha256:` digests only.

Fixture validator keys cannot satisfy production eligibility.

## CLI

```
npm run sunrey-mainnet -- candidate-v2 create
npm run sunrey-mainnet -- candidate-v2 show
npm run sunrey-mainnet -- candidate-v2 verify
npm run sunrey-mainnet -- candidate-v2 compare
npm run sunrey-mainnet -- candidate-v2 topology
npm run sunrey-mainnet -- candidate-v2 services
npm run sunrey-mainnet -- candidate-v2 evidence
```

## What this is not

- Not mainnet
- Not a second blockchain, consensus, ledger, treasury, Exchange,
  custody, or oracle network
- Not regulatory, legal, or licensing approval
- Not an independent audit completion
- Not production HSM or PQC activation

Chunk 86 binds this candidate's root hash into
`ProductionEnvironmentPlan`. It does not substitute a locally
constructed Candidate V2.
