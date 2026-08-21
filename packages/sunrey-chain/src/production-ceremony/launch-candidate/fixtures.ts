/**
 * Dress-rehearsal fixtures for the frozen-candidate launch ceremony.
 *
 * Current repository truthfully remains REHEARSAL_COMPLETE. Fixture
 * signatures are not real human authorization. Simulation HSM is not
 * a real HSM. No production private keys are created.
 */

import { createSimulationAttestation } from '../hsm.ts';
import { CeremonyCandidateMismatchError } from './abort.ts';
import { abortPreservesAuditHistory } from './abort.ts';
import { createFixtureApprovalSignature } from './approvals.ts';
import { exportOfflineSigningPackage, statementForScope } from './offline.ts';
import { bindingFromLaunchFreeze, createLaunchCeremonyPlan, openLaunchCeremonySession } from './plan.ts';
import { deriveFixturePublicKey } from './approvals.ts';
import { registerLaunchParticipant } from './participants.ts';
import {
  bindFrozenCandidate,
  importLaunchSignature,
  observeCurrentCandidate,
  recordOfflineExport,
  sealRehearsalAuthorization,
  verifyLaunchParticipants,
  verifySimulationHsm,
} from './verify.ts';
import { buildLaunchCeremonyReport } from './report.ts';
import type {
  CeremonyEvidenceWatch,
  LaunchAuthorizationDressRehearsal,
  LaunchCeremonyParticipant,
  ProductionLaunchCeremonyBinding,
} from './types.ts';

export const LAUNCH_AUTH_REHEARSAL_ID = 'rehearsal_sunrey_launch_authorization_ceremony_1' as const;
export const LAUNCH_AUTH_REHEARSAL_NOW = '2026-08-21T00:00:00.000Z' as const;
export const LAUNCH_AUTH_VALID_FROM = '2026-08-21T00:00:00.000Z' as const;
export const LAUNCH_AUTH_EXPIRES = '2026-08-28T00:00:00.000Z' as const;
export const LAUNCH_AUTH_SESSION_A = 'sess_launch_auth_rehearsal_a' as const;
export const LAUNCH_AUTH_SESSION_B = 'sess_launch_auth_rehearsal_b' as const;

export function fixtureLaunchFreezeFields() {
  return {
    launchFreezeId: 'freeze.sunrey.launch-candidate.rehearsal.v1',
    mainnetRcHash: 'a'.repeat(64),
    economicRcHash: 'b'.repeat(64),
    economicAuthorizationHash: 'c'.repeat(64),
    genesisHash: 'd'.repeat(64),
    validatorSetHash: 'e'.repeat(64),
    cryptoPolicyHash: 'f'.repeat(64),
    externalEvidenceSnapshotHash: '1'.repeat(64),
    operatingScopeSnapshotHash: '2'.repeat(64),
    providerBindingSnapshotHash: '3'.repeat(64),
    sourceCommit: 'fixture-not-a-production-commit',
  };
}

export function fixtureLaunchFreezeBinding(): ProductionLaunchCeremonyBinding {
  return bindingFromLaunchFreeze(fixtureLaunchFreezeFields());
}

export function fixtureEvidenceWatch(
  overlay: Partial<CeremonyEvidenceWatch> = {},
): CeremonyEvidenceWatch {
  const binding = fixtureLaunchFreezeBinding();
  return Object.freeze({
    snapshotHash: overlay.snapshotHash ?? binding.externalEvidenceSnapshotHash,
    expiresAtUtc: overlay.expiresAtUtc ?? '2026-12-31T00:00:00.000Z',
    revoked: overlay.revoked ?? false,
    fixture: overlay.fixture ?? true,
    class: overlay.class ?? 'EXTERNAL_EVIDENCE',
  });
}

