import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { QUERY_REQUIRED_BEFORE_RETRY } from '../../events/src/operation/index.ts';
import { HinAnchorRecovery } from './network/chain-anchor/operation-recovery.ts';

const NOW = '2026-08-20T11:00:00.000Z';

describe('HIN chain-anchor recovery', () => {
  it('does not create a second economically distinct anchor after a lost response', async () => {
    const recovery = new HinAnchorRecovery(undefined, {
      submit: async () => ({
        kind: 'AMBIGUOUS',
        safeErrorCode: 'RESPONSE_LOST',
        safeErrorMessage: 'submitted_unknown',
        providerOperationRef: 'tx_anchor_1',
      }),
      query: async () => ({ kind: 'CONFIRMED', providerOperationRef: 'tx_anchor_1' }),
    });
    const prepared = await recovery.prepare(
      {
        anchorIntentId: 'hin_intent_1',
        contentCommitment: 'commit_abc',
        providerId: 'hin.chain',
      },
      NOW,
    );
    const unknown = await recovery.submitPrepared(prepared, () => NOW);
    await assert.rejects(() => recovery.retryUnknown(unknown), (error: Error) => {
      return error.name === QUERY_REQUIRED_BEFORE_RETRY;
    });
    const recovered = await recovery.recoverByQuery(unknown, NOW);
    assert.equal(recovered.record.state, 'CONFIRMED');
    assert.equal(recovery.economicallyDistinctAnchors(), 1);
    const late = recovery.applyLateAnchorStatus('FINALIZED', 'SUBMITTED');
    assert.equal(late.applied, false);
  });
});
