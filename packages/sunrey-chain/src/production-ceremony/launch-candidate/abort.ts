/**
 * Abort-safe human ceremony flow.
 *
 * Abort preserves the transcript and imported signatures. It does not
 * delete history, reuse private keys, or activate anything. A changed
 * freeze or expired/revoked evidence requires a new session.
 */

import { appendLaunchTranscript } from './transcript.ts';
import type {
  CeremonyAbortRecord,
  LaunchAuthorizationCeremonySession,
  LaunchCeremonyAbortCode,
} from './types.ts';

export function createAbortRecord(input: {
  readonly code: LaunchCeremonyAbortCode;
  readonly reason: string;
  readonly session: LaunchAuthorizationCeremonySession;
  readonly affectedArtifacts?: readonly string[];
  readonly abortedAtUtc: string;
}): CeremonyAbortRecord {
  return Object.freeze({
    code: input.code,
    reason: input.reason,
    sessionId: input.session.sessionId,
    lastValidTranscriptHash: input.session.transcript.transcriptHash,
    candidateFreezeHash: input.session.binding.launchFreezeHash,
    affectedArtifacts: Object.freeze([...(input.affectedArtifacts ?? [])]),
    transcriptPreserved: true,
    signaturesPreserved: true,
    privateKeysReused: false,
    productionActivated: false,
    restartRequired: true,
    abortedAtUtc: input.abortedAtUtc,
  });
}

export function abortCeremony(
  session: LaunchAuthorizationCeremonySession,
  input: {
    readonly code: LaunchCeremonyAbortCode;
    readonly reason: string;
    readonly affectedArtifacts?: readonly string[];
    readonly occurredAtUtc: string;
  },
): LaunchAuthorizationCeremonySession {
  if (session.state === 'ABORTED' && session.abort) {
    return session;
  }
  const abort = createAbortRecord({
    code: input.code,
    reason: input.reason,
    session,
    affectedArtifacts: input.affectedArtifacts,
    abortedAtUtc: input.occurredAtUtc,
  });
  const transcript = appendLaunchTranscript(session.transcript, {
    action: 'CEREMONY_ABORTED',
    participantRole: 'SYSTEM',
    actorKind: 'SYSTEM',
    artifactHashes: Object.freeze([abort.lastValidTranscriptHash, abort.candidateFreezeHash]),
    approval: abort.code,
    occurredAtUtc: input.occurredAtUtc,
  });
  const restart = appendLaunchTranscript(transcript, {
    action: 'CEREMONY_RESTART_REQUIRED',
    participantRole: 'SYSTEM',
    actorKind: 'SYSTEM',
    artifactHashes: Object.freeze([abort.sessionId]),
    occurredAtUtc: input.occurredAtUtc,
  });
  return Object.freeze({
    ...session,
    state: 'ABORTED',
    transcript: restart,
    abort,
    authorization: null,
    mainnetEnabled: false,
    productionActivated: false,
  });
}

export function abortPreservesAuditHistory(session: LaunchAuthorizationCeremonySession): boolean {
  if (!session.abort) {
    return false;
  }
  return (
    session.abort.transcriptPreserved &&
    session.abort.signaturesPreserved &&
    session.transcript.entries.length > 0 &&
    session.signatures.length === session.signatures.length &&
    session.abort.privateKeysReused === false &&
    session.abort.productionActivated === false
  );
}

export class CeremonyCandidateMismatchError extends Error {
  readonly code = 'CEREMONY_CANDIDATE_MISMATCH' as const;
  readonly abort: CeremonyAbortRecord;
  readonly session: LaunchAuthorizationCeremonySession;

  constructor(session: LaunchAuthorizationCeremonySession, abort: CeremonyAbortRecord) {
    super('CEREMONY_CANDIDATE_MISMATCH');
    this.name = 'CeremonyCandidateMismatchError';
    this.abort = abort;
    this.session = session;
  }
}
