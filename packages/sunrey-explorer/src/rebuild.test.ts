import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { canonicalProjectionHash, canonicalProjectionJson } from './canonical.ts';
import { developmentChainFixture } from './fixtures.ts';
import { ExplorerIndexer } from './indexer.ts';
import { ExplorerQueryService } from './queries.ts';
import { InMemoryExplorerIndex } from './store.ts';
import { projectionsEquivalent, verifyIndex } from './verify.ts';

describe('explorer rebuild', () => {
  it('rebuilds from the same finalized chain to an equivalent index', () => {
    const chain = developmentChainFixture(5);
    const first = new ExplorerIndexer(chain, { store: new InMemoryExplorerIndex() });
    first.indexFromGenesis();
    const queries = new ExplorerQueryService(first);
    const saved = {
      home: queries.home(),
      blocks: queries.blocks(undefined, 50),
      moonrey: queries.collection('moonrey'),
      oracles: queries.collection('oracleFacts'),
      hash: canonicalProjectionHash(first.store.projection()),
      json: canonicalProjectionJson(first.store.projection()),
    };

    first.store.dropDerived();
    assert.equal(first.store.projection().blocks.length, 0);

    const second = new ExplorerIndexer(chain, { store: new InMemoryExplorerIndex() });
    second.indexFromGenesis();
    const again = new ExplorerQueryService(second);

    assert.equal(canonicalProjectionHash(second.store.projection()), saved.hash);
    assert.equal(canonicalProjectionJson(second.store.projection()), saved.json);
    assert.equal(again.home().latestFinalizedHeight, saved.home.latestFinalizedHeight);
    assert.equal(again.blocks(undefined, 50).items.length, saved.blocks.items.length);
    assert.equal(again.collection('moonrey').items.length, saved.moonrey.items.length);
    assert.equal(verifyIndex(second.store, chain).ok, true);
    first.indexFromGenesis();
    assert.equal(projectionsEquivalent(first.store, second.store), true);
  });

  it('rebuilds from a height and verifies a range against the chain', () => {
    const chain = developmentChainFixture(6);
    const indexer = new ExplorerIndexer(chain);
    indexer.rebuildFromHeight(2);
    const projection = indexer.store.projection();
    assert.equal(projection.blocks[0]?.height, 2);
    assert.equal(verifyIndex(indexer.store, chain).ok, false);
    indexer.indexFromGenesis();
    assert.equal(verifyIndex(indexer.store, chain).ok, true);
  });
});
