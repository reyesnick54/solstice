import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ContributionClass } from '../taxonomy.ts';
import type { AuthoritativeIdCommitment } from './types.ts';

export type AggregationKeyMaterial = {
  readonly authoritativeIdCommitments: readonly AuthoritativeIdCommitment[];
  readonly projectWorkIdentifier?: string;
  readonly validFromUtc: UtcInstant;
  readonly validUntilUtc: UtcInstant | null;
  readonly contentCommitment: string;
};

/**
 * Contribution-class-specific aggregation keys distinguish one ongoing
 * contribution from multiple independently legitimate contributions.
 */
export function aggregationKeyForClass(contributionClass: ContributionClass, material: AggregationKeyMaterial): string {
  const primaryAuthoritative = [...material.authoritativeIdCommitments].sort()[0] ?? 'none';
  switch (contributionClass) {
    case 'PROFESSIONAL_EXPERTISE':
    case 'HUMAN_SERVICE_DELIVERY':
    case 'ECONOMIC_PARTICIPATION':
      return `employment:${primaryAuthoritative}:${material.validFromUtc.slice(0, 10)}`;
    case 'MODEL_TRAINING_PARTICIPATION':
      return `compute-job:${primaryAuthoritative}`;
    case 'RESEARCH_PARTICIPATION':
    case 'VERIFIED_KNOWLEDGE_CONTRIBUTION':
      return `publication:${primaryAuthoritative}`;
    case 'CREATIVE_PRODUCTION':
    case 'CREATOR_ROYALTY_EVENT':
      return `creative:${primaryAuthoritative}:${material.contentCommitment.slice(0, 16)}`;
    case 'EDUCATION_SKILL_ATTESTATION':
      return `education:${primaryAuthoritative}`;
    case 'ENTREPRENEURIAL_ACTIVITY':
      return `venture:${material.projectWorkIdentifier ?? primaryAuthoritative}`;
    case 'INFORMATION_RIGHT_CONTRIBUTION':
      return `information-right:${primaryAuthoritative}`;
    case 'COMMUNITY_CONTRIBUTION':
      return `community:${primaryAuthoritative}:${material.validFromUtc}`;
    default:
      return `governed:${contributionClass}:${primaryAuthoritative}:${material.validFromUtc}`;
  }
}

export function isRecurringContributionClass(contributionClass: ContributionClass): boolean {
  return (
    contributionClass === 'PROFESSIONAL_EXPERTISE' ||
    contributionClass === 'HUMAN_SERVICE_DELIVERY' ||
    contributionClass === 'ECONOMIC_PARTICIPATION' ||
    contributionClass === 'MODEL_TRAINING_PARTICIPATION' ||
    contributionClass === 'COMMUNITY_CONTRIBUTION'
  );
}

export function recurringKeysDistinct(
  contributionClass: ContributionClass,
  left: AggregationKeyMaterial,
  right: AggregationKeyMaterial,
): boolean {
  return aggregationKeyForClass(contributionClass, left) !== aggregationKeyForClass(contributionClass, right);
}
