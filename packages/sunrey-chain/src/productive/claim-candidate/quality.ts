import type { VerifiedEconomicFact } from '../../oracle/types.ts';
import { mappingRejection, type SourceClaimCompatibilityRejection } from '../../oracle/source-taxonomy/types.ts';

export function evaluateFactFinality(
  fact: VerifiedEconomicFact,
  nowUnix: bigint,
): SourceClaimCompatibilityRejection | null {
  if (fact.qualityStatus === 'CONFLICTED') {
    return mappingRejection('VERIFIED_FACT_REQUIRED', `fact ${fact.factId} is conflicted`);
  }
  if (fact.qualityStatus === 'REVOKED_SOURCE') {
    return mappingRejection('VERIFIED_FACT_REQUIRED', `fact ${fact.factId} was produced by a revoked source`);
  }
  if (fact.qualityStatus === 'PENDING') {
    return mappingRejection('VERIFIED_FACT_REQUIRED', `fact ${fact.factId} is pending and unverified`);
  }
  if (fact.qualityStatus === 'STALE' || nowUnix > fact.validUntilUnix) {
    return mappingRejection('VERIFIED_FACT_REQUIRED', `fact ${fact.factId} is stale`);
  }
  if (fact.qualityStatus !== 'VERIFIED') {
    return mappingRejection('VERIFIED_FACT_REQUIRED', `fact ${fact.factId} has status ${fact.qualityStatus}`);
  }
  return null;
}

export function factQualityRejectionCode(fact: VerifiedEconomicFact, nowUnix: bigint): string {
  if (fact.qualityStatus === 'CONFLICTED') {
    return 'CONFLICTED';
  }
  if (fact.qualityStatus === 'PENDING' || fact.qualityStatus === 'SUPERSEDED') {
    return 'UNVERIFIED';
  }
  if (fact.qualityStatus === 'REVOKED_SOURCE') {
    return 'REVOKED_SOURCE';
  }
  if (fact.qualityStatus === 'STALE' || nowUnix > fact.validUntilUnix) {
    return 'STALE';
  }
  return fact.qualityStatus;
}
