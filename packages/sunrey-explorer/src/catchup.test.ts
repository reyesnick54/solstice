import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { developmentChainFixture, makeTx, nextBlock } from './fixtures.ts';
import { ExplorerIndexer } from './indexer.ts';
import { InMemoryExplorerIndex } from './store.ts';
import { verifyIndex } from './verify.ts';

describe('explorer indexer catch-up', () => {
  it('catches up from finalized history after the indexer was unavailable', () => {
    const chain = developmentChainFixture(3);
    const store = new InMemoryExplorerIndex();
    const indexer = new ExplorerIndexer(chain, { store });
    indexer.indexFromGenesis();
    const pausedHeight = chain.height();

    for (let i = 0; i < 3; i += 1) {
      const block = nextBlock(chain);
      chain.appendBlock(block, [makeTx(block.height, block.blockId, 'SYSTEM_NOTE')]);
    }
    assert.equal(chain.height(), pausedHeight + 3);
    assert.equal(indexer.status().lag, 3);
    assert.equal(store.checkpoint()?.lastIndexedFinalizedHeight, pausedHeight);

    indexer.catchUp();
    assert.equal(indexer.status().lag, 0);
    assert.equal(store.checkpoint()?.lastIndexedFinalizedHeight, chain.height());
    assert.equal(verifyIndex(store, chain).ok, true);
    assert.ok(store.blocks.has(pausedHeight + 3));
  });

  it('does not require the explorer for the chain to finalize', () => {
    const chain = developmentChainFixture(2);
    const offline = new ExplorerIndexer(chain);
    offline.indexFromGenesis();
    chain.appendBlock(nextBlock(chain));
    assert.equal(chain.height(), 2);
    assert.equal(offline.status().lag > 0, true);
  });
});
