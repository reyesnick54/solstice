/**
 * Launch-ceremony verification.
 *
 * Verifies suite, public key, payload hash, role, participant, session,
 * and expiration using the existing cryptographic registry. Candidate
 * or evidence drift aborts the session and requires a restart.
 */

import { SUITE_SUNREY_ED25519_V1 } from '../../../../security/src/index.ts';
import { rejectSimulationHsmForExternalRequirement } from '../hsm.ts';
import type { ProductionHsmAttestation } from '../types.ts';
import { CeremonyCandidateMismatchError, abortCeremony } from './abort.ts';
import { verifyLaunchSignature } from './approvals.ts';
import { assertBindingMatches } from './plan.ts';
import { assertDistinctIndependentActors, assertHumanRoleEligible } from './participants.ts';
import { payloadBindsGenesis } from './offline.ts';
import { appendLaunchTranscript, launchTranscriptIntegrity } from './transcript.ts';
import type {
  CeremonyEvidenceWatch,
  LaunchApprovalSignature,
  LaunchAuthorizationCandidate,
  LaunchAuthorizationCeremonySession,
  LaunchCeremonyParticipant,
  LaunchOfflineSigningPackage,
  ProductionLaunchCeremonyBinding,
} from './types.ts';

function withState(
  session: LaunchAuthorizationCeremonySession,
  state: LaunchAuthorizationCeremonySession['state'],
): LaunchAuthorizationCeremonySession {
  return Object.freeze({ ...session, state });
}

export function assertSessionOpen(session: LaunchAuthorizationCeremonySession): void {
  if (session.state === 'ABORTED' || session.state === 'SUPERSEDED') {
    throw new TypeError('ceremony session is closed; restart required');
  }
}

export function observeCurrentCandidate(
  session: LaunchAuthorizationCeremonySession,
  current: ProductionLaunchCeremonyBinding,
  occurredAtUtc: string,
): LaunchAuthorizationCeremonySession {
  try {
    assertBindingMatches(session.binding, current);
    return session;
  } catch (error) {
    const aborted = abortCeremony(session, {
      code: 'CEREMONY_CANDIDATE_MISMATCH',
      reason: error instanceof Error ? error.message : 'CEREMONY_CANDIDATE_MISMATCH',
      affectedArtifacts: Object.freeze([
        session.binding.launchFreezeHash,
        current.launchFreezeHash,
        session.binding.genesisHash,
        current.genesisHash,
        session.binding.economicAuthorizationHash,
        current.economicAuthorizationHash,
      ]),
      occurredAtUtc,
    });
    throw new CeremonyCandidateMismatchError(aborted, aborted.abort!);
  }
}

export function observeEvidenceWatch(
  session: LaunchAuthorizationCeremonySession,
  watch: CeremonyEvidenceWatch,
  nowUtc: string,
): LaunchAuthorizationCeremonySession {
  assertSessionOpen(session);
  if (watch.revoked) {
    return abortCeremony(session, {
      code: 'EXTERNAL_EVIDENCE_REVOKED',
      reason: 'external evidence revoked mid-ceremony',
      affectedArtifacts: Object.freeze([watch.snapshotHash]),
      occurredAtUtc: nowUtc,
    });
  }
  if (watch.expiresAtUtc && watch.expiresAtUtc <= nowUtc) {
    return abortCeremony(session, {
      code: 'EXTERNAL_EVIDENCE_EXPIRED',
      reason: 'external evidence expired mid-ceremony',
      affectedArtifacts: Object.freeze([watch.snapshotHash, watch.expiresAtUtc]),
      occurredAtUtc: nowUtc,
    });
  }
  if (watch.snapshotHash !== session.binding.externalEvidenceSnapshotHash && watch.class === 'EXTERNAL_EVIDENCE') {
    const aborted = abortCeremony(session, {
      code: 'CEREMONY_CANDIDATE_MISMATCH',
      reason: 'CEREMONY_CANDIDATE_MISMATCH: external evidence snapshot changed',
      affectedArtifacts: Object.freeze([session.binding.externalEvidenceSnapshotHash, watch.snapshotHash]),
      occurredAtUtc: nowUtc,
    });
    throw new CeremonyCandidateMismatchError(aborted, aborted.abort!);
  }
  const transcript = appendLaunchTranscript(session.transcript, {
    action: 'EXTERNAL_EVIDENCE_VERIFIED',
    participantRole: 'SYSTEM',
    actorKind: 'SYSTEM',
    artifactHashes: Object.freeze([watch.snapshotHash]),
    occurredAtUtc: nowUtc,
  });
  return Object.freeze({
    ...session,
    evidence: watch,
    transcript,
    state: session.state === 'PLANNED' ? 'REHEARSAL_IN_PROGRESS' : session.state,
  });
}

