# Wave 2 — State Sync and Recovery

Operational recovery for SunRey Chain. A new or recovering validator must obtain and verify canonical blockchain state without trusting an arbitrary database dump.

## Authority model

| Layer | Role | Canonical? |
|-------|------|------------|
| Protocol / P2P / BFT consensus | Block production, finality, catch-up | Yes — chain truth |
| Chain node storage (`redb` / file store) | Durable blocks, state, WAL | Yes — when verified |
| Operator ops (`packages/sunrey-chain/src/sync`) | Plans, verification, rehearsal | Policy + validation |
| Application PostgreSQL | Ledger projections, outbox, custody metadata | No — rebuildable |
| Evidence Vault | Compliance evidence plane | No — distinct from chain |

**Database backups alone do not constitute blockchain recovery.**

## State synchronization

Two supported bootstrap modes (see `src/ops/state-sync.ts`):

1. **GENESIS_BLOCK_SYNC** — replay from genesis through trusted finalized height with verified blocks and commit certificates.
2. **TRUSTED_SNAPSHOT** — verify snapshot manifest, restore chain store, block-sync only the tail.

### Block sync validation (`src/sync/block-sync.ts`)

A syncing node validates:

- Network / genesis identity (`verifyChainIdentity`)
- Block ancestry (`verifyBlockAncestry`)
- Consensus / finality proof (`verifyFinalityCoverage`, `verifyCommitCertificate`)
- Transaction commitment (transaction root present per block)
- State transition validity (state root commitment per block)

Peer-reported balances are **never** authoritative (`rejectPeerReportedBalance`).

### Rust runtime integration

Production-candidate block-range sync lives in `packages/sunrey-chain/node` (`SyncRequest` / `SyncResponse`). Storage snapshots live in `packages/sunrey-chain/rust/crates/storage/src/snapshot.rs`. TypeScript sync modules orchestrate and test the verification contract; Rust nodes perform durable apply.

## Snapshots

Versioned canonical state snapshots (`src/ops/snapshots.ts`, `SNAPSHOT_FORMAT_VERSION = 1`).

Each manifest binds:

| Field | Purpose |
|-------|---------|
| `networkId` / `chainId` | Network identity |
| `genesisFingerprint` | Genesis binding |
| `protocolVersion` | Protocol compatibility |
| `height` | Snapshot height |
| `blockId` / `finalizedBlockId` | Tip and finalized block |
| `stateRoot` | State commitment |
| `snapshotFormatVersion` | Format version |
| `validatorSetHash` / `validatorSetVersion` | Validator set at snapshot |
| `payloadHash` / `manifestHash` | Integrity |

Snapshots **must not** include private keys or raw HIN / private economic data.

## Snapshot verification

Before accepting a snapshot (`src/sync/snapshot-verification.ts`):

1. Verify format / version
2. Verify chain / network / genesis fingerprint
3. Verify height ≤ trusted finalized height
4. Verify state commitment and payload hash
5. Verify associated finalized block (optional commit certificate binding)
6. Validate supply invariants via canonical economics auditor

Invalid snapshots **fail closed**.

## Recovery scenarios

| ID | Scenario | Supported |
|----|----------|-----------|
| A | Ordinary process restart | Yes — WAL + store reload |
| B | Validator restart after downtime | Yes — verified catch-up |
| C | Local state corruption | Yes — snapshot or genesis replay |
| D | New non-validator node joining | Yes — handshake + sync |
| E | Replacement validator infrastructure | Yes — config + signer safety restore |
| F | Snapshot restore + subsequent block sync | Yes — `TRUSTED_SNAPSHOT` plan |
| G | Application DB loss, chain survives | Yes — rebuild projections |
| H | Chain node loss, backups/peers survive | Yes — verified restore or peer sync |

### Irrecoverable conditions

- Loss of **all** validator private keys with no secure backup
- Loss of **all** canonical chain history with no verified snapshot or surviving peers
- Accepting an unverified snapshot or peer-reported balance as truth

## Backup boundary

Distinct backup classes (`src/sync/backup-boundary.ts`):

- **BLOCKCHAIN_STATE** — canonical chain store
- **CONSENSUS_WAL** — append-only consensus WAL
- **SIGNER_SAFETY** — encrypted high-watermark (stronger ops security)
- **VALIDATOR_CONFIGURATION** — non-secret topology
- **VALIDATOR_KEYS** — separate; never commit to repository
- **POSTGRES_APPLICATION_DATA** — application databases
- **CUSTODY_METADATA** — operational metadata
- **EVIDENCE_VAULT** — compliance plane (not chain substitute)
- **ENCRYPTED_CONFIGURATION** — operator security metadata

Key backups require stronger operational security than ordinary chain-data backups.

## Chain / database reconciliation

Read-only reconciliation (`src/sync/reconciliation.ts`):

```
BLOCKCHAIN CANONICAL STATE → secondary reconciliation
```

Targets: ledger, wallet index, Exchange balances, API projections.

Secondary mismatches require projection rebuild or operator investigation. **Never** post ledger journals to match a secondary projection.

## Tests

Automated coverage in `src/wave2-state-sync-recovery.test.ts`:

- Block sync with ancestry and finality
- Tampered / wrong-network snapshot rejection
- Supply invariant validation
- Secondary reconciliation authority
- Backup boundary distinctness
- Chaos recovery suite (restart, index rebuild, peer sync, supply/nonce/duplicate-tx)

Rust integration: `node/tests/devnet_scenario.rs`, `rust/crates/storage/tests/production.rs`, `rust/crates/consensus/tests/wal_recovery.rs`.

## Remaining gaps (engineering simulation)

- P2P snapshot serving (blocks only today on `STATE_SYNC` channel)
- Production mainnet deployment and managed DR automation
- Real PostgreSQL / chain replication (fixture labels only)
- Light-client state sync for SunRey itself

Production remains `ENVIRONMENT=simulation`; all `LIVE_*` flags stay `false`.
