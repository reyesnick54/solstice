/**
 * Launch-authorization ceremony verification report.
 */

import { launchTranscriptIntegrity } from './transcript.ts';
import type {
  CeremonyAbortRecord,
  LaunchAuthorizationCeremonySession,
  LaunchCeremonyVerificationReport,
} from './types.ts';

export function buildLaunchCeremonyReport(input: {
  readonly session: LaunchAuthorizationCeremonySession;
  readonly abort?: CeremonyAbortRecord | null;
}): LaunchCeremonyVerificationReport {
  return Object.freeze({
    schemaVersion: 1,
    sessionId: input.session.sessionId,
    state: input.session.state,
    freezeHashBound: input.session.transcript.entries.some((entry) => entry.action === 'CANDIDATE_FREEZE_BOUND'),
    transcriptIntegrity: launchTranscriptIntegrity(input.session.transcript),
    candidateChangeRequiresRestart: true,
    simulationHsmIsRealHsm: false,
    fixtureSignatureIsRealHumanAuthorization: false,
    economicSignatureIsAutomaticGenesisSignature: false,
    ceremonyAuthorizationEqualsActivation: false,
    realProductionKeysCreated: false,
    realHumanSignaturesCollected: false,
    aiSatisfiesHumanRole: false,
    mainnetEnabled: false,
    productionActivated: false,
    abort: input.abort ?? input.session.abort,
  });
}