export function bindFrozenCandidate(
  session: LaunchAuthorizationCeremonySession,
  occurredAtUtc: string,
): LaunchAuthorizationCeremonySession {
  assertSessionOpen(session);
  const transcript = appendLaunchTranscript(session.transcript, {
    action: 'CANDIDATE_FREEZE_BOUND',
    participantRole: 'SYSTEM',
    actorKind: 'SYSTEM',
    artifactHashes: Object.freeze([session.binding.launchFreezeHash, session.plan.planHash]),
    occurredAtUtc,
  });
  return Object.freeze({
    ...withState(session, 'REHEARSAL_READY'),
    transcript,
  });
}

export function verifyLaunchParticipants(
  session: LaunchAuthorizationCeremonySession,
  participants: readonly LaunchCeremonyParticipant[],
  occurredAtUtc: string,
): LaunchAuthorizationCeremonySession {
  assertSessionOpen(session);
  assertDistinctIndependentActors(participants, session.plan.roleOverlapPolicy);
  for (const participant of participants) {
    assertHumanRoleEligible(participant);
  }
  let transcript = session.transcript;
  for (const participant of participants) {
    transcript = appendLaunchTranscript(transcript, {
      action: 'PARTICIPANT_VERIFIED',
      participantRole: participant.role === 'ECONOMIC_POLICY_AUTHORITY' ||
        participant.role === 'VALIDATOR_GOVERNANCE_AUTHORITY'
        ? 'CEREMONY_OBSERVER'
        : participant.role,
      actorKind: participant.actorKind,
      artifactHashes: Object.freeze([participant.publicIdentityCommitment]),
      occurredAtUtc,
    });
  }
  return Object.freeze({
    ...session,
    participants: Object.freeze([...participants]),
    transcript,
    state: 'REHEARSAL_IN_PROGRESS',
  });
}

export function verifySimulationHsm(
  session: LaunchAuthorizationCeremonySession,
  attestation: ProductionHsmAttestation,
  occurredAtUtc: string,
  requireRealHsm = false,
): LaunchAuthorizationCeremonySession {
  assertSessionOpen(session);
  if (requireRealHsm) {
    rejectSimulationHsmForExternalRequirement(attestation, true);
  }
  if (attestation.simulation || attestation.label === 'SIMULATION_ATTESTATION') {
    if (requireRealHsm) {
      throw new TypeError('simulation HSM not real HSM');
    }
  }
  const transcript = appendLaunchTranscript(session.transcript, {
    action: 'HSM_ATTESTATION_VERIFIED',
    participantRole: 'SECURITY_AUTHORITY',
    actorKind: 'SYSTEM',
    attestation: attestation.attestationHash,
    artifactHashes: Object.freeze([attestation.attestationHash]),
    occurredAtUtc,
  });
  return Object.freeze({
    ...session,
    hsmAttestation: attestation,
    hsmClass: attestation.simulation ? 'SIMULATION_HSM' : 'REAL_PROVIDER_HSM',
    transcript,
    state: attestation.simulation ? 'AWAITING_REAL_HSM' : session.state,
  });
}

