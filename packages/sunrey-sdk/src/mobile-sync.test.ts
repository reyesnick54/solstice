import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  connectMobileWallet,
  createPaymentRequest,
  getPendingTransactions,
  getSecurityEvents,
  parsePaymentRequest,
  subscribeWallet,
  syncWallet,
  trackFinality,
} from './mobile-sync.ts';

describe('Chunk 97 SDK mobile wallet interfaces', () => {
  it('exposes syncWallet, subscribeWallet, trackFinality, and payment-request helpers', () => {
    const mobile = connectMobileWallet({ walletId: 'alice', deviceId: 'sdk-phone' });
    mobile.engine.chain.setBalance('bca.alice', 'SUNREY_COIN', '9');
    const synced = syncWallet(mobile.client);
    assert.equal('ok' in synced, false);
    subscribeWallet(mobile.engine, {
      deviceId: 'sdk-phone',
      walletId: 'alice',
      pushToken: 'routing-only',
    });
    mobile.engine.createPending({
      walletId: 'alice',
      accountId: 'bca.alice',
      transactionId: 'tx.sdk',
      clientTxId: 'c.sdk',
      nonce: '1',
      feeAuthorizedMinorUnits: '1',
      bodyHash: '00',
      state: 'MEMPOOL_ACCEPTED',
    });
    const pending = getPendingTransactions(mobile.engine, 'alice');
    assert.equal(pending.length, 1);
    const finality = trackFinality(mobile.engine, 'tx.sdk');
    assert.equal(finality.finalized, false);
    const request = createPaymentRequest({
      networkId: mobile.engine.networkId,
      chainId: mobile.engine.chainId,
      recipient: 'srdev1bob',
      assetId: 'SUNREY_COIN',
    });
    const parsed = parsePaymentRequest(
      `sunrey:pay/1?v=1&n=${request.networkId}&c=${request.chainId}&r=srdev1bob&a=SUNREY_COIN`,
      { networkId: request.networkId, chainId: request.chainId },
    );
    assert.equal('ok' in parsed, false);
    const security = getSecurityEvents(mobile.engine, 'alice');
    assert.ok(security.length >= 1);
  });
});
