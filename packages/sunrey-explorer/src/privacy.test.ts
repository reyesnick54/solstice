import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { handleExplorerRequest } from './api.ts';
import { developmentChainFixture } from './fixtures.ts';
import { ExplorerIndexer } from './indexer.ts';
import { assertNoSecrets, explorerExposurePolicy } from './privacy.ts';
import { ExplorerQueryService } from './queries.ts';

describe('explorer privacy', () => {
  it('strips Personal Data Vault, Clean Room, KYC, and key material', () => {
    const projected = explorerExposurePolicy.project({
      address: 'sr1qfaucet000000000000000000000000001',
      privateKey: 'aa',
      seed: 'bb',
      mnemonic: 'cc',
      pdvRaw: { content: 'vault' },
      personalDataVault: 'raw',
      cleanRoomRow: { row: 1 },
      kycRecord: { legalName: 'hidden' },
      screeningResult: { hit: true },
      consentDetail: { purpose: 'hidden' },
      walletKey: 'dd',
      controllerSecret: 'ee',
      mandateSecret: 'ff',
      securityCredential: 'gg',
      validatorInfrastructure: { ip: '10.0.0.1' },
    });
    assert.deepEqual(projected, { address: 'sr1qfaucet000000000000000000000000001' });
    assertNoSecrets(projected);
  });

  it('does not leak secrets through the public API', () => {
    const chain = developmentChainFixture(3);
    const indexer = new ExplorerIndexer(chain);
    indexer.indexFromGenesis();
    const queries = new ExplorerQueryService(indexer);
    for (const path of ['/v1/home', '/v1/accounts', '/v1/moonrey', '/v1/machines', '/v1/validators', '/v1/monetary', '/v1/treasury']) {
      const response = handleExplorerRequest({ method: 'GET', path, query: {} }, queries, indexer);
      assertNoSecrets(JSON.parse(response.body));
      assert.doesNotMatch(response.body, /privateKey|pdvRaw|kycRecord|cleanRoomRow/);
    }
  });
});