export function recordOfflineExport(
  session: LaunchAuthorizationCeremonySession,
  packages: readonly LaunchOfflineSigningPackage[],
  occurredAtUtc: string,
): LaunchAuthorizationCeremonySession {
  assertSessionOpen(session);
  const transcript = appendLaunchTranscript(session.transcript, {
    action: 'OFFLINE_PACKAGE_EXPORTED',
    participantRole: 'SYSTEM',
    actorKind: 'SYSTEM',
    artifactHashes: Object.freeze(packages.map((row) => row.payload.payloadHash)),
    occurredAtUtc,
  });
  return Object.freeze({
    ...session,
    offlinePackages: Object.freeze([...packages]),
    transcript,
    state: 'AWAITING_HUMAN_SIGNATURES',
  });
}

export function importLaunchSignature(
  session: LaunchAuthorizationCeremonySession,
  input: {
    readonly participant: LaunchCeremonyParticipant;
    readonly pkg: LaunchOfflineSigningPackage;
    readonly signature: LaunchApprovalSignature;
    readonly nowUtc: string;
    readonly intendedRole?: LaunchApprovalSignature['role'];
    readonly intendedSessionId?: string;
  },
): LaunchAuthorizationCeremonySession {
  assertSessionOpen(session);
  const intendedSession = input.intendedSessionId ?? session.sessionId;
  let rejection: string | null = null;
  if (input.signature.sessionId !== session.sessionId || intendedSession !== session.sessionId) {
    rejection = 'SESSION_MISMATCH';
  } else if (input.pkg.sessionId !== session.sessionId) {
    rejection = 'SESSION_MISMATCH';
  } else if ((input.intendedRole ?? input.signature.role) !== input.pkg.payload.approvalRole) {
    rejection = 'SIGNATURE_ROLE_MISMATCH';
  } else if (input.signature.role !== input.participant.role) {
    rejection = 'SIGNATURE_ROLE_MISMATCH';
  } else if (input.signature.payloadHash !== input.pkg.payload.payloadHash) {
    rejection = 'SIGNATURE_ROLE_MISMATCH';
  } else if (input.pkg.payload.expiresAtUtc <= input.nowUtc) {
    rejection = 'APPROVAL_EXPIRED';
  } else if (input.pkg.payload.validFromUtc > input.nowUtc) {
    rejection = 'APPROVAL_EXPIRED';
  } else if (input.signature.cryptoSuiteId !== String(SUITE_SUNREY_ED25519_V1)) {
    rejection = 'UNSUPPORTED_SUITE';
  } else if (!verifyLaunchSignature(input.signature.publicKeyHex, input.signature.payloadHash, input.signature.signatureHex)) {
    rejection = 'SIGNATURE_INVALID';
  } else if (input.participant.actorKind !== 'HUMAN') {
    rejection = input.participant.actorKind === 'AI' ? 'AI_CANNOT_APPROVE' : 'SERVICE_CANNOT_APPROVE';
  }

  const imported: LaunchApprovalSignature = Object.freeze({
    ...input.signature,
    accepted: rejection === null,
    rejectionReason: rejection,
  });

  let transcript = appendLaunchTranscript(session.transcript, {
    action: 'SIGNATURE_IMPORTED',
    participantRole:
      input.participant.role === 'ECONOMIC_POLICY_AUTHORITY' ||
      input.participant.role === 'VALIDATOR_GOVERNANCE_AUTHORITY'
        ? 'CEREMONY_OBSERVER'
        : input.participant.role,
    actorKind: input.participant.actorKind,
    artifactHashes: Object.freeze([input.signature.payloadHash]),
    occurredAtUtc: input.nowUtc,
  });
  transcript = appendLaunchTranscript(transcript, {
    action: imported.accepted ? 'SIGNATURE_ACCEPTED' : 'SIGNATURE_REJECTED',
    participantRole:
      input.participant.role === 'ECONOMIC_POLICY_AUTHORITY' ||
      input.participant.role === 'VALIDATOR_GOVERNANCE_AUTHORITY'
        ? 'CEREMONY_OBSERVER'
        : input.participant.role,
    actorKind: input.participant.actorKind,
    approval: imported.accepted ? input.signature.approvalStatement : imported.rejectionReason,
    artifactHashes: Object.freeze([input.signature.payloadHash]),
    occurredAtUtc: input.nowUtc,
  });

  const next = Object.freeze({
    ...session,
    signatures: Object.freeze([...session.signatures, imported]),
    transcript,
  });

  if (rejection === 'SESSION_MISMATCH') {
    throw new TypeError('session A signature rejected by session B');
  }
  if (rejection === 'SIGNATURE_ROLE_MISMATCH') {
    throw new TypeError('signature role mismatch rejected');
  }
  if (rejection === 'APPROVAL_EXPIRED') {
    throw new TypeError('expired approval rejected');
  }
  if (rejection === 'AI_CANNOT_APPROVE') {
    throw new TypeError('AI participant cannot satisfy required human role');
  }
  if (rejection === 'SERVICE_CANNOT_APPROVE') {
    throw new TypeError('service cannot satisfy human role');
  }
  if (rejection) {
    throw new TypeError(rejection);
  }
  return next;
}

