import { EXPLORER_INDEXER_SCHEMA_VERSION } from './taxonomy.ts';
import type {
  CanonicalProjection,
  IndexCheckpoint,
  IndexedAccount,
  IndexedAsset,
  IndexedBlock,
  IndexedContribution,
  IndexedEvidence,
  IndexedGovernance,
  IndexedInteropClient,
  IndexedInteropPacket,
  IndexedMachine,
  IndexedMoonReyIssuance,
  IndexedOracleFact,
  IndexedOracleFeed,
  IndexedOracleProvider,
  IndexedProductiveObject,
  IndexedSettlement,
  IndexedTransaction,
  IndexedValidator,
} from './types.ts';

export type ExplorerIndexStore = {
  checkpoint(): IndexCheckpoint | null;
  putCheckpoint(checkpoint: IndexCheckpoint): void;
  putBlock(block: IndexedBlock): void;
  putTransaction(tx: IndexedTransaction): void;
  putAccount(account: IndexedAccount): void;
  putAsset(asset: IndexedAsset): void;
  putMoonRey(row: IndexedMoonReyIssuance): void;
  putProductiveObject(row: IndexedProductiveObject): void;
  putContribution(row: IndexedContribution): void;
  putOracleProvider(row: IndexedOracleProvider): void;
  putOracleFeed(row: IndexedOracleFeed): void;
  putOracleFact(row: IndexedOracleFact): void;
  putValidator(row: IndexedValidator): void;
  putEvidence(row: IndexedEvidence): void;
  putGovernance(row: IndexedGovernance): void;
  putInteropClient(row: IndexedInteropClient): void;
  putInteropPacket(row: IndexedInteropPacket): void;
  putMachine(row: IndexedMachine): void;
  putSettlement(row: IndexedSettlement): void;
  dropDerived(): void;
  projection(): CanonicalProjection;
};

/**
 * In-memory projection store. Shape matches db/explorer.
 * Not the financial Ledger and not blockchain state.
 */
export class InMemoryExplorerIndex implements ExplorerIndexStore {
  private current: IndexCheckpoint | null = null;
  readonly blocks = new Map<number, IndexedBlock>();
  readonly blocksById = new Map<string, number>();
  readonly transactions = new Map<string, IndexedTransaction>();
  readonly txsByAddress = new Map<string, string[]>();
  readonly accounts = new Map<string, IndexedAccount>();
  readonly assets = new Map<string, IndexedAsset>();
  readonly moonrey = new Map<string, IndexedMoonReyIssuance>();
  readonly productiveObjects = new Map<string, IndexedProductiveObject>();
  readonly contributions = new Map<string, IndexedContribution>();
  readonly oracleProviders = new Map<string, IndexedOracleProvider>();
  readonly oracleFeeds = new Map<string, IndexedOracleFeed>();
  readonly oracleFacts = new Map<string, IndexedOracleFact>();
  readonly validators = new Map<string, IndexedValidator>();
  readonly evidence = new Map<string, IndexedEvidence>();
  readonly governance = new Map<string, IndexedGovernance>();
  readonly interopClients = new Map<string, IndexedInteropClient>();
  readonly interopPackets = new Map<string, IndexedInteropPacket>();
  readonly machines = new Map<string, IndexedMachine>();
  readonly settlements = new Map<string, IndexedSettlement>();

  checkpoint(): IndexCheckpoint | null {
    return this.current;
  }

  putCheckpoint(checkpoint: IndexCheckpoint): void {
    if (checkpoint.indexerSchemaVersion !== EXPLORER_INDEXER_SCHEMA_VERSION) {
      throw new Error('explorer schema version mismatch; rebuild required');
    }
    this.current = checkpoint;
  }

  putBlock(block: IndexedBlock): void {
    this.blocks.set(block.height, block);
    this.blocksById.set(block.blockId, block.height);
  }

  putTransaction(tx: IndexedTransaction): void {
    this.transactions.set(tx.transactionId, tx);
    for (const address of [tx.actor, ...tx.addressRefs]) {
      const list = this.txsByAddress.get(address) ?? [];
      if (!list.includes(tx.transactionId)) {
        list.push(tx.transactionId);
      }
      this.txsByAddress.set(address, list);
    }
  }

  putAccount(account: IndexedAccount): void {
    this.accounts.set(account.address, account);
  }

