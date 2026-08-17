import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { VerifiedEconomicFact } from '../types.ts';
import type { VerifiedProductiveContribution } from '../../productive/verification.ts';
import { computeProductionEligibility } from './onboarding.ts';
import type {
  DataSourceCategory,
  OracleProviderOnboardingRecord,
  ProductionContributionEligibilityPolicy,
  ProductionFeedConfiguration,
  ProductionOracleRejection,
} from './types.ts';

export function defaultEligibilityPolicy(
  feedIds: readonly string[],
  categories: readonly DataSourceCategory[],
): ProductionContributionEligibilityPolicy {
  return Object.freeze({
    schemaVersion: 1,
    policyId: 'moonrey.production.eligibility.v1',
    policyVersion: 1,
    eligibleFeedIds: [...feedIds],
    eligibleCategories: [...categories],
    minimumProviders: 3,
    minimumIndependentControllers: 3,
    minimumQualityBps: 6_000,
    maximumFactAgeSeconds: 3_600,
    requireContributionLineage: true,
    requireVerifiedFact: true,
    automaticIssuance: false,
  });
}

export function evaluateProductionContributionEligibility(input: {
  readonly policy: ProductionContributionEligibilityPolicy;
  readonly feed: ProductionFeedConfiguration;
  readonly providers: readonly OracleProviderOnboardingRecord[];
  readonly fact: VerifiedEconomicFact | undefined;
  readonly category: DataSourceCategory;
  readonly nowUnix: bigint;
  readonly contribution: VerifiedProductiveContribution | null;
  readonly qualityBps: number;
}): Result<{ readonly eligible: true; readonly mintsMoonRey: false }, ProductionOracleRejection> {
  if (input.policy.automaticIssuance !== false) {
    return err({ code: 'AUTOMATIC_ISSUANCE_FORBIDDEN', detail: 'oracle facts never mint MoonRey' });
  }
  if (!input.feed.productionEligible || !input.policy.eligibleFeedIds.includes(input.feed.feedId)) {
    return err({ code: 'FEED_NOT_PRODUCTION_ELIGIBLE', detail: input.feed.feedId });
  }
  if (!input.policy.eligibleCategories.includes(input.category)) {
    return err({ code: 'CATEGORY_NOT_ELIGIBLE', detail: input.category });
  }
  const eligibleProviders = input.providers.filter(
    (row) => computeProductionEligibility(row) && row.feeds.includes(input.feed.feedId),
  );
  if (eligibleProviders.length < input.policy.minimumProviders) {
    return err({
      code: 'PROVIDER_NOT_ELIGIBLE',
      detail: `need ${input.policy.minimumProviders} production-eligible providers`,
    });
  }
  const controllers = new Set(eligibleProviders.map((row) => row.controllerReference));
  if (controllers.size < input.policy.minimumIndependentControllers) {
    return err({
      code: 'INSUFFICIENT_INDEPENDENT_CONTROLLERS',
      detail: 'production eligibility requires independent controllers',
    });
  }
  if (!input.fact || input.fact.qualityStatus !== 'VERIFIED') {
    return err({ code: 'FACT_NOT_VERIFIED', detail: 'MoonRey eligibility requires a verified fact' });
  }
  if (input.nowUnix > input.fact.validUntilUnix) {
    return err({ code: 'TIME_WINDOW_INELIGIBLE', detail: 'fact is outside the eligible time window' });
  }
  if (input.nowUnix - input.fact.observationWindow.endUnix > BigInt(input.policy.maximumFactAgeSeconds)) {
    return err({ code: 'TIME_WINDOW_INELIGIBLE', detail: 'fact exceeds policy maximum age' });
  }
  if (input.qualityBps < input.policy.minimumQualityBps) {
    return err({ code: 'QUALITY_BELOW_POLICY', detail: `${input.qualityBps} < ${input.policy.minimumQualityBps}` });
  }
  if (input.policy.requireContributionLineage && (!input.contribution || input.contribution.oracleFactIds.length === 0)) {
    return err({ code: 'LINEAGE_MISSING', detail: 'contribution lineage is required' });
  }
  return ok(Object.freeze({ eligible: true as const, mintsMoonRey: false as const }));
}

export function oracleFactCreationNeverMintsMoonRey(): true {
  return true;
}
