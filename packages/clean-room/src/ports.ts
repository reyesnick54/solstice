import { SIMULATION_THRESHOLDS } from './taxonomy.ts';
import type { CandidatePolicySimulation, CleanRoomSession, PrivacyThresholds } from './types.ts';

export function simulateCandidatePolicy(
  current: PrivacyThresholds,
  candidate: CandidatePolicySimulation,
  sessions: readonly CleanRoomSession[],
): {
  readonly livePolicyActivated: false;
  readonly current: PrivacyThresholds;
  readonly candidate: PrivacyThresholds;
  readonly sessionsThatWouldDeny: readonly string[];
  readonly note: string;
} {
  const next: PrivacyThresholds = {
    ...current,
    minCohortSize: candidate.minCohortSize ?? current.minCohortSize,
  };
  const wouldDeny = sessions
    .filter((session) => {
      if (candidate.purposeRef && session.purposeRef !== candidate.purposeRef) {
        return true;
      }
      if (candidate.recipientId && session.recipientId !== candidate.recipientId) {
        return true;
      }
      if (candidate.permittedCategories) {
        return session.allowedCategories.some((category) => !candidate.permittedCategories?.includes(category));
      }
      return false;
    })
    .map((session) => session.sessionId);
  return {
    livePolicyActivated: false,
    current,
    candidate: next,
    sessionsThatWouldDeny: Object.freeze(wouldDeny),
    note: 'Candidate policy simulation does not activate live Clean Room policy. Thresholds remain ENGINEERING_POLICY / RESEARCH_REQUIRED.',
  };
}

export const DEFAULT_POLICY = SIMULATION_THRESHOLDS;
