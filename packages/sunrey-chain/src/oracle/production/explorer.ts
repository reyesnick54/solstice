import type { VerifiedEconomicFact } from '../types.ts';
import type { ProductionFeedConfiguration, PublicOracleFeedMetadata, QualityClass } from './types.ts';

export function publicFeedMetadata(input: {
  readonly feed: ProductionFeedConfiguration;
  readonly providerCount: number;
  readonly fact: VerifiedEconomicFact | undefined;
  readonly nowUnix: bigint;
  readonly qualityClass: QualityClass;
}): PublicOracleFeedMetadata {
  const freshness =
    !input.fact ? 'UNKNOWN' : input.nowUnix > input.fact.validUntilUnix ? 'STALE' : 'FRESH';
  return Object.freeze({
    feedId: input.feed.feedId,
    providerCount: input.providerCount,
    aggregationMethod: input.feed.aggregationPolicy,
    freshness,
    qualityClass: input.qualityClass,
    verifiedFact: input.fact?.qualityStatus === 'VERIFIED' ? input.fact.factId : null,
    credentialsExposed: false,
    commercialTermsExposed: false,
  });
}

export function redactCommercialTerms<T extends { readonly commercialAgreementRef?: string | null }>(
  record: T,
): Omit<T, 'commercialAgreementRef'> & { readonly commercialAgreementRef: null } {
  return Object.freeze({ ...record, commercialAgreementRef: null });
}
