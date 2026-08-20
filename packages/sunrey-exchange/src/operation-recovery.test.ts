import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ExchangeSettlementRecovery } from './operation-recovery.ts';

describe('exchange settlement recovery', () => {
  it('restarts between DVP phases without a second settlement', async () => {
    const recovery = new ExchangeSettlementRecovery();
    await recovery.prepare(
      {
        tradeId: 'tr_1',
        settlementId: 'set_1',
        buyAssetId: 'SUNREY_COIN',
        sellAssetId: 'MOONREY_COIN',
        buyQuantityMinor: '10',
        sellQuantityMinor: '20',
      },
      '2026-08-20T11:00:00.000Z',
    );
    recovery.recordTrade();
    recovery.reserve();
    recovery.startDvp();
    recovery.finalizeChainLeg();
    recovery.markAccountingUncertain();
    recovery.applySettlementCallback();
    assert.equal(recovery.restart(), 'SETTLED');
    assert.equal(recovery.restartSafe(), true);
    assert.equal(recovery.duplicateCallbackIsNoop(), true);
  });
});
