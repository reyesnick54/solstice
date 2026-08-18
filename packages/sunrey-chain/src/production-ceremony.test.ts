import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PURPOSE_TO_CANONICAL, assertPurposeSeparation } from './production-ceremony/keys.ts';
import { backupRecoveryEvidence } from './production-ceremony/session.ts';
import { realCeremonyRemainsExternal } from './production-ceremony/readiness.ts';
import {
  appendTranscriptEntry,
  emptyTranscript,
  tamperTranscript,
  verifyTranscript,
} from './production-ceremony/transcript.ts';

describe('Chunk 85 production ceremony units', () => {
  it('preserves key-purpose separation', () => {
    assert.equal(PURPOSE_TO_CANONICAL.VALIDATOR_CONSENSUS, 'VALIDATOR_CONSENSUS_SIGNING');
    assert.equal(PURPOSE_TO_CANONICAL.RELEASE_AUTHORITY, 'RELEASE_SIGNING');
    assert.throws(() => assertPurposeSeparation('VALIDATOR_CONSENSUS', 'CUSTODY_SIGNING'), /cannot silently acquire/);
  });

  it('requires backup evidence without exporting private keys', () => {
    const evidence = backupRecoveryEvidence('sunrey-ceremony-hsm-simulator');
    assert.equal(evidence.exportedPrivateKey, false);
    assert.equal(evidence.required, true);
  });

  it('keeps the real ceremony external and human', () => {
    const state = realCeremonyRemainsExternal();
    assert.equal(state.performed, false);
    assert.equal(state.rootOfTrust, 'EXTERNAL');
    assert.equal(state.humanAuthorization, 'HUMAN');
  });

  it('invalidates a tampered transcript', () => {
    let transcript = emptyTranscript('sess_unit');
    transcript = appendTranscriptEntry(transcript, {
      action: 'PLAN_BOUND',
      participantRole: 'SYSTEM',
      actorKind: 'SYSTEM',
      occurredAtUtc: '2026-01-01T00:00:00.000Z',
      artifactHashes: ['aa'],
    });
    transcript = appendTranscriptEntry(transcript, {
      action: 'HASH_VERIFIED',
      participantRole: 'PROTOCOL_AUTHORITY',
      actorKind: 'HUMAN',
      occurredAtUtc: '2026-01-01T00:00:00.000Z',
      artifactHashes: ['bb'],
    });
    assert.equal(verifyTranscript(transcript).ok, true);
    assert.equal(verifyTranscript(tamperTranscript(transcript, 'change')).ok, false);
    assert.equal(verifyTranscript(tamperTranscript(transcript, 'remove')).ok, false);
    assert.equal(verifyTranscript(tamperTranscript(transcript, 'reorder')).ok, false);
  });
});