export function rejectEconomicAsGenesis(signature: LaunchApprovalSignature): void {
  if (signature.approvalStatement === 'APPROVE_ECONOMIC_PARAMETER_PACKAGE' && !payloadBindsGenesis({
    domain: 'SUNREY_LAUNCH_AUTHORIZATION_OFFLINE_PAYLOAD_V1',
    sessionId: signature.sessionId,
    launchFreezeHash: '',
    genesisCandidateHash: '',
    validatorSetHash: '',
    economicAuthorizationHash: '',
    approvalRole: signature.role,
    approvalStatement: signature.approvalStatement,
    validFromUtc: '',
    expiresAtUtc: '',
    cryptoSuiteId: signature.cryptoSuiteId,
    payloadHash: signature.payloadHash,
  })) {
    throw new TypeError('economic signature not automatically genesis signature');
  }
}

export function sealRehearsalAuthorization(
  session: LaunchAuthorizationCeremonySession,
  occurredAtUtc: string,
): LaunchAuthorizationCeremonySession {
  assertSessionOpen(session);
  if (!launchTranscriptIntegrity(session.transcript)) {
    throw new TypeError('transcript tamper detected');
  }
  const authorization: LaunchAuthorizationCandidate = Object.freeze({
    schemaVersion: 1,
    class: 'REHEARSAL_PACKAGE',
    sessionId: session.sessionId,
    binding: session.binding,
    transcriptHash: session.transcript.transcriptHash,
    acceptedRoles: Object.freeze(
      session.signatures.filter((row) => row.accepted).map((row) => row.role),
    ),
    realHumanSignaturesCollected: false,
    fixtureSignaturesOnly: true,
    usableForProduction: false,
    startsValidators: false,
    writesGenesis: false,
    connectsProviders: false,
    mintsPostGenesisCoins: false,
    changesFlags: false,
    mainnetEnabled: false,
    productionActivated: false,
    ceremonyAuthorizationEqualsActivation: false,
  });
  const transcript = appendLaunchTranscript(session.transcript, {
    action: 'AUTHORIZATION_CANDIDATE_SEALED',
    participantRole: 'SYSTEM',
    actorKind: 'SYSTEM',
    artifactHashes: Object.freeze([authorization.transcriptHash]),
    occurredAtUtc,
  });
  return Object.freeze({
    ...session,
    transcript,
    authorization,
    state: 'REHEARSAL_COMPLETE',
    realHumanSignaturesCollected: false,
    mainnetEnabled: false,
    productionActivated: false,
  });
}

export function simulationHsmIsRealHsm(): false {
  return false;
}

export function ceremonyCannotEnableMainnet(session: LaunchAuthorizationCeremonySession): false {
  return session.mainnetEnabled;
}

export function ceremonyCannotMint(session: LaunchAuthorizationCeremonySession): false {
  return session.authorization?.mintsPostGenesisCoins ?? false;
}

export function ceremonyCannotAlterLiveFlags(): false {
  return false;
}

export function productionRemainsInactive(session: LaunchAuthorizationCeremonySession): false {
  return session.productionActivated;
}
