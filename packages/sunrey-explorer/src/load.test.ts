import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { InMemoryFinalizedChain } from './chain-reader.ts';
import { developmentSnapshot, makeBlock, makeTx } from './fixtures.ts';
import { ExplorerIndexer } from './indexer.ts';
import { ExplorerQueryService } from './queries.ts';
import { MAX_PAGE_LIMIT } from './taxonomy.ts';

function loadedChain(blockCount: number): InMemoryFinalizedChain {
  const base = developmentSnapshot(4);
  const blocks = [...base.blocks];
  const transactions = [...base.transactions];
  for (let height = 4; height < blockCount; height += 1) {
    const block = makeBlock(height, `blk_${height - 1}`);
    blocks.push(block);
    transactions.push(makeTx(height, block.blockId, 'SYSTEM_NOTE'));
  }
  return new InMemoryFinalizedChain({
    ...base,
    finalizedHeight: blockCount - 1,
    blocks,
    transactions,
  });
}

describe('explorer development load', () => {
  it('keeps common query paths bounded', () => {
    const chain = loadedChain(80);
    const indexer = new ExplorerIndexer(chain);
    indexer.indexFromGenesis();
    const queries = new ExplorerQueryService(indexer);

    const blockList = queries.blocks(undefined, 1000);
    assert.ok(blockList.items.length <= MAX_PAGE_LIMIT);

    const started = Date.now();
    assert.ok(queries.block('blk_40'));
    assert.ok(queries.transaction('tx_h40_1'));
    assert.ok(queries.account('sr1qfaucet000000000000000000000000001')?.history.length);
    assert.ok(queries.collection('moonrey').items.length >= 1);
    const search = queries.search('fact_energy_1');
    assert.ok(!('code' in search));
    assert.equal(search.items[0]?.kind, 'ORACLE_FACT');
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 1000, `query path too slow: ${elapsed}ms`);
    assert.ok(indexer.metrics.snapshot().explorer_query_latency['page'] !== undefined);
  });
});