  putAsset(asset: IndexedAsset): void {
    this.assets.set(asset.assetId, asset);
  }

  putMoonRey(row: IndexedMoonReyIssuance): void {
    this.moonrey.set(row.issuanceId, row);
  }

  putProductiveObject(row: IndexedProductiveObject): void {
    this.productiveObjects.set(row.objectId, row);
  }

  putContribution(row: IndexedContribution): void {
    this.contributions.set(row.contributionId, row);
  }

  putOracleProvider(row: IndexedOracleProvider): void {
    this.oracleProviders.set(row.providerId, row);
  }

  putOracleFeed(row: IndexedOracleFeed): void {
    this.oracleFeeds.set(row.feedId, row);
  }

  putOracleFact(row: IndexedOracleFact): void {
    this.oracleFacts.set(row.factId, row);
  }

  putValidator(row: IndexedValidator): void {
    this.validators.set(row.validatorId, row);
  }

  putEvidence(row: IndexedEvidence): void {
    this.evidence.set(row.evidenceId, row);
  }

  putGovernance(row: IndexedGovernance): void {
    this.governance.set(row.proposalId, row);
  }

  putInteropClient(row: IndexedInteropClient): void {
    this.interopClients.set(row.clientId, row);
  }

  putInteropPacket(row: IndexedInteropPacket): void {
    this.interopPackets.set(row.packetId, row);
  }

  putMachine(row: IndexedMachine): void {
    this.machines.set(row.machineId, row);
  }

  putSettlement(row: IndexedSettlement): void {
    this.settlements.set(row.settlementId, row);
  }

  dropDerived(): void {
    this.current = null;
    this.blocks.clear();
    this.blocksById.clear();
    this.transactions.clear();
    this.txsByAddress.clear();
    this.accounts.clear();
    this.assets.clear();
    this.moonrey.clear();
    this.productiveObjects.clear();
    this.contributions.clear();
    this.oracleProviders.clear();
    this.oracleFeeds.clear();
    this.oracleFacts.clear();
    this.validators.clear();
    this.evidence.clear();
    this.governance.clear();
    this.interopClients.clear();
    this.interopPackets.clear();
    this.machines.clear();
    this.settlements.clear();
  }

  projection(): CanonicalProjection {
    return {
      schemaVersion: EXPLORER_INDEXER_SCHEMA_VERSION,
      checkpoint: this.current ?? {
        lastIndexedFinalizedHeight: 0,
        blockId: '',
        stateRoot: '',
        indexerSchemaVersion: EXPLORER_INDEXER_SCHEMA_VERSION,
      },
      blocks: sortBy((row) => row.height, [...this.blocks.values()]),
      transactions: sortBy((row) => row.transactionId, [...this.transactions.values()]),
      accounts: sortBy((row) => row.address, [...this.accounts.values()]),
      assets: sortBy((row) => row.assetId, [...this.assets.values()]),
      moonrey: sortBy((row) => row.issuanceId, [...this.moonrey.values()]),
      productiveObjects: sortBy((row) => row.objectId, [...this.productiveObjects.values()]),
      contributions: sortBy((row) => row.contributionId, [...this.contributions.values()]),
      oracleProviders: sortBy((row) => row.providerId, [...this.oracleProviders.values()]),
      oracleFeeds: sortBy((row) => row.feedId, [...this.oracleFeeds.values()]),
      oracleFacts: sortBy((row) => row.factId, [...this.oracleFacts.values()]),
      validators: sortBy((row) => row.validatorId, [...this.validators.values()]),
      evidence: sortBy((row) => row.evidenceId, [...this.evidence.values()]),
      governance: sortBy((row) => row.proposalId, [...this.governance.values()]),
      interopClients: sortBy((row) => row.clientId, [...this.interopClients.values()]),
      interopPackets: sortBy((row) => row.packetId, [...this.interopPackets.values()]),
      machines: sortBy((row) => row.machineId, [...this.machines.values()]),
      settlements: sortBy((row) => row.settlementId, [...this.settlements.values()]),
    };
  }
}

function sortBy<T>(key: (row: T) => string | number, rows: T[]): T[] {
  return rows.sort((left, right) => {
    const a = key(left);
    const b = key(right);
    return a < b ? -1 : a > b ? 1 : 0;
  });
}
