import type { FinalizedChainReader, FinalizedChainSnapshot } from './chain-reader.ts';
import { ExplorerMetrics } from './metrics.ts';
import { InMemoryExplorerIndex, type ExplorerIndexStore } from './store.ts';
import { EXPLORER_INDEXER_SCHEMA_VERSION } from './taxonomy.ts';
import type { IndexCheckpoint } from './types.ts';

export type IndexerOptions = {
  readonly store?: ExplorerIndexStore;
  readonly metrics?: ExplorerMetrics;
};

/**
 * Deterministic finalized-block indexer.
 *
 * Rebuilds from the same finalized chain produce equivalent projections.
 * A missing explorer never blocks the chain.
 */
export class ExplorerIndexer {
  readonly chain: FinalizedChainReader;
  readonly store: ExplorerIndexStore;
  readonly metrics: ExplorerMetrics;
  private unsubscribe: (() => void) | null = null;

  constructor(
    chain: FinalizedChainReader,
    options: IndexerOptions = {},
  ) {
    this.chain = chain;
    this.store = options.store ?? new InMemoryExplorerIndex();
    this.metrics = options.metrics ?? new ExplorerMetrics();
  }

  status(): {
    readonly checkpoint: IndexCheckpoint | null;
    readonly chainHeight: number;
    readonly lag: number;
  } {
    const checkpoint = this.store.checkpoint();
    const chainHeight = this.chain.height();
    const indexed = checkpoint?.lastIndexedFinalizedHeight ?? 0;
    return {
      checkpoint,
      chainHeight,
      lag: Math.max(0, chainHeight - indexed),
    };
  }

  startLive(): void {
    this.unsubscribe?.();
    this.unsubscribe = this.chain.subscribe(() => {
      this.catchUp();
    });
  }

  stopLive(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  indexFromGenesis(): void {
    this.store.dropDerived();
    this.metrics.rebuildProgress = 0;
    this.indexRange(0, this.chain.height());
  }

  rebuildFromHeight(fromHeight: number): void {
    this.store.dropDerived();
    this.metrics.rebuildProgress = 0;
    this.indexRange(fromHeight, this.chain.height());
  }

  catchUp(): void {
    const checkpoint = this.store.checkpoint();
    const from = checkpoint ? checkpoint.lastIndexedFinalizedHeight + 1 : 0;
    const to = this.chain.height();
    if (from > to) {
      this.verifyCheckpoint();
      return;
    }
    this.indexRange(from, to);
  }

  verifyCheckpoint(): void {
    const checkpoint = this.store.checkpoint();
    if (!checkpoint) {
      return;
    }
    const block = this.chain.blockAt(checkpoint.lastIndexedFinalizedHeight);
    if (!block) {
      throw new Error('checkpoint height is not on the finalized chain; rebuild required');
    }
    if (block.blockId !== checkpoint.blockId || block.stateRoot !== checkpoint.stateRoot) {
      throw new Error('checkpoint does not match finalized chain; never repair chain, rebuild index');
    }
    if (checkpoint.indexerSchemaVersion !== EXPLORER_INDEXER_SCHEMA_VERSION) {
      throw new Error('indexer schema version mismatch; rebuild required');
    }
  }

  private indexRange(fromHeight: number, toHeight: number): void {
    const started = this.metrics.now();
    try {
      this.verifyCheckpoint();
      const snapshot = this.chain.range(fromHeight, toHeight);
      this.applySnapshot(snapshot);
      const last = snapshot.blocks[snapshot.blocks.length - 1];
      if (last) {
        this.store.putCheckpoint({
          lastIndexedFinalizedHeight: last.height,
          blockId: last.blockId,
          stateRoot: last.stateRoot,
          indexerSchemaVersion: EXPLORER_INDEXER_SCHEMA_VERSION,
        });
      }
      this.metrics.indexedHeight = last?.height ?? fromHeight;
      this.metrics.chainHeight = this.chain.height();
      this.metrics.lagBlocks = Math.max(0, this.metrics.chainHeight - this.metrics.indexedHeight);
      this.metrics.rebuildProgress = 100;
      this.metrics.observeQuery('index', this.metrics.now() - started);
    } catch (error) {
      this.metrics.errors += 1;
      throw error;
    }
  }

  private applySnapshot(snapshot: FinalizedChainSnapshot): void {
    for (const block of snapshot.blocks) {
      this.store.putBlock(block);
      this.metrics.blocksIndexedTotal += 1;
    }
    for (const tx of snapshot.transactions) {
      this.store.putTransaction(tx);
      this.metrics.transactionsIndexedTotal += 1;
    }
    for (const row of snapshot.accounts) {
      this.store.putIndexedAccount(row);
    }
    for (const row of snapshot.assets) {
      this.store.putAsset(row);
    }
    for (const row of snapshot.moonrey) {
      this.store.putMoonRey(row);
    }
    for (const row of snapshot.productiveObjects) {
      this.store.putProductiveObject(row);
    }
    for (const row of snapshot.contributions) {
      this.store.putContribution(row);
    }
    for (const row of snapshot.oracleProviders) {
      this.store.putOracleProvider(row);
    }
    for (const row of snapshot.oracleFeeds) {
      this.store.putOracleFeed(row);
    }
    for (const row of snapshot.oracleFacts) {
      this.store.putOracleFact(row);
    }
    for (const row of snapshot.validators) {
      this.store.putValidator(row);
    }
    for (const row of snapshot.evidence) {
      this.store.putEvidence(row);
    }
    for (const row of snapshot.governance) {
      this.store.putGovernance(row);
    }
    for (const row of snapshot.interopClients) {
      this.store.putInteropClient(row);
    }
    for (const row of snapshot.interopPackets) {
      this.store.putInteropPacket(row);
    }
    for (const row of snapshot.machines) {
      this.store.putMachine(row);
    }
    for (const row of snapshot.settlements) {
      this.store.putSettlement(row);
    }
  }
}
