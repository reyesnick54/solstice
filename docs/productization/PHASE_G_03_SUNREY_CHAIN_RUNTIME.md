# Phase G Prompt 3 — SunRey Blockchain production runtime

`CORE_CODE_COMPLETE_CANDIDATE=true`
`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`
`production_authorized=false`
`ENVIRONMENT=simulation`
`MAINNET_ACTIVE=false`
`TESTNET_ACTIVE=true`

This prompt productizes the proprietary SunRey Chain runtime as a
deployable **network release candidate**. It does not launch mainnet.
It does not replace SunRey Chain with Ethereum, Solana, Cosmos,
Polkadot, EVM, or ERC token infrastructure.

Phase G Prompts 1 and 2 were not present on this tree when this work
started. This prompt extends the existing Rust and TypeScript chain
owner rather than waiting on a parallel wallet or Exchange rewrite.

`SAFE_TO_PROCEED_TO_PHASE_G_PROMPT_4=true`

## Canonical owner

| Concern | Path |
| --- | --- |
| Protocol / SRCB | `packages/sunrey-chain/rust/crates/protocol` |
| Consensus | `packages/sunrey-chain/rust/crates/consensus` |
| Local node + persistence | `packages/sunrey-chain/rust/crates/node`, `crates/storage` |
| P2P / mempool / state sync | `packages/sunrey-chain/node` |
| RPC | `packages/sunrey-chain/rust/crates/rpc` |
| Validators | `packages/sunrey-chain/rust/crates/validators` |
| Productization contract | `packages/sunrey-chain/src/runtime/` |
| Explorer API | `packages/sunrey-explorer` |
| Testnet deploy | `deploy/sunrey-testnet` |
| Production-candidate infra | `infra/sunrey-production` |

Do not create `packages/blockchain`, `packages/sunrey-node`,
`packages/tendermint`, `packages/validator-operator`,
`packages/sunrey-rpc`, or a second chain.

## 1. Audit status

The Rust workspace already contained the development node, Tendermint-class
BFT engine, SRCB transaction codec, fees, native assets, storage, and a
separate P2P node. Gaps closed here:

- explicit `LOCAL / DEVNET / TESTNET / PREPRODUCTION / MAINNET` identity
- transaction finality that is not local observation
- versioned `/v1` RPC with PUBLIC / VALIDATOR / ADMIN planes
- operator lifecycle mapping
- MAINNET genesis fail-closed
- testnet sentry + RPC plane configuration
- chaos and replay productization tests

Consensus was hardened in place. It was not replaced.

## 2. Network identity

Canonical IDs live in `sunrey-protocol` and
`packages/sunrey-chain/src/runtime/identity.ts`.

| Environment | Network ID | Chain ID | Deployable |
| --- | --- | --- | --- |
| LOCAL | `net_sunrey_local` (`net_sunrey_local_dev` alias) | `chn_sunrey_local` | yes |
| DEVNET | `net_sunrey_development` | `chn_sunrey_development` | yes |
| TESTNET | `net_sunrey_testnet_1` | `chn_sunrey_testnet_1` | yes, active |
| PREPRODUCTION | `net_sunrey_preproduction` | `chn_sunrey_preproduction` | rehearsal only |
| MAINNET | `net_sunrey_mainnet` | `chn_sunrey_mainnet` | no |

Replay binding is `sunrey.replay.v1|{networkId}|{chainId}`. A
transaction signed for one pair is `WRONG_NETWORK` / `WRONG_CHAIN` on
another.

## 3. Transaction model

SRCB v1 envelope (`UnsignedTransaction`) remains the canonical codec:

`network_id`, `chain_id`, `codec_id`, `schema_version`, `family`,
`nonce`, `idempotency_key`, `payload`, plus `SignatureDescriptor`
(`suite`, `algorithm`, `key_id`, `public_key`, `signature`).

The transaction hash is the domain-separated `transaction_id`.
Serialization is deterministic SRCB, not JSON.

The P2P development envelope additionally carries `actor_id` and
`expires_at_ms`. Productization views both as
`CanonicalTransactionView` (sender, nonce, action, amount/asset, fee,
network, expiration, signature, hash).

## 4. Signature verification

Ed25519 + SHA-256 (`ed25519-dalek`, project `CryptoSuite`) stays the
chosen primitive. PQ / hybrid suite IDs remain fail-closed.

Admission verifies signature, public key, network, chain, nonce, and
encoding **before** state mutation. Invalid signatures never enter
the mempool.

## 5. Nonce / replay protection

Guards:

- exact transaction-id replay
- old nonce reuse (`nonce != next_nonce(signer)`)
- idempotency-key reuse
- cross-network / cross-chain mismatch
- concurrent same-nonce admission (only one succeeds)

## 6. Mempool

P2P mempool: validation, duplicate detection, global and per-actor
limits, FEE1 priority, expiry, removal after inclusion, revalidate
after restart of chain state.

LocalNode queue: bound, duplicate detection, disk persistence, fee
family priority (`prioritize_queue`). Trivial floods are capacity
rejected (`QueueFull` / per-actor `SPAM`).

## 7. Consensus

Development Tendermint-class BFT in
`packages/sunrey-chain/rust/crates/consensus`.

Assumptions / fault threshold:

- identifiable bonded validators
- weighted voting power
- `f < 1/3` Byzantine power (`max_byzantine_power = ⌊(n−1)/3⌋`)
- finality after strictly more than two-thirds PRECOMMIT
- lock / valid-value / NIL / round-change per `ALGORITHM.md`
- double proposal at the same `(height, round)` is signer-safety refused
- invalid blocks / conflicting proposals produce evidence, not commit
- WAL recovery restores height and signer high-watermark

