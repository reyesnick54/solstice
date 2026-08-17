import type {
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

/**
 * Read port over finalized SunRey Blockchain state.
 *
 * Chunk 51 public APIs are consumed when present. This port is the
 * internal read interface the indexer uses. The explorer never writes
 * chain state and never repairs an index by mutating the chain.
 */
export type FinalizedChainSnapshot = {
  readonly finalizedHeight: number;
  readonly protocolVersion: string;
  readonly blocks: readonly IndexedBlock[];
  readonly transactions: readonly IndexedTransaction[];
  readonly accounts: readonly IndexedAccount[];
  readonly assets: readonly IndexedAsset[];
  readonly moonrey: readonly IndexedMoonReyIssuance[];
  readonly productiveObjects: readonly IndexedProductiveObject[];
  readonly contributions: readonly IndexedContribution[];
  readonly oracleProviders: readonly IndexedOracleProvider[];
  readonly oracleFeeds: readonly IndexedOracleFeed[];
  readonly oracleFacts: readonly IndexedOracleFact[];
  readonly validators: readonly IndexedValidator[];
  readonly evidence: readonly IndexedEvidence[];
  readonly governance: readonly IndexedGovernance[];
  readonly interopClients: readonly IndexedInteropClient[];
  readonly interopPackets: readonly IndexedInteropPacket[];
  readonly machines: readonly IndexedMachine[];
  readonly settlements: readonly IndexedSettlement[];
};

export type ChainEventKind =
  | 'NEW_BLOCK'
  | 'NEW_TRANSACTION'
  | 'GOVERNANCE'
  | 'ORACLE'
  | 'MOONREY_ISSUANCE';

export type ChainProjectionEvent = {
  readonly kind: ChainEventKind;
  readonly height: number;
  readonly id: string;
};

export type FinalizedChainReader = {
  readonly snapshot: () => FinalizedChainSnapshot;
  readonly height: () => number;
  readonly blockAt: (height: number) => IndexedBlock | undefined;
  readonly range: (fromHeight: number, toHeight: number) => FinalizedChainSnapshot;
  readonly subscribe: (listener: (event: ChainProjectionEvent) => void) => () => void;
};

export class InMemoryFinalizedChain implements FinalizedChainReader {
  private data: FinalizedChainSnapshot;
  private readonly listeners = new Set<(event: ChainProjectionEvent) => void>();

  constructor(snapshot: FinalizedChainSnapshot) {
    this.data = cloneSnapshot(snapshot);
  }

  snapshot(): FinalizedChainSnapshot {
    return cloneSnapshot(this.data);
  }

  height(): number {
    return this.data.finalizedHeight;
  }

  blockAt(height: number): IndexedBlock | undefined {
    return this.data.blocks.find((block) => block.height === height);
  }

  range(fromHeight: number, toHeight: number): FinalizedChainSnapshot {
    const blocks = this.data.blocks.filter((block) => block.height >= fromHeight && block.height <= toHeight);
    const heights = new Set(blocks.map((block) => block.height));
    const transactions = this.data.transactions.filter((tx) => heights.has(tx.height));
    const moonrey = this.data.moonrey.filter((row) => heights.has(row.height));
    const evidence = this.data.evidence.filter((row) => heights.has(row.height));
    const settlements = this.data.settlements.filter((row) => heights.has(row.finalizedHeight));
    return {
      ...cloneSnapshot(this.data),
      finalizedHeight: toHeight,
      blocks,
      transactions,
      moonrey,
      evidence,
      settlements,
    };
  }

  subscribe(listener: (event: ChainProjectionEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  appendBlock(block: IndexedBlock, transactions: readonly IndexedTransaction[] = []): void {
    if (block.height !== this.data.finalizedHeight + 1) {
      throw new Error(`chain append must be sequential; have ${this.data.finalizedHeight} got ${block.height}`);
    }
    this.data = {
      ...this.data,
      finalizedHeight: block.height,
      protocolVersion: block.protocolVersion,
      blocks: [...this.data.blocks, block],
      transactions: [...this.data.transactions, ...transactions],
    };
    this.emit({ kind: 'NEW_BLOCK', height: block.height, id: block.blockId });
    for (const tx of transactions) {
      this.emit({ kind: 'NEW_TRANSACTION', height: tx.height, id: tx.transactionId });
    }
  }

  addMoonRey(row: IndexedMoonReyIssuance): void {
    this.data = { ...this.data, moonrey: [...this.data.moonrey, row] };
    this.emit({ kind: 'MOONREY_ISSUANCE', height: row.height, id: row.issuanceId });
  }

  addOracleFact(row: IndexedOracleFact): void {
    this.data = { ...this.data, oracleFacts: [...this.data.oracleFacts, row] };
    this.emit({ kind: 'ORACLE', height: this.data.finalizedHeight, id: row.factId });
  }

  addGovernance(row: IndexedGovernance): void {
    this.data = { ...this.data, governance: [...this.data.governance, row] };
    this.emit({ kind: 'GOVERNANCE', height: row.activationHeight, id: row.proposalId });
  }

  replaceEconomicState(partial: Partial<FinalizedChainSnapshot>): void {
    this.data = { ...this.data, ...partial, finalizedHeight: this.data.finalizedHeight };
  }

  private emit(event: ChainProjectionEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

function cloneSnapshot(snapshot: FinalizedChainSnapshot): FinalizedChainSnapshot {
  return {
    finalizedHeight: snapshot.finalizedHeight,
    protocolVersion: snapshot.protocolVersion,
    blocks: [...snapshot.blocks],
    transactions: [...snapshot.transactions],
    accounts: [...snapshot.accounts],
    assets: [...snapshot.assets],
    moonrey: [...snapshot.moonrey],
    productiveObjects: [...snapshot.productiveObjects],
    contributions: [...snapshot.contributions],
    oracleProviders: [...snapshot.oracleProviders],
    oracleFeeds: [...snapshot.oracleFeeds],
    oracleFacts: [...snapshot.oracleFacts],
    validators: [...snapshot.validators],
    evidence: [...snapshot.evidence],
    governance: [...snapshot.governance],
    interopClients: [...snapshot.interopClients],
    interopPackets: [...snapshot.interopPackets],
    machines: [...snapshot.machines],
    settlements: [...snapshot.settlements],
  };
}
