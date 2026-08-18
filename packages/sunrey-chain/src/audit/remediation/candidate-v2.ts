import { isOpenFinding } from './finding.ts';
import { isFixtureReview, reviewSatisfiesRealExternalReadiness } from './review.ts';
import type {
  CandidateV2AuditState,
  ExternalSecurityFinding,
  ExternalSecurityReview,
} from './types.ts';

/**
 * Chunk 81 Candidate V2 display adapter. Possible states are exact.
 * There is no completed/passed invented state.
 */
export function deriveCandidateV2AuditState(input: {
  readonly review: ExternalSecurityReview | null;
  readonly findings: readonly ExternalSecurityFinding[];
}): CandidateV2AuditState {
  if (!input.review || isFixtureReview(input.review)) {
    return 'NO_EXTERNAL_REVIEW';
  }
  if (input.review.evidenceVerificationState === 'UNVERIFIED' && input.findings.length === 0) {
    return 'EXTERNAL_REVIEW_IN_PROGRESS';
  }
  if (input.findings.some((row) => row.status === 'REMEDIATED_PENDING_RETEST')) {
    return 'RETEST_PENDING';
  }
  if (input.findings.some((row) => row.status === 'REMEDIATION_IN_PROGRESS' || row.status === 'REPRODUCED')) {
    return 'REMEDIATION_IN_PROGRESS';
  }
  if (input.findings.some((row) => isOpenFinding(row.status))) {
    return 'FINDINGS_OPEN';
  }
  if (reviewSatisfiesRealExternalReadiness(input.review)) {
    return 'EXTERNAL_REVIEW_EVIDENCE_ACCEPTED';
  }
  return 'EXTERNAL_REVIEW_IN_PROGRESS';
}

export function candidateV2Display(state: CandidateV2AuditState): {
  readonly state: CandidateV2AuditState;
  readonly completed: false;
  readonly claimsExternalAuditPassed: false;
} {
  return Object.freeze({
    state,
    completed: false,
    claimsExternalAuditPassed: false,
  });
}
