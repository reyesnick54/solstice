import type { ContributionClass } from '../taxonomy.ts';
import type { AuthoritativeIdCommitment, EvidenceObservation } from './types.ts';

export type SplittingAssessment = {
  readonly suspected: boolean;
  readonly reason: string | null;
};

const SPLITTING_THRESHOLD = 5;

/**
 * Detect attempts to turn one event into many artificial claims.
 * Does not collapse legitimate multi-stage work — uses class-specific rules.
 */
export function assessContributionSplitting(
  contributionClass: ContributionClass,
  projectWorkIdentifier: string | undefined,
  observations: readonly EvidenceObservation[],
): SplittingAssessment {
  if (!projectWorkIdentifier || observations.length < 2) {
    return { suspected: false, reason: null };
  }

  const sameProject = observations.filter((observation) => observation.projectWorkIdentifier === projectWorkIdentifier);
  if (sameProject.length < 2) {
    return { suspected: false, reason: null };
  }

  const uniqueAuthoritative = new Set(
    sameProject.flatMap((observation) => observation.authoritativeIdCommitments.map((id) => String(id))),
  );
  const uniqueContent = new Set(sameProject.map((observation) => observation.contentCommitment));

  switch (contributionClass) {
    case 'RESEARCH_PARTICIPATION':
    case 'VERIFIED_KNOWLEDGE_CONTRIBUTION':
      if (uniqueAuthoritative.size === 1 && uniqueContent.size > 1 && sameProject.length >= 2) {
        return {
          suspected: true,
          reason: 'multiple content commitments for one authoritative research identifier',
        };
      }
      break;
    case 'MODEL_TRAINING_PARTICIPATION':
      if (uniqueAuthoritative.size === 1 && sameProject.length >= 2) {
        return {
          suspected: true,
          reason: 'multiple observations for one computation job receipt',
        };
      }
      break;
    case 'CREATIVE_PRODUCTION':
      if (uniqueContent.size === 1 && uniqueAuthoritative.size > 1 && sameProject.length >= SPLITTING_THRESHOLD) {
        return {
          suspected: true,
          reason: 'many authoritative ids for one creative content commitment',
        };
      }
      break;
    default:
      if (sameProject.length >= SPLITTING_THRESHOLD && uniqueAuthoritative.size <= 2) {
        return {
          suspected: true,
          reason: `many near-duplicate records for project ${projectWorkIdentifier}`,
        };
      }
  }

  return { suspected: false, reason: null };
}

export function nearDuplicateAuthoritativeIds(
  left: readonly AuthoritativeIdCommitment[],
  right: readonly AuthoritativeIdCommitment[],
): boolean {
  const leftSet = new Set(left.map((id) => String(id)));
  for (const id of right) {
    if (leftSet.has(String(id))) {
      return true;
    }
  }
  return false;
}

export function timestampAlterationSuspected(
  left: EvidenceObservation,
  right: EvidenceObservation,
): boolean {
  if (left.contentCommitment !== right.contentCommitment) {
    return false;
  }
  if (left.validFromUtc === right.validFromUtc) {
    return false;
  }
  return nearDuplicateAuthoritativeIds(left.authoritativeIdCommitments, right.authoritativeIdCommitments);
}
