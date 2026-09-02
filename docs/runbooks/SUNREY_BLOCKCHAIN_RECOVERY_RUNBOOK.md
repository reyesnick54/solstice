# SunRey Blockchain Recovery Runbook

Operator runbook for SunRey Chain state sync and disaster recovery. Engineering simulation only until production activation.

## Prerequisites

- Known network ID, chain ID, and genesis fingerprint
- Access to at least one honest peer or verified snapshot provider
- Validator keys stored separately from chain-state backups
- `sunrey-ops` CLI available

## Quick reference

```bash
# Storage status
sunrey-ops storage status

# Create / verify snapshot
sunrey-ops snapshot create
sunrey-ops snapshot verify

# State sync plan
sunrey-ops state-sync

# Database restore drill (application only)
sunrey-ops database restore-test
```

## Scenario A — Ordinary process restart

1. Stop the node gracefully (`gracefulShutdownPreserves`).
2. Confirm disk has not rolled back (`safeRestart` checks WAL height, finalized height, signer watermark).
3. Start the node; consensus WAL recovery runs automatically.
4. Verify height and state root match pre-restart values.

**Do not** delete the data directory unless corruption is confirmed.

## Scenario B — Validator restart after downtime

1. Complete Scenario A checks.
2. Compare local height to network finalized height.
3. If behind, request verified block sync from peers (`SyncRequest` / `SyncResponse`).
4. Require commit certificates for each catch-up block.
5. Rejoin BFT only after local state matches finalized tip.

## Scenario C — Local state corruption

1. Stop the node immediately.
2. Run `sunrey-ops storage verify`.
3. If corrupt, choose:
   - **Verified snapshot** at last known good height, or
   - **Genesis block sync** from peers.
4. Never accept an unverified database dump.

## Scenario D — New non-validator node joining

1. Configure network ID, chain ID, genesis fingerprint.
2. Handshake with seeds; reject wrong-genesis peers.
3. Sync via genesis block sync or trusted snapshot + tail.
4. Serve RPC only after verification completes.

## Scenario E — Replacement validator infrastructure

1. Restore **validator configuration** (topology, non-secret placement).
2. Restore **signer safety backup** (encrypted, monotonic watermark).
3. Import validator keys from secure key backup — **not** from chain snapshot.
4. Sync chain state via Scenario B.
5. Confirm signer fencing before signing resumes.

## Scenario F — Snapshot restore + block sync

1. Obtain snapshot with manifest (`snapshotFormatVersion`, `genesisFingerprint`, `stateRoot`).
2. Verify manifest:
   ```bash
   sunrey-ops snapshot verify
   ```
3. Confirm supply invariants if supply state is bundled.
4. Restore chain store to data directory.
5. Block-sync heights `snapshot.height + 1` through current finalized height.
6. Reconcile secondary systems (Scenario G/H).

## Scenario G — Application database loss, chain survives

1. Confirm chain node is healthy and finalized.
2. Restore or rebuild PostgreSQL from logical backup if available.
3. If no backup, rebuild projections from canonical chain:
   - Wallet index
   - Explorer checkpoint
   - Outbox / custody metadata (where applicable)
4. Run read-only reconciliation; investigate mismatches.
5. **Never** rewrite blockchain to match a database projection.

## Scenario H — Chain node loss, backups/peers survive

1. Provision new node with correct network identity.
2. Restore verified chain snapshot **or** genesis sync from peers.
3. Restore consensus WAL if available (must not roll back signer watermark).
4. Verify state root and height against known network tip.
5. Rebuild explorer / API projections from chain.
6. Run reconciliation against ledger and custody metadata.

## Backup procedures

| Asset | Backup class | Encryption | Repository |
|-------|-------------|------------|------------|
| Chain store | BLOCKCHAIN_STATE | Optional | Never |
| Consensus WAL | CONSENSUS_WAL | Optional | Never |
| Signer watermark | SIGNER_SAFETY | Required | Never |
| Validator keys | VALIDATOR_KEYS | Required | **Never** |
| Application DB | POSTGRES_APPLICATION_DATA | Required | Never |
| Evidence Vault | EVIDENCE_VAULT | Required | Never |

Rotate and test restores on a schedule. Key backups require stronger access controls than chain-data backups.

## Reconciliation

After any recovery:

1. Export canonical chain balances (native asset ledger).
2. Compare against ledger, wallet index, Exchange, API projections.
3. Log mismatches as `CUSTODY_RECONCILIATION_MISMATCH` or `SUPPLY_RECONCILIATION` alerts.
4. Rebuild secondary projections; do not mutate chain state.

## What cannot be recovered

- All validator keys lost with no secure backup → **new validator set ceremony required**
- All canonical history lost with no snapshot and no honest peers → **chain cannot be reconstructed**
- Accepting tampered or wrong-network snapshot → **must re-sync from trusted source**

## Escalation

- Signer rollback detected → stop signing, investigate fencing
- Supply reconciliation mismatch → halt economic operations, engage economics auditor
- Snapshot tamper alert → refuse restore, obtain new verified snapshot

See also: `docs/architecture/WAVE2_STATE_SYNC_AND_RECOVERY.md`, `docs/runbooks/consensus-partition-recovery.md`, `docs/operators/state-sync.md`.
