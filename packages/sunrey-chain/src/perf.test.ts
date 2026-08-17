import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FeeEngine } from './fees/engine.ts';
import { compareForSelection, FeeMempool } from './fees/mempool.ts';
import { measureExplorer } from '../../sunrey-explorer/src/perf.ts';
import { measureExchange } from '../../sunrey-exchange/src/perf.ts';
import { developmentChainFixture } from '../../sunrey-explorer/src/fixtures.ts';
import { ExplorerIndexer } from '../../sunrey-explorer/src/indexer.ts';
import { ExplorerQueryService } from '../../sunrey-explorer/src/queries.ts';
import { canonicalProjectionHash } from '../../sunrey-explorer/src/canonical.ts';
import { runSanity, runProfile } from './perf/runner.ts';
import { RESULT_CLASS } from './perf/types.ts';
import { nativeTransferTx } from './perf/workload.ts';

describe('sunrey performance engineering', () => {
  it('keeps mempool selection identical to compareForSelection after the ordered-index optimization', () => {
    const engine = new FeeEngine();
    engine.faucet('alice', 10_000_000n);
    const mempool = new FeeMempool(engine);
    const admitted = [];
    for (let i = 0; i < 24; i += 1) {
      const tx = nativeTransferTx(`opt:${i}`, 'alice', 'bob', 1n, 1_000n + BigInt((i * 17) % 50));
      assert.equal(mempool.admit(tx), null);
      admitted.push(tx);
    }
    const selected = mempool.selectForBlock();
    const expected = [...admitted].sort(compareForSelection).filter((tx) => selected.some((row) => row.transactionId === tx.transactionId));
    assert.deepEqual(
      selected.map((tx) => tx.transactionId),
      expected.map((tx) => tx.transactionId),
    );
  });

  it('caches explorer projections of finalized immutable objects without changing the hash', () => {
    const chain = developmentChainFixture(6);
    const indexer = new ExplorerIndexer(chain);
    indexer.indexFromGenesis();
    const first = canonicalProjectionHash(indexer.store.projection());
    const second = canonicalProjectionHash(indexer.store.projection());
    assert.equal(first, second);
    const queries = new ExplorerQueryService(indexer);
    const latest = chain.blockAt(chain.height());
    assert.ok(latest);
    assert.equal(queries.block(String(latest.height))?.blockId, latest.blockId);
    assert.equal(queries.block(latest.blockId)?.blockId, latest.blockId);
  });

  it('runs CI sanity with context, finalized throughput, and soak invariants', () => {
    const report = runSanity({
      explorer: { measure: (input) => measureExplorer(input) },
      exchange: { measure: (input) => measureExchange(input) },
    });
    assert.equal(report.context.resultClass, RESULT_CLASS);
    assert.ok(report.context.sourceCommit.length > 0);
    assert.ok(report.context.hardware.cpus >= 1);
    assert.ok(report.context.protocolVersion.startsWith('sunrey.protocol.'));
    const crypto = report.cases.filter((row) => row.suite === 'crypto');
    assert.ok(crypto.length > 0);
    assert.ok(crypto.every((row) => row.cryptoLabeledSeparately));
    const seven = report.cases.find((row) => row.name.includes('7v_finalized_throughput'));
    assert.ok(seven?.throughput);
    assert.ok((seven.throughput?.finalized ?? 0) > 0);
    assert.ok(report.invariants.every((row) => row.ok), report.invariants.map((row) => `${row.id}:${row.detail}`).join(';'));
  });

  it('reports RPC abuse as contained by protective limits', () => {
    const report = runProfile({ profile: 'rpc' });
    const abuse = report.cases.find((row) => row.name === 'malformed_traffic');
    assert.equal(abuse?.extras?.protectiveLimitsHeld, true);
  });
});
