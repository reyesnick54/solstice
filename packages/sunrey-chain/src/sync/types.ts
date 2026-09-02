/**
 * Wave 2 — state sync and recovery types.
 *
 * Protocol-level sync validation. Database dumps are not canonical truth.
 */

import type { OpsResult } from '../ops/types.ts';

export const SYNC_SCHEMA_VERSION = 1 as const;

export type ChainIdentity = {
  readonly networkId: string;
  readonly chainId: string;
  readonly genesisFingerprint: string;
  readonly protocolVersion: string;
};

export type SyncBlockHeader = {
  readonly height: bigint;
  readonly blockId: string;
  readonly parentBlockId: string;
  readonly transactionRoot: string;
  readonly stateRoot: string;
  readonly validatorSetHash: string;
};

export type CommitCertificateRef = {
  readonly height: bigint;
  readonly blockId: string;
  readonly round: number;
  readonly signatureCount: number;
  readonly quorumPower: bigint;
  readonly totalPower: bigint;
};

export type BlockSyncInput = {
  readonly identity: ChainIdentity;
  readonly parentBlockId: string;
  readonly fromHeight: bigint;
  readonly blocks: readonly SyncBlockHeader[];
  readonly certificates: readonly CommitCertificateRef[];
  readonly trustedFinalizedHeight: bigint;
};

export type BlockSyncReport = {
  readonly ok: boolean;
  readonly verifiedBlocks: number;
  readonly finalHeight: bigint;
  readonly finalStateRoot: string;
  readonly failures: readonly string[];
};

export type SnapshotSupplyState = {
  readonly assetId: string;
  readonly genesisAllocated: bigint;
  readonly issuedPostGenesis: bigint;
  readonly burned: bigint;
  readonly circulating: bigint;
  readonly locked: bigint;
  readonly escrowed: bigint;
  readonly feeReserved: bigint;
};

export type RecoveryScenarioId =
  | 'ORDINARY_RESTART'
  | 'VALIDATOR_DOWNTIME'
  | 'LOCAL_STATE_CORRUPTION'
  | 'NEW_NON_VALIDATOR_JOIN'
  | 'REPLACEMENT_VALIDATOR'
  | 'SNAPSHOT_RESTORE_BLOCK_SYNC'
  | 'APP_DB_LOSS_CHAIN_SURVIVES'
  | 'CHAIN_NODE_LOSS_BACKUPS_SURVIVE';

export type RecoveryScenario = {
  readonly id: RecoveryScenarioId;
  readonly supported: boolean;
  readonly mechanism: string;
  readonly cannotRecover?: string;
};

export type ReconciliationTarget = 'LEDGER' | 'WALLET_INDEX' | 'EXCHANGE_BALANCE' | 'API_PROJECTION';

export type ReconciliationRow = {
  readonly target: ReconciliationTarget;
  readonly accountOrKey: string;
  readonly chainQuantity: bigint;
  readonly secondaryQuantity: bigint;
  readonly assetId: string;
};

export type ReconciliationReport = {
  readonly ok: boolean;
  readonly authority: 'BLOCKCHAIN_CANONICAL';
  readonly mismatches: readonly ReconciliationRow[];
  readonly notes: readonly string[];
};

export type SyncResult<T> = OpsResult<T>;
