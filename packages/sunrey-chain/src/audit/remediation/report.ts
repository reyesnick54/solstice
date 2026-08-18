import { isOpenFinding } from './finding.ts';
import { isCriticalBlocker, isHighReleaseIssue } from './policy.ts';
import { deriveCandidateV2AuditState } from './candidate-v2.ts';
import type {
  ExternalSecurityFinding,
  ExternalSecurityReview,
  FindingSeverity,
  FindingState,
  ProductionSecurityPolicy,
  SecurityReviewStatusReport,
  SecurityRiskAcceptance,
} from './types.ts';
import { FINDING_SEVERITIES, FINDING_STATES } from './types.ts';
import { isFixtureReview } from './review.ts';

function emptySeverityCounts(): Record<FindingSeverity, number> {
  return {
    INFORMATIONAL: 0,
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
  };
}

function emptyStateCounts(): Record<FindingState, number> {
  return {
    RECEIVED: 0,
    TRIAGED: 0,
    REPRODUCED: 0,
    REMEDIATION_IN_PROGRESS: 0,
    REMEDIATED_PENDING_RETEST: 0,
    EXTERNALLY_RETESTED: 0,
    ACCEPTED_RISK: 0,
    NOT_REPRODUCIBLE_WITH_EVIDENCE: 0,
    SUPERSEDED: 0,
  };
}

export function buildSecurityReviewStatusReport(input: {
  readonly review: ExternalSecurityReview | null;
  readonly findings: readonly ExternalSecurityFinding[];
  readonly acceptedRisks: readonly SecurityRiskAcceptance[];
  readonly policy: ProductionSecurityPolicy;
  readonly affectedReleases?: readonly string[];
}): SecurityReviewStatusReport {
  const bySeverity = emptySeverityCounts();
  const byState = emptyStateCounts();
  const openBlockers: string[] = [];
  for (const finding of input.findings) {
    byState[finding.status] += 1;
    const mapped = finding.internalEngineeringSeverity;
    if (mapped && FINDING_SEVERITIES.includes(mapped)) {
      bySeverity[mapped] += 1;
    }
    if (isCriticalBlocker(finding, input.policy) || isHighReleaseIssue(finding, input.policy)) {
      openBlockers.push(finding.findingId);
    }
  }
  const pendingRetest = input.findings.filter((row) => row.status === 'REMEDIATED_PENDING_RETEST').length;
  const externallyRetested = input.findings.filter((row) => row.status === 'EXTERNALLY_RETESTED').length;
  const fixtureOnly = input.review ? isFixtureReview(input.review) : input.findings.some((row) => row.fixtureLabel !== null);
  const readinessEffect = openBlockers.length > 0
    ? 'MAINNET_ENGINEERING_SECURITY_BLOCKER'
    : fixtureOnly || !input.review
      ? 'NO_REAL_EXTERNAL_REVIEW_EVIDENCE'
      : 'NO_CONFIGURED_SECURITY_BLOCKER';
  return Object.freeze({
    reviewId: input.review?.reviewId ?? null,
    reviewScope: input.review?.scope ?? 'NONE',
    findingCountsBySeverity: Object.freeze(bySeverity),
    findingCountsByState: Object.freeze(byState),
    openBlockers: Object.freeze(openBlockers),
    acceptedRisks: Object.freeze(input.acceptedRisks.map((row) => row.acceptanceId)),
    retestStatus: `pending=${pendingRetest};externally_retested=${externallyRetested}`,
    affectedReleases: Object.freeze([...(input.affectedReleases ?? [])]),
    readinessEffect,
    candidateV2State: deriveCandidateV2AuditState({
      review: input.review,
      findings: input.findings,
    }),
    claimsExternalAuditCompleted: false,
    fixtureOnly,
  });
}

export function openFindingIds(findings: readonly ExternalSecurityFinding[]): readonly string[] {
  return findings.filter((row) => isOpenFinding(row.status)).map((row) => row.findingId);
}

export { FINDING_STATES };
