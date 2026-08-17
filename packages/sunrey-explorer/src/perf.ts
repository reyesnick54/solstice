import { InMemoryFinalizedChain } from './chain-reader.ts';
import { developmentChainFixture, makeTx, nextBlock } from './fixtures.ts';
import { ExplorerIndexer } from './indexer.ts';
import { ExplorerQueryService } from './queries.ts';
import { verifyIndex } from './verify.ts';

export type ExplorerPerfCase = {
  readonly name: string;
  readonly suite: 'explorer';
  readonly cryptoLabeledSeparately: false;
  readonly extras: Readonly<Record<string, string | number | boolean>>;
  readonly latency?: {
    readonly count: number;
    readonly minNs: number;
    readonly maxNs: number;
    readonly meanNs: number;
    readonly medianNs: number;
    readonly p50Ns: number;
    readonly p95Ns: number;
    readonly p99Ns: number;
    readonly stddevNs: number;
  };
};

function summarize(samples: readonly number[]) {
  const sorted = [...samples].sort((left, right) => left - right);
  const count = sorted.length;
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  const mean = count === 0 ? 0 : sum / count;
  const pick = (p: number) => (count === 0 ? 0 : sorted[Math.max(0, Math.ceil((p / 100) * count) - 1)] ?? 0);
  const variance = count === 0 ? 0 : sorted.reduce((acc, value) => acc + (value - mean) ** 2, 0) / count;
  return {
    count,
    minNs: sorted[0] ?? 0,
    maxNs: sorted[count - 1] ?? 0,
    meanNs: mean,
    medianNs: pick(50),
    p50Ns: pick(50),
    p95Ns: pick(95),
    p99Ns: pick(99),
    stddevNs: Math.sqrt(variance),
  };
}

function ns(fn: () => void): number {
  const started = process.hrtime.bigint();
  fn();
  return Number(process.hrtime.bigint() - started);
}

export function measureExplorer(input: { readonly blocks: number; readonly catchUp: boolean }): readonly ExplorerPerfCase[] {
  const chain = developmentChainFixture(4);
  const live = new ExplorerIndexer(chain);
  live.indexFromGenesis();
  const paused = new ExplorerIndexer(new InMemoryFinalizedChain(chain.snapshot()));
  paused.indexFromGenesis();
  const history = new InMemoryFinalizedChain(chain.snapshot());
  const pausedIndexer = new ExplorerIndexer(history);
  pausedIndexer.indexFromGenesis();
  const generateStarted = process.hrtime.bigint();
  for (let height = history.height() + 1; height < input.blocks; height += 1) {
    const block = nextBlock(history);
    history.appendBlock(block, [makeTx(height, block.blockId, 'NATIVE_TRANSFER')]);
  }
  const generateNs = Number(process.hrtime.bigint() - generateStarted);
  const lagBefore = pausedIndexer.status().lag;
  const catchStarted = process.hrtime.bigint();
  pausedIndexer.catchUp();
  const catchNs = Number(process.hrtime.bigint() - catchStarted);
  const lagAfter = pausedIndexer.status().lag;
  verifyIndex(pausedIndexer.store, history);
  const queries = new ExplorerQueryService(pausedIndexer);
  const querySamples = [
    ns(() => queries.block(String(Math.max(1, history.height() - 1)))),
    ns(() => queries.home()),
    ns(() => queries.assets()),
    ns(() => queries.lag()),
  ];
  const rebuildStarted = process.hrtime.bigint();
  pausedIndexer.indexFromGenesis();
  const rebuildNs = Number(process.hrtime.bigint() - rebuildStarted);
  const indexedBlocks = pausedIndexer.metrics.blocksIndexedTotal;
  const indexedTx = pausedIndexer.metrics.transactionsIndexedTotal;
  const seconds = Math.max(catchNs / 1_000_000_000, 0.000001);
  return [
    {
      suite: 'explorer',
      name: 'catch_up',
      cryptoLabeledSeparately: false,
      latency: summarize([catchNs]),
      extras: {
        blocksGenerated: input.blocks,
        generateNs,
        lagBefore,
        lagAfter,
        caughtUp: lagAfter === 0 && input.catchUp,
        blocksPerSec: indexedBlocks / seconds,
        transactionsPerSec: indexedTx / seconds,
      },
    },
    {
      suite: 'explorer',
      name: 'query_latency',
      cryptoLabeledSeparately: false,
      latency: summarize(querySamples),
      extras: { rebuildNs },
    },
  ];
}
