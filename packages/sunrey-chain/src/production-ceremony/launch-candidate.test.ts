import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_EXCHANGE_ENABLED, LIVE_MONEY_ENABLED } from '../../../config/src/flags.ts';
import { findPrivateKeyLeakage } from '../../../security/src/crypto-leakage.ts';
import { tamperTranscript, verifyTranscript } from './transcript.ts';
import { CeremonyCandidateMismatchError } from './launch-candidate/abort.ts';
import { abortCeremony, abortPreservesAuditHistory } from './launch-candidate/abort.ts';
import {
  createFixtureApprovalSignature,
  deriveFixturePublicKey,
  economicSignatureCountsAsGenesis,
  fixtureSignatureIsRealHumanAuthorization,
} from './launch-candidate/approvals.ts';
import {
  changedLaunchFreezeBinding,
  fixtureEvidenceWatch,
  fixtureLaunchCandidateFreeze,
  fixtureLaunchFreezeBinding,
  fixtureLaunchParticipants,
  LAUNCH_AUTH_EXPIRES,
  LAUNCH_AUTH_REHEARSAL_NOW,
  LAUNCH_AUTH_SESSION_B,
  LAUNCH_AUTH_VALID_FROM,
  openFixtureLaunchSession,
  runLaunchAuthorizationDressRehearsal,
} from './launch-candidate/fixtures.ts';
import { exportOfflineSigningPackage } from './launch-candidate/offline.ts';
import { createLaunchCeremonyPlan } from './launch-candidate/plan.ts';
import { observationFromFreeze } from '../release-candidate/mainnet/launch-freeze/index.ts';
import { registerLaunchParticipant } from './launch-candidate/participants.ts';
import { appendLaunchTranscript } from './launch-candidate/transcript.ts';
import {
  bindFrozenCandidate,
  ceremonyCannotAlterLiveFlags,
  ceremonyCannotEnableMainnet,
  ceremonyCannotMint,
  importLaunchSignature,
  observeCurrentCandidate,
  observeEvidenceWatch,
  observeLaunchFreezeStaleness,
  productionRemainsInactive,
  recordOfflineExport,
  simulationHsmIsRealHsm,
  verifyLaunchParticipants,
} from './launch-candidate/verify.ts';

