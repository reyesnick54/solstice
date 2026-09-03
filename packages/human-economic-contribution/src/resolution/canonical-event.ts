// @ts-nocheck
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ContributionClass } from '../taxonomy.ts';
import { aggregationKeyForClass } from './aggregation.ts';
import { contributionResolutionFingerprintFor, canonicalHumanContributionEventIdFor } from './ids.ts';
import type {
  CanonicalHumanContributionEvent,
  CanonicalHumanContributionEventMaterial,
  ContributorRole,
} from './types.ts';

export function quantizePeriodForClass(
  contributionClass: ContributionClass,
  validFromUtc: UtcInstant,
  validUntilUtc: UtcInstant | null,
): { readonly start: UtcInstant; readonly end: UtcInstant | null } {
  switch (contributionClass) {
    case 'PROFESSIONAL_EXPERTISE':
    case 'HUMAN_SERVICE_DELIVERY':
    case 'ECONOMIC_PARTICIPATION':
      return {
        start: `${validFromUtc.slice(0, 10)}T00:00:00.000Z` as UtcInstant,
        end: validUntilUtc ? (`${validUntilUtc.slice(0, 10)}T23:59:59.999Z` as UtcInstant) : null,
      };
    case 'MODEL_TRAINING_PARTICIPATION':
      return { start: validFromUtc, end: validUntilUtc };
    default:
      return { start: validFromUtc, end: validUntilUtc };
  }
}

export function canonicalEventMaterialDigest(material: CanonicalHumanContributionEventMaterial): string {
  const sortedAuthoritative = [...material.authoritativeIdCommitments].sort().join(',');
  const aggregationKey = aggregationKeyForClass(material.contributionClass, {
    authoritativeIdCommitments: material.authoritativeIdCommitments,
    projectWorkIdentifier: material.projectWorkIdentifier,
    validFromUtc: material.validFromUtc,
    validUntilUtc: material.validUntilUtc,
    contentCommitment: material.contentCommitment,
  });
  const usesAuthoritativeIdentity =
    material.authoritativeIdCommitments.length > 0 &&
    (material.contributionClass === 'RESEARCH_PARTICIPATION' ||
      material.contributionClass === 'VERIFIED_KNOWLEDGE_CONTRIBUTION' ||
      material.contributionClass === 'EDUCATION_SKILL_ATTESTATION' ||
      material.contributionClass === 'MODEL_TRAINING_PARTICIPATION' ||
      material.contributionClass === 'CREATIVE_PRODUCTION' ||
      material.contributionClass === 'CREATOR_ROYALTY_EVENT');
  const quantized = quantizePeriodForClass(material.contributionClass, material.validFromUtc, material.validUntilUtc);
  return [
    material.humanEconomicIdentityId,
    material.contributionClass,
    sortedAuthoritative,
    material.issuerCommitment ?? '',
    material.projectWorkIdentifier ?? '',
    usesAuthoritativeIdentity ? aggregationKey : quantized.start,
    usesAuthoritativeIdentity ? '' : quantized.end ?? '',
    material.contentCommitment,
    material.contributorRole ?? '',
    material.measurementQuantity.toString(),
    material.measurementUnit,
  ].join('\n');
}

export function buildCanonicalHumanContributionEvent(
  material: CanonicalHumanContributionEventMaterial,
): CanonicalHumanContributionEvent {
  const quantized = quantizePeriodForClass(material.contributionClass, material.validFromUtc, material.validUntilUtc);
  const digestMaterial = canonicalEventMaterialDigest(material);
  const aggregationKey = aggregationKeyForClass(material.contributionClass, {
    authoritativeIdCommitments: material.authoritativeIdCommitments,
    projectWorkIdentifier: material.projectWorkIdentifier,
    validFromUtc: quantized.start,
    validUntilUtc: quantized.end,
    contentCommitment: material.contentCommitment,
  });
  return Object.freeze({
    ...material,
    canonicalEventId: canonicalHumanContributionEventIdFor(digestMaterial),
    resolutionFingerprint: contributionResolutionFingerprintFor(digestMaterial),
    aggregationKey,
    quantizedPeriodStart: quantized.start,
    quantizedPeriodEnd: quantized.end,
  });
}

export function rolesCompatible(left: ContributorRole | undefined, right: ContributorRole | undefined): boolean {
  if (!left || !right) {
    return true;
  }
  return left === right;
}
