import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  challengeLaunchSigner,
  executeRehearsalFirstBlock,
  rejectFinalizedHistoryRewrite,
  resetPermitRegistry,
  runIsolatedGenesisExecutionRehearsal,
  safeSignerChallengeMessage,
} from './genesis-execution/index.ts';
import { CEREMONY_VALIDATOR_LABELS, sevenDressRehearsalDossiers } from './production-ceremony/validators.ts';

describe('Chunk 88 genesis execution units', () => {
  it('signs a safe challenge that is not a future consensus coordinate', () => {
    const dossiers = sevenDressRehearsalDossiers();
    const first = dossiers[0]!;
    const message = safeSignerChallengeMessage(first.validatorId, 'chn_sunrey_genesis_execution_rehearsal_1');
    assert.match(message.toString('utf8'), /NOT_A_CONSENSUS_BLOCK/);
    assert.match(message.toString('utf8'), /NOT_A_FUTURE_HEIGHT/);
    assert.match(message.toString('utf8'), /NOT_A_FUTURE_ROUND/);
    const challenged = challengeLaunchSigner({
      validatorId: first.validatorId,
      chainId: 'chn_sunrey_genesis_execution_rehearsal_1',
      expectedPublicKey: first.consensusPublicKeyDescriptor,
      labelIndex: CEREMONY_VALIDATOR_LABELS[0]!,
    });
    assert.equal(challenged.ok, true);
  });

  it('converges seven validators on the first state root', () => {
    resetPermitRegistry();
    const session = runIsolatedGenesisExecutionRehearsal();
    const block = executeRehearsalFirstBlock(session.plan);
    assert.equal(block.verified, true);
    assert.equal(block.proposal.height, 1n);
    assert.equal(block.commit.signatures.length, 7);
    assert.equal(block.stateRoot, session.firstBlock?.stateRoot);
  });

  it('never models rewriting finalized history', () => {
    assert.throws(() => rejectFinalizedHistoryRewrite(true), /HISTORY_REWRITE_FORBIDDEN/);
  });
});
