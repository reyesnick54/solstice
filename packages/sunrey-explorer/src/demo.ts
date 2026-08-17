import { canonicalProjectionHash } from './canonical.ts';
import { developmentChainFixture, nextBlock } from './fixtures.ts';
import { ExplorerIndexer } from './indexer.ts';
import { ExplorerQueryService } from './queries.ts';
import { InMemoryExplorerIndex } from './store.ts';
import { verifyIndex } from './verify.ts';

function main(): void {
  console.log('============================================================');
  console.log('SunRey explorer — rebuildable projection (not authority)');
  console.log('NETWORK=DEVELOPMENT  ENVIRONMENT=simulation');
  console.log('Canonical authority: finalized SunRey Blockchain state');
  console.log('============================================================');

  const chain = developmentChainFixture(4);
  const indexer = new ExplorerIndexer(chain);
  indexer.indexFromGenesis();
  const queries = new ExplorerQueryService(indexer);
  const home = queries.home();
  const firstHash = canonicalProjectionHash(indexer.store.projection());
  const report = verifyIndex(indexer.store, chain);

  console.log(`indexed_finalized_height=${home.indexed_finalized_height}`);
  console.log(`chain_finalized_height=${home.chain_finalized_height}`);
  console.log(`index_lag=${home.index_lag}`);
  console.log(`network=${home.networkLabel}`);
  console.log(`sunrey_development_supply=${home.sunreyDevelopmentSupply} (not market cap)`);
  console.log(`moonrey_development_supply=${home.moonreyDevelopmentSupply} (not market cap)`);
  console.log(`moonrey_issuance=${indexer.store.projection().moonrey[0]?.issuanceId}`);
  console.log(`verify_ok=${report.ok}`);

  const saved = indexer.store.projection();
  indexer.store.dropDerived();
  indexer.indexFromGenesis();
  const rebuilt = canonicalProjectionHash(indexer.store.projection());
  if (rebuilt !== firstHash) {
    throw new Error('rebuild did not match canonical projection');
  }
  console.log(`rebuild_hash=${rebuilt}`);
  console.log(`saved_blocks=${saved.blocks.length} rebuilt_blocks=${indexer.store.projection().blocks.length}`);

  const lagging = new ExplorerIndexer(chain, { store: new InMemoryExplorerIndex() });
  lagging.indexFromGenesis();
  chain.appendBlock(nextBlock(chain));
  const before = lagging.status().lag;
  lagging.catchUp();
  if (lagging.status().lag !== 0 || before < 1) {
    throw new Error('indexer failed to catch up from finalized history');
  }
  console.log('catch_up=ok chain_continued_without_explorer=ok');
  console.log('explorer demo: ok');
}

main();
