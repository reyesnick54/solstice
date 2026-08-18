import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { handleExplorerRequest } from './api.ts';
import { runExplorerCommand } from './cli.ts';
import { developmentChainFixture } from './fixtures.ts';
import { ExplorerIndexer } from './indexer.ts';
import { explorerExposurePolicy } from './privacy.ts';
import { ExplorerQueryService } from './queries.ts';
import { sanitizeSearchQuery } from './search.ts';

function ready() {
  const chain = developmentChainFixture(4);
  const indexer = new ExplorerIndexer(chain);
  indexer.indexFromGenesis();
  const queries = new ExplorerQueryService(indexer);
  return { chain, indexer, queries };
}

describe('sunrey explorer', () => {
  it('indexes finalized blocks, transactions, and economic views', () => {
    const { queries, indexer } = ready();
    const home = queries.home();
    assert.equal(home.networkLabel, 'DEVELOPMENT');
    assert.equal(home.latestFinalizedHeight, 3);
    assert.equal(home.supplyIsNotMarketCap, true);
    assert.equal(queries.block('2')?.stateRoot, 'state_2');
    assert.equal(queries.transaction('tx_h1_1')?.type, 'NATIVE_TRANSFER');
    assert.equal(queries.account('sr1qfaucet000000000000000000000000001')?.notABankAccount, true);
    assert.equal(queries.asset('MOONREY_COIN')?.publicTickerStatus, 'NOT_ASSIGNED');
    assert.equal(queries.asset('MOONREY_COIN')?.notMarketCapitalization, true);
    assert.equal(indexer.store.projection().moonrey[0]?.formulaVersion, 'moonrey.issuance.formula.v1');
    assert.equal(indexer.store.projection().oracleFacts[0]?.artifactKind, 'PROTOCOL_VERIFIED_DATA_ARTIFACT');
    assert.equal(indexer.store.projection().validators.length, 2);
    assert.equal(indexer.store.projection().governance[0]?.proposalId, 'gov_upgrade_1');
    assert.equal(indexer.store.projection().interopPackets[0]?.developmentOnly, true);
    assert.equal(indexer.store.projection().machines[0]?.machineId, 'mach_compute_1');
    assert.equal(indexer.store.projection().settlements[0]?.settlementId, 'setl_dev_1');
    assert.equal(indexer.store.projection().evidence[0]?.kind, 'DOUBLE_PREVOTE');
  });

  it('default-denies unpublished fields and never emits secrets', () => {
    const leaked = explorerExposurePolicy.project({
      blockId: 'blk_1',
      privateKey: 'SECRET',
      kycRecord: { name: 'hidden' },
      consentDetail: 'no',
      pdvRaw: 'vault',
      cleanRoomRow: [1],
      unknownField: 'drop-me',
    });
    assert.deepEqual(leaked, { blockId: 'blk_1' });
    assert.equal(explorerExposurePolicy.classify('unknownField'), 'FORBIDDEN');
    assert.equal(explorerExposurePolicy.isPublic('holdings'), true);
  });

  it('rejects unbounded or SQL-like search queries', () => {
    assert.equal('code' in sanitizeSearchQuery('1; DROP TABLE blocks'), true);
    assert.equal('code' in sanitizeSearchQuery('select * from accounts'), true);
    assert.equal('code' in sanitizeSearchQuery('a'.repeat(200)), true);
    const { queries } = ready();
    const hits = queries.search('iss_moonrey_1');
    assert.ok(!('code' in hits));
    assert.equal(hits.items[0]?.kind, 'MOONREY_ISSUANCE');
    const heightHit = queries.search('2');
    assert.ok(!('code' in heightHit));
    assert.equal(heightHit.items[0]?.kind, 'BLOCK');
    const validatorHit = queries.search('val_dev_1');
    assert.ok(!('code' in validatorHit));
    assert.equal(validatorHit.items[0]?.kind, 'VALIDATOR');
    const packetHit = queries.search('pkt_dev_1');
    assert.ok(!('code' in packetHit));
    assert.equal(packetHit.items[0]?.kind, 'INTEROP_PACKET');
    const govHit = queries.search('gov_upgrade_1');
    assert.ok(!('code' in govHit));
    assert.equal(govHit.items[0]?.kind, 'GOVERNANCE');
    const setlHit = queries.search('setl_dev_1');
    assert.ok(!('code' in setlHit));
    assert.equal(setlHit.items[0]?.kind, 'EXCHANGE_SETTLEMENT');
  });

  it('serves a read-only API with cursor pages and lag fields', () => {
    const { queries, indexer } = ready();
    const blocks = handleExplorerRequest(
      { method: 'GET', path: '/v1/blocks', query: { limit: '2' } },
      queries,
      indexer,
    );
    const body = JSON.parse(blocks.body) as {
      items: unknown[];
      nextCursor: string;
      indexed_finalized_height: number;
      chain_finalized_height: number;
      index_lag: number;
    };
    assert.equal(blocks.status, 200);
    assert.equal(body.items.length, 2);
    assert.equal(body.nextCursor, '1');
    assert.equal(body.indexed_finalized_height, 3);
    assert.equal(body.index_lag, 0);
    const moonrey = handleExplorerRequest({ method: 'GET', path: '/v1/moonrey', query: {} }, queries, indexer);
    assert.match(moonrey.body, /iss_moonrey_1/);
    const monetary = handleExplorerRequest({ method: 'GET', path: '/v1/monetary', query: {} }, queries, indexer);
    assert.equal(monetary.status, 200);
    assert.match(monetary.body, /sunrey.monetary.constitution.v1/);
    assert.match(monetary.body, /SUNREY_COIN/);
    assert.match(monetary.body, /supplyReconciliation/);
    assert.doesNotMatch(monetary.body, /marketCap|market_cap|marketCapitalization/);
    const fees = handleExplorerRequest({ method: 'GET', path: '/v1/fees', query: {} }, queries, indexer);
    assert.equal(fees.status, 200);
    assert.match(fees.body, /FeePolicyV2/);
    assert.match(fees.body, /UNCONFIGURED/);
    const treasury = handleExplorerRequest({ method: 'GET', path: '/v1/treasury', query: {} }, queries, indexer);
    assert.equal(treasury.status, 200);
    assert.match(treasury.body, /SUNREY_BLOCKCHAIN_TREASURY/);
    assert.match(treasury.body, /UNCONFIGURED/);
    assert.match(treasury.body, /PROTOCOL TREASURY/);
    assert.match(treasury.body, /distinctFromFiatLedger/);
    assert.match(treasury.body, /distinctFromCustomerCustody/);
    assert.match(treasury.body, /SUNREY_BLOCKCHAIN_TREASURY|PROTOCOL TREASURY/);
    assert.match(treasury.body, /UNCONFIGURED|distinctFromFiatLedger/);
    const economics = handleExplorerRequest({ method: 'GET', path: '/v1/validators/economics', query: {} }, queries, indexer);
    assert.equal(economics.status, 200);
    assert.match(economics.body, /bondAsset/);
    const bad = handleExplorerRequest({ method: 'POST', path: '/v1/blocks', query: {} }, queries, indexer);
    assert.equal(bad.status, 405);
    const search = handleExplorerRequest(
      { method: 'GET', path: '/v1/search', query: { q: "tx' OR 1=1" } },
      queries,
      indexer,
    );
    assert.equal(search.status, 400);
  });

  it('exposes indexer metrics', () => {
    const { indexer } = ready();
    const snap = indexer.metrics.snapshot();
    assert.equal(snap.explorer_indexed_height, 3);
    assert.equal(snap.explorer_lag_blocks, 0);
    assert.ok(snap.explorer_blocks_indexed_total >= 4);
    assert.match(indexer.metrics.renderPrometheus(), /explorer_indexed_height 3/);
  });

  it('runs CLI index, rebuild, verify, and status', async () => {
    const indexed = await runExplorerCommand(['index']);
    assert.equal(indexed.ok, true);
    const rebuilt = await runExplorerCommand(['rebuild']);
    assert.equal(rebuilt.ok, true);
    const verified = await runExplorerCommand(['verify']);
    assert.equal(verified.ok, true);
    const status = await runExplorerCommand(['status']);
    assert.equal(status.ok, true);
  });
});