Local `DEV_BLOCK_PRODUCER` is not this engine. Application layers
must not treat a single-node produce as network finality.

## 8. Block validation

Every block recomputes:

- header version, network, chain
- previous hash / height
- timestamp rules
- transaction root
- state / app hash
- validator-set hash
- native-asset and fee invariants on apply

Invalid headers are `IncorrectParent`, `IncorrectHeight`,
`WrongTransactionRoot`, or `WrongStateRoot`.

## 9. Finality

Canonical statuses: `PENDING`, `INCLUDED`, `FINALIZED`, `FAILED`.

| Source | Status |
| --- | --- |
| mempool | PENDING |
| local block observation | INCLUDED |
| BFT commit certificate | FINALIZED |
| rejection | FAILED |

`local_observation_is_not_finality` is true unless the source is a
commit certificate.

## 10–11. Persistence, snapshots, state sync

`sunrey-storage` (redb production-candidate + file store) recovers
height, state, native balances, and tx index. LocalNode persists the
mempool queue. Governance / oracle / fee engines persist beside the
store.

Snapshots carry a manifest hash. Restore verifies integrity and
rejects the wrong chain. P2P state sync remains the bootstrap path
for the development network (`FEATURE_STATE_SYNC`).

## 12–13. Validator identity and lifecycle

Protocol statuses stay: Candidate, Bonded, PendingActivation, Active,
PendingExit, Jailed, Tombstoned, Exited.

Operator lifecycle:

`REGISTERED → PENDING_ACTIVATION → ACTIVE → EXITING → INACTIVE`
with `SUSPENDED` for jail.

Mainnet activation requires an explicit human governance process.
AI / robot / device controllers remain forbidden.

Existing bond descriptors are simulation or protocol bonds. This
prompt does not invent staking economics.

## 14. Key management

Separated roles: validator consensus, wallet/user, node identity,
administrative. HSM/KMS references are supported as
`hsmOrKmsRef` strings. Production private keys are not committed.
Rotation replaces the key id; historical consensus keys remain on
the protocol record.

## 15–16. RPC

Versioned public surface:

- `GET /v1/chain/status`, `/v1/network/status`
- `GET /v1/chain/blocks/{height}`
- `GET /v1/transactions/{id}`
- `GET /v1/accounts/{id}`
- `GET /v1/assets`
- `GET /v1/fees/estimate`
- `GET /v1/validators`
- `POST /v1/transactions`

Planes: `PUBLIC_RPC`, `VALIDATOR_RPC`, `ADMIN_RPC`.
Public plane refuses `/admin/produce-block` and signing routes.

Security: rate limiting, request size cap, method allowlisting,
optional CORS, `X-Request-Id`, no secrets in `/v1/metrics`.

Simulation combined plane keeps loopback legacy admin for local
development only.

## 17. Explorer backend

Canonical owner remains `packages/sunrey-explorer` (`/v1/blocks`,
transactions, accounts, validators, assets, fees, network status).
It is a rebuildable projection, never the ledger.

## 18. Fees

`sunrey-fees` stays the integer fee engine. Policy values remain
human-configured. Insufficient fees reject at admission. AI does
not alter fee policy.

## 19. Genesis

`generate_genesis` / `sunrey-genesis` produce hashable SRCB
`GenesisV1`. TESTNET values are labeled `simulation` and
`ticker_status = NOT_ASSIGNED`.

MAINNET generation returns `GOVERNANCE_REJECTED` even if a caller
claims the fields are complete. `production_network_enabled = true`
still fails decode.

## 20. Deployment

Active deployable network is TESTNET.

- `deploy/sunrey-testnet` — validator, sentry, RPC, explorer, monitoring
- `infra/sunrey-production` — production-candidate modules, not live mainnet

No mainnet deployment artifacts are activated.

## 21. Observability

Metrics: block height, block time, validator status, peer status,
mempool size, transaction throughput, transaction failures, RPC
latency, consensus rounds, finality delay. Secret labels are
rejected.

## 22. Backup / recovery

Procedures: state backup, snapshot, restore, node rebuild, validator
disaster recovery. Restore is tested in non-production. Integrity
verification is required before trust.

## 23. Chaos tests

Covered: validator offline, partition, slow validator, invalid tx
flood, invalid block, duplicate tx, RPC overload, node restart,
state restore. Existing BFT safety / WAL / abuse suites remain the
runtime evidence.

## 24. Operator guide

See `docs/productization/SUNREY_VALIDATOR_OPERATOR_GUIDE.md`.

## 25. Validation

Rust: `cargo fmt`, `cargo check`, `cargo clippy`, `cargo test` in
`packages/sunrey-chain/rust` and `packages/sunrey-chain/node`.

TypeScript: `packages/sunrey-chain/src/runtime.test.ts` and
`tests/phase-g-03-chain-runtime.test.ts`.

Exchange native settlement remains the existing Rust/TS suites.

## Mainnet blockers

- human governance fields and counsel-confirmed economics
- production key ceremony / HSM
- `production_network_enabled` decode remains fail-closed
- LIVE_* flags stay false
- `ENVIRONMENT` stays simulation
- BFT is still a development engine (ADR-0015 PROPOSED)

`SAFE_TO_PROCEED_TO_PHASE_G_PROMPT_4=true`
