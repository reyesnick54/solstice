export type ExplorerMetricSnapshot = {
  readonly explorer_indexed_height: number;
  readonly explorer_chain_height: number;
  readonly explorer_lag_blocks: number;
  readonly explorer_blocks_indexed_total: number;
  readonly explorer_transactions_indexed_total: number;
  readonly explorer_errors: number;
  readonly explorer_rebuild_progress: number;
  readonly explorer_query_latency: Readonly<Record<string, number>>;
};

export class ExplorerMetrics {
  indexedHeight = 0;
  chainHeight = 0;
  lagBlocks = 0;
  blocksIndexedTotal = 0;
  transactionsIndexedTotal = 0;
  errors = 0;
  rebuildProgress = 0;
  readonly queryLatencyMs: Record<string, number> = {};

  now(): number {
    return Date.now();
  }

  observeQuery(name: string, elapsedMs: number): void {
    this.queryLatencyMs[name] = elapsedMs;
  }

  snapshot(): ExplorerMetricSnapshot {
    return {
      explorer_indexed_height: this.indexedHeight,
      explorer_chain_height: this.chainHeight,
      explorer_lag_blocks: this.lagBlocks,
      explorer_blocks_indexed_total: this.blocksIndexedTotal,
      explorer_transactions_indexed_total: this.transactionsIndexedTotal,
      explorer_errors: this.errors,
      explorer_rebuild_progress: this.rebuildProgress,
      explorer_query_latency: { ...this.queryLatencyMs },
    };
  }

  renderPrometheus(): string {
    const snap = this.snapshot();
    const lines = [
      `# HELP explorer_indexed_height Last indexed finalized height`,
      `# TYPE explorer_indexed_height gauge`,
      `explorer_indexed_height ${snap.explorer_indexed_height}`,
      `# HELP explorer_chain_height Canonical finalized height`,
      `# TYPE explorer_chain_height gauge`,
      `explorer_chain_height ${snap.explorer_chain_height}`,
      `# HELP explorer_lag_blocks Index lag behind finalized chain`,
      `# TYPE explorer_lag_blocks gauge`,
      `explorer_lag_blocks ${snap.explorer_lag_blocks}`,
      `# HELP explorer_blocks_indexed_total Blocks projected`,
      `# TYPE explorer_blocks_indexed_total counter`,
      `explorer_blocks_indexed_total ${snap.explorer_blocks_indexed_total}`,
      `# HELP explorer_transactions_indexed_total Transactions projected`,
      `# TYPE explorer_transactions_indexed_total counter`,
      `explorer_transactions_indexed_total ${snap.explorer_transactions_indexed_total}`,
      `# HELP explorer_errors Indexer and query errors`,
      `# TYPE explorer_errors counter`,
      `explorer_errors ${snap.explorer_errors}`,
      `# HELP explorer_rebuild_progress Rebuild percent`,
      `# TYPE explorer_rebuild_progress gauge`,
      `explorer_rebuild_progress ${snap.explorer_rebuild_progress}`,
    ];
    for (const [name, value] of Object.entries(snap.explorer_query_latency)) {
      lines.push(`explorer_query_latency{query="${name}"} ${value}`);
    }
    return `${lines.join('\n')}\n`;
  }
}
