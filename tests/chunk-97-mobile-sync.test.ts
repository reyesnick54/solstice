import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PROTOCOL_CHAIN_ID, PROTOCOL_NETWORK_ID } from '../packages/sunrey-chain/src/protocol/constants.ts';
import { runWalletCommand } from '../packages/sunrey-chain/src/wallet/cli.ts';
import {
  MobileWalletSyncEngine,
  exerciseMobileSyncChaos,
  exerciseMobileSyncNegatives,
} from '../packages/sunrey-chain/src/wallet/mobile-sync/index.ts';
import { connectMobileWallet, getPendingTransactions, syncWallet } from '../packages/sunrey-sdk/src/mobile-sync.ts';

describe('Chunk 97 exit criteria', () => {
  it('synchronizes a rebuildable projection without making it authoritative', () => {
    const mobile = connectMobileWallet({ walletId: 'alice', deviceId: 'exit-phone' });
    mobile.engine.chain.setBalance('bca.alice', 'SUNREY_COIN', '7');
    const result = syncWallet(mobile.client);
    assert.equal('ok' in result, false);
    if ('ok' in result) {
      return;
    }
    assert.ok(result.snapshot);
    assert.equal(result.snapshot.projection.authoritative, false);
    assert.equal(result.snapshot.projection.rebuildable, true);
    assert.equal(mobile.engine.report().selfCustodyKeyOnSyncServer, false);
    assert.equal(mobile.engine.report().fiatMergedWithNative, false);
  });

  it('covers chaos, negatives, SDK pending reads, and CLI', () => {
    const chaos = exerciseMobileSyncChaos(PROTOCOL_NETWORK_ID, PROTOCOL_CHAIN_ID);
    const negatives = exerciseMobileSyncNegatives(PROTOCOL_NETWORK_ID, PROTOCOL_CHAIN_ID);
    assert.equal(Object.values(chaos).every(Boolean), true);
    assert.equal(Object.values(negatives).every(Boolean), true);
    const engine = new MobileWalletSyncEngine();
    engine.createPending({
      walletId: 'alice',
      accountId: 'bca.alice',
      transactionId: 'tx.exit',
      clientTxId: 'c.exit',
      nonce: '1',
      feeAuthorizedMinorUnits: '1',
      bodyHash: '00',
    });
    assert.equal(getPendingTransactions(engine, 'alice').length, 1);
    assert.equal(runWalletCommand(['sync', 'exit', 'phone']).ok, true);
    assert.equal(runWalletCommand(['finality', 'tx.exit']).ok, true);
  });
});
