# Blockchain Network Intelligence Providers

Wave 3 Prompt 13 — external blockchain network observation plane.

## Purpose

SunRey observes external blockchain networks (Bitcoin, Ethereum, and others) for
read-only intelligence: blocks, transactions, mempool conditions, fee estimates,
and network statistics. This layer does **not** execute transactions, modify
SunRey chain consensus, alter the ledger, or control SunRey/MoonRey issuance.

## Providers integrated

| Provider ID | Name | Role | Chains |
| --- | --- | --- | --- |
| `mempool-space` | Mempool.space | Primary Bitcoin network intelligence | `bitcoin-mainnet`, `bitcoin-testnet` |
| `blockchain-com` | Blockchain.com Explorer API | Secondary Bitcoin fallback | `bitcoin-mainnet` |
| `blockscout` | Blockscout | Ethereum block explorer | `ethereum-mainnet` |
| `btcglobe` | BTCGlobe | Fallback Bitcoin network statistics | `bitcoin-mainnet` |

**Count:** 4 providers (partial Wave 0 catalog population).

Catalog entries: `packages/sunrey-chain/src/chain-intelligence/catalog-entries.ts`

## Chains supported

| Chain ID | Network | Finality model |
| --- | --- | --- |
| `bitcoin-mainnet` | Bitcoin Mainnet | Probabilistic (6+ confirmations for likely final) |
| `bitcoin-testnet` | Bitcoin Testnet | Probabilistic (3+ confirmations) |
| `ethereum-mainnet` | Ethereum Mainnet | Probabilistic PoS (32+ slots) |
| `solana-mainnet` | Solana Mainnet | Probabilistic (identity reserved; no adapter yet) |

SunRey native chain (`sunrey-simulation`, `chn_sunrey_simulation`) is **not**
represented as an external observed chain.

## Observation types

- `BLOCK` — normalized block header and metadata
- `TRANSACTION` — read-only tx lookup by hash
- `MEMPOOL` — pending tx count, size, fee distribution, congestion
- `FEE` — minimum / economy / normal / priority tiers with explicit units
- `NETWORK_STATE` — health, latest tip, node reachability
- `HASHRATE` / `NETWORK_METRICS` — difficulty, hashrate, throughput, supply
- `NODE_STATUS` — via network status composite

## Canonical models

| Model | Location |
| --- | --- |
| `ExternalBlockchainId` | `packages/sunrey-chain/src/chain-intelligence/types.ts` |
| `ChainObservation` | same |
| `MempoolObservation` | same |
| `BlockchainIntelligenceProvider` | `packages/sunrey-chain/src/chain-intelligence/provider.ts` |
| `ExternalChainIntelligenceService` | `packages/sunrey-chain/src/chain-intelligence/service.ts` |

## Caching

| Capability | Fresh TTL | Notes |
| --- | ---: | --- |
| Latest block | 30s | Short — tip may reorg |
| Confirmed block | 1h | Long — deep confirmations |
| Unconfirmed tx | 15s | Short while pending |
| Confirmed tx | 1h | After sufficient confirmations |
| Fee estimate | 60s | Short — mempool-driven |
| Mempool status | 30s | Short |
| Network metrics | 5m | Medium |
| Network metadata | 24h | Long |
| Address lookup | 2m | Not persisted by default |

Policies: `packages/sunrey-chain/src/chain-intelligence/cache-policies.ts`

## Finality and reorg semantics

External observations are **reorg-aware**. Recent blocks carry
`confirmationStatus` of `UNCONFIRMED`, `PROBABILISTIC`, `LIKELY_FINAL`, or
`FINAL` based on chain-specific confirmation thresholds. Observations include
`reorgAware: true` and a `finalityNote` explaining that recent tips may
reorganize.

Provider disagreement on block hash at the same height emits a
`sunrey.chain-intelligence.disagreement.v1` event — material conflicts are not
silently merged.

## Privacy

- Address lookups use `privacySafeAddressLogRef` — only truncated/redacted refs
  are logged, never full addresses associated with SunRey users.
- BFF responses redact `providerId` to `'redacted'`.
- No credentials in BFF or logs.

## SunRey chain separation

`ExternalChainIntelligenceService.separationProof()` asserts:

- `externalObservationOnly: true`
- No mutation of SunRey consensus, block production, ledger, or issuance
- No Execution Authority issuance
- No override of internal validators

`rejectSunReyNativeChain()` blocks queries against SunRey native chain IDs.

## Exchange integration

`packages/sunrey-exchange/src/chain-intelligence/integrations/exchange.ts`

Exchange consumes read-only `ExchangeChainContext` for:

- Confirmation context on external transfers
- Network fee intelligence (`sat/vB`, not confused with BTC/USD)
- Mempool congestion indicators

Does not mutate settlement or wallet authority.

## Financial Agent integration

`packages/sunrey-chain/src/chain-intelligence/agent-evidence.ts`

Agent receives `ChainIntelligenceAgentEvidence` with
`grantsExecutionAuthority: false` and `grantsSigningAuthority: false`.
Observations are labeled `RESEARCH_EVIDENCE_NOT_EXECUTION`.

Examples: elevated Bitcoin fees, network congestion, delayed confirmations.

## World / BFF

`services/api/src/consumer/blockchain-intelligence-adapter.ts`

Canonical BFF surfaces:

- Network health snapshot (Bitcoin + Ethereum)
- Bitcoin latest block (reorg-aware)
- Mempool conditions and fee recommendations

No raw provider API passthrough.

## Background refresh

Schedules in `packages/sunrey-chain/src/chain-intelligence/refresh-schedules.ts`:

- Network health: 5 minutes
- Latest block: 60 seconds
- Fee recommendation: 2 minutes
- Mempool condition: 60 seconds

Simulation respects free quotas; no per-transaction polling.

## Tests

`tests/wave-3-prompt-13-blockchain-intelligence.test.ts` — 23 acceptance cases.

## Simulation posture

`ENVIRONMENT=simulation`. Adapters use fixture transports only. No live HTTP
to external block explorers. `liveProviderConnected: false` on all providers.

## Related

- `docs/providers/FREE_API_MASTER_CATALOG.md` — Wave 0 catalog framework
- `docs/providers/EXTERNAL_DATA_PROVENANCE.md` — observation provenance
- `packages/kernel/src/compliance/provider-candidate/blockchain-analytics.ts` —
  separate compliance screening plane (not chain intelligence)
