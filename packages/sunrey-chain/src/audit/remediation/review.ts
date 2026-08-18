import { TEST_FIXTURE_NOT_EXTERNAL_AUDIT, type ExternalSecurityReview } from './types.ts';

export function createExternalSecurityReview(input: {
  readonly reviewId: string;
  readonly reviewOrganizationReference: string;
  readonly scope: string;
  readonly sourceCommit: string;
  readonly protocolVersion: string;
  readonly releaseCandidate?: string | null;
  readonly reviewPeriod?: { readonly startedAtUtc: string | null; readonly endedAtUtc: string | null; readonly notes: string };
  readonly reportDigest?: string | null;
  readonly evidenceVerificationState?: ExternalSecurityReview['evidenceVerificationState'];
  readonly humanAcceptanceState?: ExternalSecurityReview['humanAcceptanceState'];
  readonly fixture?: boolean;
}): ExternalSecurityReview {
  if (!input.reviewId.trim() || !input.reviewOrganizationReference.trim() || !input.scope.trim()) {
    throw new Error('ExternalSecurityReview requires review id, organization reference, and scope');
  }
  if (!input.sourceCommit.trim() || !input.protocolVersion.trim()) {
    throw new Error('ExternalSecurityReview requires source commit and protocol version');
  }
  if (/auditor|firm|acme|example-reviewer/i.test(input.reviewOrganizationReference) && !input.fixture) {
    throw new Error('do not invent an auditor name; use an organization reference');
  }
  const fixture = input.fixture === true;
  return Object.freeze({
    reviewId: input.reviewId,
    reviewOrganizationReference: input.reviewOrganizationReference,
    scope: input.scope,
    sourceCommit: input.sourceCommit,
    protocolVersion: input.protocolVersion,
    releaseCandidate: input.releaseCandidate ?? null,
    reviewPeriod: input.reviewPeriod ?? { startedAtUtc: null, endedAtUtc: null, notes: '' },
    reportDigest: input.reportDigest ?? null,
    evidenceVerificationState: fixture
      ? 'FIXTURE_ONLY'
      : (input.evidenceVerificationState ?? 'UNVERIFIED'),
    humanAcceptanceState: fixture
      ? 'FIXTURE_ONLY'
      : (input.humanAcceptanceState ?? 'NOT_ACCEPTED'),
    fixtureLabel: fixture ? TEST_FIXTURE_NOT_EXTERNAL_AUDIT : null,
    inventedAuditorName: false,
    claimsExternalAuditCompleted: false,
  });
}

export function isFixtureReview(review: ExternalSecurityReview): boolean {
  return review.fixtureLabel === TEST_FIXTURE_NOT_EXTERNAL_AUDIT;
}

export function reviewSatisfiesRealExternalReadiness(review: ExternalSecurityReview): boolean {
  if (isFixtureReview(review)) {
    return false;
  }
  return (
    review.reportDigest !== null
    && review.evidenceVerificationState === 'HUMAN_VERIFIED'
    && review.humanAcceptanceState === 'ACCEPTED_BY_HUMAN'
  );
}

export function acceptReviewEvidence(
  review: ExternalSecurityReview,
  actor: 'HUMAN' | 'AI' | 'SYSTEM',
): ExternalSecurityReview {
  if (isFixtureReview(review)) {
    throw new Error('TEST_FIXTURE_NOT_EXTERNAL_AUDIT cannot become a real external audit');
  }
  if (actor !== 'HUMAN') {
    throw new Error('AI cannot externally verify review evidence');
  }
  if (!review.reportDigest) {
    throw new Error('human acceptance requires a supplied report digest');
  }
  return Object.freeze({
    ...review,
    evidenceVerificationState: 'HUMAN_VERIFIED',
    humanAcceptanceState: 'ACCEPTED_BY_HUMAN',
    claimsExternalAuditCompleted: false,
  });
}
