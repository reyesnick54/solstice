import { err, ok, type Result } from '../../../../../domain/src/result.ts';
import { isDataSourceCategory } from '../../../productive/source-taxonomy/types.ts';
import { PRODUCTIVE_CATEGORIES } from '../../../productive/types.ts';
import {
  candidateRejection,
  PROVIDER_CANDIDATE_STATES,
  type ExternalEconomicOracleProviderCandidateProfile,
  type ExternalProviderFeedProfile,
  type ProviderCandidateRejection,
} from './types.ts';
import { routeFamily } from './routing.ts';

const DISPLAY_NAME_MAPPINGS = new Set(['displayName', 'display_name', 'providerName', 'legalName']);

export function createCandidateProfile(
  input: ExternalEconomicOracleProviderCandidateProfile,
): Result<ExternalEconomicOracleProviderCandidateProfile, ProviderCandidateRejection> {
  if (input.profileId.length === 0 || input.providerId.length === 0) {
    return err(candidateRejection('PROFILE_INVALID', 'profileId and providerId are required'));
  }
  if (input.version < 1) {
    return err(candidateRejection('PROFILE_INVALID', 'profile version must be >= 1'));
  }
  if (input.controllerId.length === 0 || input.upstreamOrganizationId.length === 0) {
    return err(candidateRejection('PROFILE_INVALID', 'controller and upstream organization are required'));
  }
  if (input.productionAuthorized !== false) {
    return err(candidateRejection('PROFILE_INVALID', 'productionAuthorized must remain false'));
  }
  if (!(PROVIDER_CANDIDATE_STATES as readonly string[]).includes(input.state)) {
    return err(candidateRejection('PROFILE_INVALID', `unknown state ${input.state}`));
  }
  if (input.feedProfiles.length === 0) {
    return err(candidateRejection('PROFILE_INVALID', 'at least one feed profile is required'));
  }
  for (const category of input.dataSourceCategories) {
    if (!isDataSourceCategory(category)) {
      return err(candidateRejection('PROFILE_INVALID', `unknown data source category ${category}`));
    }
  }
  for (const productive of input.productiveCategories) {
    if (!(PRODUCTIVE_CATEGORIES as readonly string[]).includes(productive)) {
      return err(candidateRejection('PROFILE_INVALID', `unknown productive category ${productive}`));
    }
  }
  for (const feed of input.feedProfiles) {
    const feedOk = validateFeedProfile(feed, input);
    if (!feedOk.ok) {
      return feedOk;
    }
  }
  return ok(Object.freeze({ ...input, productionAuthorized: false as const }));
}

export function validateFeedProfile(
  feed: ExternalProviderFeedProfile,
  profile: Pick<
    ExternalEconomicOracleProviderCandidateProfile,
    'providerId' | 'dataSourceCategories' | 'factTypes' | 'productiveCategories'
  >,
): Result<ExternalProviderFeedProfile, ProviderCandidateRejection> {
  if (feed.feedId.length === 0 || feed.sourceId.length === 0) {
    return err(candidateRejection('SOURCE_IDENTITY_INVALID', 'feedId and sourceId are required'));
  }
  if (DISPLAY_NAME_MAPPINGS.has(feed.sourceObservationIdMapping)) {
    return err(candidateRejection('SOURCE_IDENTITY_INVALID', 'display name cannot be source identity'));
  }
  if (feed.subjectNamespace.length === 0) {
    return err(candidateRejection('SOURCE_IDENTITY_INVALID', 'subject namespace is required'));
  }
  if (feed.maxPages < 1 || feed.maxRecordsPerPage < 1) {
    return err(candidateRejection('PAGINATION_BOUND_EXCEEDED', 'pagination bounds must be positive'));
  }
  if (feed.isReferencePrice && feed.productiveCategory !== null) {
    return err(candidateRejection('REFERENCE_PRICE_IS_NOT_PRODUCTIVE', 'REFERENCE_PRICE cannot name a productive category'));
  }
  if (feed.isReferencePrice && feed.factType !== 'REFERENCE_PRICE') {
    return err(candidateRejection('REFERENCE_PRICE_IS_NOT_PRODUCTIVE', 'reference-price feeds must use fact type REFERENCE_PRICE'));
  }
  if (feed.sourceUnit.length === 0 || feed.canonicalUnitPath.length === 0) {
    return err(candidateRejection('UNIT_EXTENSION_REQUIRED', 'source unit and canonical unit path are required'));
  }
  if (!profile.dataSourceCategories.includes(feed.dataSourceCategory)) {
    return err(candidateRejection('PROFILE_INVALID', `feed ${feed.feedId} category is not on the provider profile`));
  }
  if (!profile.factTypes.includes(feed.factType)) {
    return err(candidateRejection('PROFILE_INVALID', `feed ${feed.feedId} fact type is not on the provider profile`));
  }
  const routed = routeFamily(feed);
  if (!routed.ok) {
    return routed;
  }
  if (routed.value !== feed.familyId) {
    return err(candidateRejection('FAMILY_ROUTING_INVALID', `feed ${feed.feedId} family does not match taxonomy`));
  }
  return ok(feed);
}

export function profileMayCollect(
  profile: ExternalEconomicOracleProviderCandidateProfile,
): Result<true, ProviderCandidateRejection> {
  if (profile.state === 'SUSPENDED') {
    return err(candidateRejection('PROVIDER_SUSPENDED', `${profile.providerId} is suspended`));
  }
  if (profile.state === 'REVOKED') {
    return err(candidateRejection('PROVIDER_REVOKED', `${profile.providerId} is revoked`));
  }
  if (profile.productionAuthorized !== false) {
    return err(candidateRejection('PROFILE_INVALID', 'production authorization is forbidden on this plane'));
  }
  return ok(true);
}

export function deterministicSourceObservationId(input: {
  readonly providerId: string;
  readonly sourceId: string;
  readonly feedId: string;
  readonly subject: string;
  readonly sourceTimestampUnix: string;
  readonly numericValue: string;
}): string {
  return [
    input.providerId,
    input.sourceId,
    input.feedId,
    input.subject,
    input.sourceTimestampUnix,
    input.numericValue,
  ].join(':');
}