describe('Chunk 165 frozen launch authorization ceremony', () => {
  it('1. binds the freeze hash', () => {
    const freeze = fixtureLaunchCandidateFreeze();
    const binding = fixtureLaunchFreezeBinding();
    const session = bindFrozenCandidate(openFixtureLaunchSession(), LAUNCH_AUTH_REHEARSAL_NOW);
    assert.equal(binding.launchFreezeHash, freeze.freezeHash);
    assert.equal(session.binding.launchFreezeHash, freeze.freezeHash);
    assert.equal(session.binding.genesisHash, freeze.genesisCandidateHash);
    assert.equal(session.binding.economicAuthorizationHash, freeze.productionEconomicAuthorizationHash);
    assert.equal(session.transcript.entries[0]?.action, 'CANDIDATE_FREEZE_BOUND');
  });

  it('2. aborts when the freeze changes mid-ceremony', () => {
    const session = bindFrozenCandidate(openFixtureLaunchSession(), LAUNCH_AUTH_REHEARSAL_NOW);
    const changed = changedLaunchFreezeBinding({
      sourceCommit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    });
    assert.notEqual(changed.launchFreezeHash, session.binding.launchFreezeHash);
    assert.throws(
      () => observeCurrentCandidate(session, changed, LAUNCH_AUTH_REHEARSAL_NOW),
      (error: unknown) =>
        error instanceof CeremonyCandidateMismatchError && error.code === 'CEREMONY_CANDIDATE_MISMATCH',
    );
  });

  it('3. aborts when genesis changes', () => {
    const session = bindFrozenCandidate(openFixtureLaunchSession(), LAUNCH_AUTH_REHEARSAL_NOW);
    const changed = changedLaunchFreezeBinding({ genesisCandidateHash: '9'.repeat(64) });
    assert.throws(() => observeCurrentCandidate(session, changed, LAUNCH_AUTH_REHEARSAL_NOW), /CEREMONY_CANDIDATE_MISMATCH/);
  });

  it('4. aborts when economic authorization changes', () => {
    const session = bindFrozenCandidate(openFixtureLaunchSession(), LAUNCH_AUTH_REHEARSAL_NOW);
    const changed = changedLaunchFreezeBinding({
      productionEconomicAuthorizationHash: '8'.repeat(64),
    });
    assert.throws(() => observeCurrentCandidate(session, changed, LAUNCH_AUTH_REHEARSAL_NOW), /CEREMONY_CANDIDATE_MISMATCH/);
  });

  it('does not recompute a stale freeze and continue', () => {
    const freeze = fixtureLaunchCandidateFreeze();
    const session = bindFrozenCandidate(openFixtureLaunchSession(), LAUNCH_AUTH_REHEARSAL_NOW);
    const staleObservation = {
      ...observationFromFreeze(freeze),
      genesisCandidateHash: '9'.repeat(64),
    };
    assert.throws(
      () => observeLaunchFreezeStaleness(session, freeze, staleObservation, LAUNCH_AUTH_REHEARSAL_NOW),
      (error: unknown) =>
        error instanceof CeremonyCandidateMismatchError &&
        error.session.binding.launchFreezeHash === freeze.freezeHash &&
        error.session.state === 'ABORTED',
    );
  });

  it('5. aborts when external evidence expires', () => {
    let session = bindFrozenCandidate(openFixtureLaunchSession(), LAUNCH_AUTH_REHEARSAL_NOW);
    session = observeEvidenceWatch(
      session,
      fixtureEvidenceWatch({ expiresAtUtc: '2026-08-20T00:00:00.000Z' }),
      LAUNCH_AUTH_REHEARSAL_NOW,
    );
    assert.equal(session.state, 'ABORTED');
    assert.equal(session.abort?.code, 'EXTERNAL_EVIDENCE_EXPIRED');
  });

  it('6. aborts when evidence is revoked', () => {
    let session = bindFrozenCandidate(openFixtureLaunchSession(), LAUNCH_AUTH_REHEARSAL_NOW);
    session = observeEvidenceWatch(session, fixtureEvidenceWatch({ revoked: true }), LAUNCH_AUTH_REHEARSAL_NOW);
    assert.equal(session.state, 'ABORTED');
    assert.equal(session.abort?.code, 'EXTERNAL_EVIDENCE_REVOKED');
  });

  it('7. binds participant roles', () => {
    const participants = fixtureLaunchParticipants();
    const session = verifyLaunchParticipants(
      bindFrozenCandidate(openFixtureLaunchSession(), LAUNCH_AUTH_REHEARSAL_NOW),
      participants,
      LAUNCH_AUTH_REHEARSAL_NOW,
    );
    assert.equal(session.participants[0]?.role, 'GENESIS_AUTHORITY');
    assert.ok(session.transcript.entries.some((entry) => entry.action === 'PARTICIPANT_VERIFIED'));
  });

  it('8. rejects an AI participant for a required human role', () => {
    assert.throws(
      () =>
        registerLaunchParticipant({
          participantId: 'ai-genesis',
          displayName: 'ai',
          role: 'GENESIS_AUTHORITY',
          actorKind: 'AI',
          publicSigningDescriptor: 'aa'.repeat(32),
        }),
      /AI or automation cannot occupy required human role/,
    );
  });

  it('9. rejects a service for a human role', () => {
    assert.throws(
      () =>
        registerLaunchParticipant({
          participantId: 'svc-genesis',
          displayName: 'service',
          role: 'SECURITY_AUTHORITY',
          actorKind: 'SERVICE',
          publicSigningDescriptor: 'bb'.repeat(32),
        }),
      /cannot occupy required human role|service cannot satisfy/,
    );
  });

  it('10. rejects a session A signature in session B', () => {
    const participants = fixtureLaunchParticipants();
    const sessionA = verifyLaunchParticipants(
      bindFrozenCandidate(openFixtureLaunchSession(), LAUNCH_AUTH_REHEARSAL_NOW),
      participants,
      LAUNCH_AUTH_REHEARSAL_NOW,
    );
    const sessionB = verifyLaunchParticipants(
      bindFrozenCandidate(openFixtureLaunchSession(LAUNCH_AUTH_SESSION_B), LAUNCH_AUTH_REHEARSAL_NOW),
      participants,
      LAUNCH_AUTH_REHEARSAL_NOW,
    );
    const pkg = exportOfflineSigningPackage({
      identity: sessionA.identity,
      binding: sessionA.binding,
      participant: participants[0]!,
      approvalStatement: 'APPROVE_GENESIS_CANDIDATE',
      validFromUtc: LAUNCH_AUTH_VALID_FROM,
      expiresAtUtc: LAUNCH_AUTH_EXPIRES,
    });
    const signature = createFixtureApprovalSignature({
      participant: participants[0]!,
      pkg,
      identity: sessionA.identity,
      signedAtUtc: LAUNCH_AUTH_REHEARSAL_NOW,
    });
    assert.throws(
      () =>
        importLaunchSignature(sessionB, {
          participant: participants[0]!,
          pkg,
          signature,
          nowUtc: LAUNCH_AUTH_REHEARSAL_NOW,
          intendedSessionId: sessionB.sessionId,
        }),
      /session A signature rejected by session B/,
    );
  });

  it('11. rejects a signature role mismatch', () => {
    const participants = fixtureLaunchParticipants();
    const session = verifyLaunchParticipants(
      bindFrozenCandidate(openFixtureLaunchSession(), LAUNCH_AUTH_REHEARSAL_NOW),
      participants,
      LAUNCH_AUTH_REHEARSAL_NOW,
    );
    const pkg = exportOfflineSigningPackage({
      identity: session.identity,
      binding: session.binding,
      participant: participants[0]!,
      approvalStatement: 'APPROVE_GENESIS_CANDIDATE',
      validFromUtc: LAUNCH_AUTH_VALID_FROM,
      expiresAtUtc: LAUNCH_AUTH_EXPIRES,
    });
    const signature = createFixtureApprovalSignature({
      participant: participants[0]!,
      pkg,
      identity: session.identity,
      signedAtUtc: LAUNCH_AUTH_REHEARSAL_NOW,
    });
    assert.throws(
      () =>
        importLaunchSignature(session, {
          participant: participants[0]!,
          pkg,
          signature,
          nowUtc: LAUNCH_AUTH_REHEARSAL_NOW,
          intendedRole: 'PROTOCOL_AUTHORITY',
        }),
      /signature role mismatch rejected/,
    );
  });

  it('12. rejects an expired approval', () => {
    const participants = fixtureLaunchParticipants();
    const session = verifyLaunchParticipants(
      bindFrozenCandidate(openFixtureLaunchSession(), LAUNCH_AUTH_REHEARSAL_NOW),
      participants,
      LAUNCH_AUTH_REHEARSAL_NOW,
    );
    const pkg = exportOfflineSigningPackage({
      identity: session.identity,
      binding: session.binding,
      participant: participants[0]!,
      approvalStatement: 'APPROVE_GENESIS_CANDIDATE',
      validFromUtc: '2026-01-01T00:00:00.000Z',
      expiresAtUtc: '2026-01-02T00:00:00.000Z',
    });
    const signature = createFixtureApprovalSignature({
      participant: participants[0]!,
      pkg,
      identity: session.identity,
      signedAtUtc: '2026-01-01T12:00:00.000Z',
    });
    assert.throws(
      () =>
        importLaunchSignature(session, {
          participant: participants[0]!,
          pkg,
          signature,
          nowUtc: LAUNCH_AUTH_REHEARSAL_NOW,
        }),
      /expired approval rejected/,
    );
  });

  it('13. keeps the transcript ordered', () => {
    const rehearsal = runLaunchAuthorizationDressRehearsal();
    for (const [index, entry] of rehearsal.session.transcript.entries.entries()) {
      assert.equal(entry.sequence, index + 1);
      if (index > 0) {
        assert.equal(entry.previousEntryHash, rehearsal.session.transcript.entries[index - 1]!.entryHash);
      }
    }
  });

  it('14. detects transcript tamper', () => {
    const rehearsal = runLaunchAuthorizationDressRehearsal();
    assert.equal(verifyTranscript(rehearsal.session.transcript).ok, true);
    assert.equal(verifyTranscript(tamperTranscript(rehearsal.session.transcript, 'change')).ok, false);
    assert.equal(verifyTranscript(tamperTranscript(rehearsal.session.transcript, 'remove')).ok, false);
    assert.equal(verifyTranscript(tamperTranscript(rehearsal.session.transcript, 'reorder')).ok, false);
  });

  it('15. refuses private key material in the transcript', () => {
    const session = openFixtureLaunchSession();
    assert.throws(
      () =>
        appendLaunchTranscript(session.transcript, {
          action: 'CANDIDATE_FREEZE_BOUND',
          participantRole: 'SYSTEM',
          actorKind: 'SYSTEM',
          publicContribution: 'BEGIN PRIVATE KEY',
          occurredAtUtc: LAUNCH_AUTH_REHEARSAL_NOW,
        }),
      /secret string value rejected in transcript|private key cannot enter/,
    );
  });

  it('16. refuses secrets in the offline package', () => {
    const rehearsal = runLaunchAuthorizationDressRehearsal();
    for (const pkg of rehearsal.session.offlinePackages) {
      assert.equal(pkg.containsSecretKeyMaterial, false);
      assert.equal(pkg.containsPrivateKey, false);
      assert.equal(findPrivateKeyLeakage(pkg).length, 0);
    }
  });

  it('17. treats simulation HSM as not a real HSM', () => {
    assert.equal(simulationHsmIsRealHsm(), false);
    const rehearsal = runLaunchAuthorizationDressRehearsal();
    assert.equal(rehearsal.session.hsmClass, 'SIMULATION_HSM');
    assert.equal(rehearsal.session.hsmAttestation?.simulation, true);
  });

  it('18. treats fixture signatures as not real human authorization', () => {
    const rehearsal = runLaunchAuthorizationDressRehearsal();
    assert.equal(rehearsal.realHumanSignaturesCollected, false);
    assert.equal(fixtureSignatureIsRealHumanAuthorization(rehearsal.session.signatures[0]!), false);
    assert.equal(rehearsal.session.authorization?.class, 'REHEARSAL_PACKAGE');
  });

  it('19. does not treat an economic signature as a genesis signature', () => {
    const participants = fixtureLaunchParticipants();
    const economic = participants.find((row) => row.role === 'ECONOMIC_POLICY_AUTHORITY')!;
    const session = verifyLaunchParticipants(
      bindFrozenCandidate(openFixtureLaunchSession(), LAUNCH_AUTH_REHEARSAL_NOW),
      participants,
      LAUNCH_AUTH_REHEARSAL_NOW,
    );
    const pkg = exportOfflineSigningPackage({
      identity: session.identity,
      binding: session.binding,
      participant: economic,
      approvalStatement: 'APPROVE_ECONOMIC_PARAMETER_PACKAGE',
      validFromUtc: LAUNCH_AUTH_VALID_FROM,
      expiresAtUtc: LAUNCH_AUTH_EXPIRES,
    });
    const signature = createFixtureApprovalSignature({
      participant: economic,
      pkg,
      identity: session.identity,
      signedAtUtc: LAUNCH_AUTH_REHEARSAL_NOW,
    });
    assert.equal(economicSignatureCountsAsGenesis(signature), false);
  });

  it('20. preserves audit history on abort', () => {
    const session = bindFrozenCandidate(openFixtureLaunchSession(), LAUNCH_AUTH_REHEARSAL_NOW);
    const aborted = abortCeremony(session, {
      code: 'CEREMONY_ABORTED',
      reason: 'operator abort',
      occurredAtUtc: LAUNCH_AUTH_REHEARSAL_NOW,
    });
    assert.equal(abortPreservesAuditHistory(aborted), true);
    assert.ok(aborted.transcript.entries.some((entry) => entry.action === 'CEREMONY_ABORTED'));
    assert.equal(aborted.abort?.transcriptPreserved, true);
  });

  it('21. cannot enable mainnet', () => {
    const rehearsal = runLaunchAuthorizationDressRehearsal();
    assert.equal(ceremonyCannotEnableMainnet(rehearsal.session), false);
    assert.equal(rehearsal.mainnetEnabled, false);
  });

  it('22. cannot mint', () => {
    const rehearsal = runLaunchAuthorizationDressRehearsal();
    assert.equal(ceremonyCannotMint(rehearsal.session), false);
    assert.equal(rehearsal.session.authorization?.mintsPostGenesisCoins, false);
  });

  it('23. cannot alter LIVE flags', () => {
    assert.equal(ceremonyCannotAlterLiveFlags(), false);
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
    assert.equal(ENVIRONMENT, 'simulation');
  });

  it('24. keeps production inactive', () => {
    const rehearsal = runLaunchAuthorizationDressRehearsal();
    assert.equal(productionRemainsInactive(rehearsal.session), false);
    assert.equal(rehearsal.productionActive, false);
    assert.equal(rehearsal.session.state, 'REHEARSAL_COMPLETE');
  });

  it('exports offline packages without leaking fixture private keys', () => {
    const participants = fixtureLaunchParticipants();
    const session = verifyLaunchParticipants(
      bindFrozenCandidate(openFixtureLaunchSession(), LAUNCH_AUTH_REHEARSAL_NOW),
      participants,
      LAUNCH_AUTH_REHEARSAL_NOW,
    );
    const pkg = exportOfflineSigningPackage({
      identity: session.identity,
      binding: session.binding,
      participant: participants[0]!,
      approvalStatement: 'APPROVE_GENESIS_CANDIDATE',
      validFromUtc: LAUNCH_AUTH_VALID_FROM,
      expiresAtUtc: LAUNCH_AUTH_EXPIRES,
    });
    const recorded = recordOfflineExport(session, [pkg], LAUNCH_AUTH_REHEARSAL_NOW);
    assert.equal(recorded.offlinePackages[0]?.containsSecretKeyMaterial, false);
    assert.equal(deriveFixturePublicKey(participants[0]!.participantId), participants[0]!.publicSigningDescriptor);
    assert.equal(createLaunchCeremonyPlan({ binding: fixtureLaunchFreezeBinding() }).usableForProduction, false);
  });
});