export function fixtureLaunchParticipants(): readonly LaunchCeremonyParticipant[] {
  const humans: ReadonlyArray<{
    readonly participantId: string;
    readonly displayName: string;
    readonly role: LaunchCeremonyParticipant['role'];
  }> = [
    { participantId: 'human-genesis-launch-1', displayName: 'genesis authority', role: 'GENESIS_AUTHORITY' },
    { participantId: 'human-protocol-launch-1', displayName: 'protocol authority', role: 'PROTOCOL_AUTHORITY' },
    { participantId: 'human-security-launch-1', displayName: 'security authority', role: 'SECURITY_AUTHORITY' },
    { participantId: 'human-release-launch-1', displayName: 'release authority', role: 'RELEASE_AUTHORITY' },
    { participantId: 'human-economic-launch-1', displayName: 'economic policy authority', role: 'ECONOMIC_POLICY_AUTHORITY' },
  ];
  return Object.freeze(
    humans.map((row) =>
      registerLaunchParticipant({
        ...row,
        actorKind: 'HUMAN',
        publicSigningDescriptor: deriveFixturePublicKey(row.participantId),
      }),
    ),
  );
}

export function openFixtureLaunchSession(sessionId: string = LAUNCH_AUTH_SESSION_A) {
  const binding = fixtureLaunchFreezeBinding();
  const plan = createLaunchCeremonyPlan({ binding });
  return openLaunchCeremonySession({
    sessionId,
    plan,
    evidence: fixtureEvidenceWatch(),
  });
}

export function runLaunchAuthorizationDressRehearsal(): LaunchAuthorizationDressRehearsal {
  const participants = fixtureLaunchParticipants();
  let session = openFixtureLaunchSession(LAUNCH_AUTH_SESSION_A);
  session = bindFrozenCandidate(session, LAUNCH_AUTH_REHEARSAL_NOW);
  session = verifyLaunchParticipants(session, participants, LAUNCH_AUTH_REHEARSAL_NOW);
  const hsm = createSimulationAttestation({
    publicKeyHex: participants[0]!.publicSigningDescriptor,
    purpose: 'GENESIS_AUTHORITY',
    keyHandle: 'hsm-sim-launch-auth-rehearsal',
    humanWitness: participants[2]!.participantId,
  });
  session = verifySimulationHsm(session, hsm, LAUNCH_AUTH_REHEARSAL_NOW, false);
  const offline = participants.map((participant) =>
    exportOfflineSigningPackage({
      identity: session.identity,
      binding: session.binding,
      participant,
      approvalStatement: statementForScope(participant.approvalScope),
      validFromUtc: LAUNCH_AUTH_VALID_FROM,
      expiresAtUtc: LAUNCH_AUTH_EXPIRES,
    }),
  );
  session = recordOfflineExport(session, offline, LAUNCH_AUTH_REHEARSAL_NOW);
  for (const [index, participant] of participants.entries()) {
    const pkg = offline[index]!;
    const signature = createFixtureApprovalSignature({
      participant,
      pkg,
      identity: session.identity,
      signedAtUtc: LAUNCH_AUTH_REHEARSAL_NOW,
    });
    session = importLaunchSignature(session, {
      participant,
      pkg,
      signature,
      nowUtc: LAUNCH_AUTH_REHEARSAL_NOW,
    });
  }
  session = sealRehearsalAuthorization(session, LAUNCH_AUTH_REHEARSAL_NOW);

  const mutated = bindingFromLaunchFreeze({
    ...fixtureLaunchFreezeFields(),
    genesisHash: '9'.repeat(64),
  });
  let changedFreezeRejection;
  try {
    observeCurrentCandidate(session, mutated, LAUNCH_AUTH_REHEARSAL_NOW);
    throw new TypeError('expected freeze change to abort');
  } catch (error) {
    if (!(error instanceof CeremonyCandidateMismatchError)) {
      throw error;
    }
    changedFreezeRejection = error.abort;
    if (!abortPreservesAuditHistory(error.session)) {
      throw new TypeError('abort must preserve audit history');
    }
  }

  return Object.freeze({
    rehearsalId: LAUNCH_AUTH_REHEARSAL_ID,
    session,
    report: buildLaunchCeremonyReport({ session }),
    changedFreezeRejection,
    transcriptIntegrity: true,
    candidateChangeRequiresRestart: true,
    realProductionKeysCreated: false,
    realHumanSignaturesCollected: false,
    aiSatisfiesHumanRole: false,
    ceremonyAuthorizationEqualsActivation: false,
    mainnetEnabled: false,
    productionActive: false,
  });
}
