import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { APPROVAL_BINDING_CHANGED, QUERY_REQUIRED_BEFORE_RETRY } from '../../events/src/operation/index.ts';
import { CustodyWithdrawalRecovery } from './operation-recovery.ts';

const NOW = '2026-08-20T11:00:00.000Z';

describe('custody withdrawal recovery', () => {
  it('queries before retry and refuses a changed approval binding', async () => {
    const recovery = new CustodyWithdrawalRecovery(undefined, {
      submit: async () => ({
        kind: 'AMBIGUOUS',
        safeErrorCode: 'BROADCAST_TIMEOUT',
        safeErrorMessage: 'ambiguous',
        providerOperationRef: 'tx_1',
      }),
      query: async () => ({ kind: 'PENDING', providerOperationRef: 'tx_1' }),
      queryChain: async () => ({ kind: 'CONFIRMED', providerOperationRef: 'tx_1' }),
    });
    const approval = {
      destination: 'addr_moon_1',
      assetId: 'MOONREY_COIN',
      quantityMinor: '100',
      feePolicyId: 'fee_std',
      network: 'sunrey-chain',
      canonicalSemantics: 'native_withdraw_v1',
    };
    const draft = {
      withdrawalId: 'wd_1',
      providerId: 'custody_sim_a',
      quantityMinor: '100',
      assetId: 'MOONREY_COIN',
      nativeAssetId: 'MOONREY_COIN',
      destination: 'addr_moon_1',
      network: 'sunrey-chain',
      feePolicyId: 'fee_std',
      canonicalSemantics: 'native_withdraw_v1',
      approval,
    };
    recovery.bindApproval(draft);
    const prepared = await recovery.prepare(draft, NOW);
    const unknown = await recovery.submitPrepared(prepared, () => NOW);
    await assert.rejects(() => recovery.retryUnknown(unknown), (error: Error) => {
      return error.name === QUERY_REQUIRED_BEFORE_RETRY;
    });
    const recovered = await recovery.recoverByQuery(unknown, NOW);
    assert.equal(typeof recovered === 'object', true);
    assert.equal(recovery.duplicateWithdrawalCreated(), false);
    assert.equal(recovery.approvalDuplicated(), false);
    assert.throws(
      () => recovery.assertApprovalReusable(approval, { ...approval, destination: 'addr_other' }),
      (error: Error) => error.name === APPROVAL_BINDING_CHANGED,
    );
    const late = recovery.applyLateCustodyStatus('FINALIZED', 'SUBMITTED');
    assert.equal(late.applied, false);
  });
});
