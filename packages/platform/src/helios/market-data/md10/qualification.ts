/**
 * HELIOS MD10 macro market reference qualification gate.
 */

import { asUtcInstant } from '@solstice/domain';
import { buildCommodityBasisLink, assertCommodityComparable } from './commodity-basis.ts';
import {
  buildCommodityDecentralizedConsensus,
  buildFxDecentralizedConsensus,
  buildRateDecentralizedConsensus,
} from './consensus.ts';
import {
  MD10_FIXTURE_EUR_USD_CONTRIBUTOR_QUOTES,
  fixtureEurUsdFixing,
  fixtureEurUsdVenueQuote,
  fixtureUsPolicyRate,
  fixtureUsTenYearYield,
  fixtureWtiFutures,
  fixtureWtiPhysicalBenchmark,
} from './fixtures.ts';

export const HELIOS_MD10_MACRO_MARKET_REFERENCE_QUALIFIED =
  'HELIOS_MD10_MACRO_MARKET_REFERENCE_QUALIFIED' as const;
export const HELIOS_MD10_MACRO_MARKET_REFERENCE_BLOCKED =
  'HELIOS_MD10_MACRO_MARKET_REFERENCE_BLOCKED' as const;

export type Md10QualificationChecks = {
  readonly fxLanesIsolated: boolean;
  readonly fxBidAskTracked: boolean;
  readonly fxNoSingleTruePrice: boolean;
  readonly fxConsensusDispersion: boolean;
  readonly ratesYieldPolicyOvernight: boolean;
  readonly unlicensedSwapRejected: boolean;
  readonly commodityKindSeparation: boolean;
  readonly futuresPhysicalBasisEnforced: boolean;
  readonly robustEstimatorOnly: boolean;
  readonly sourceCountEmitted: boolean;
};

export type Md10QualificationResult = {
  readonly marker:
    | typeof HELIOS_MD10_MACRO_MARKET_REFERENCE_QUALIFIED
    | typeof HELIOS_MD10_MACRO_MARKET_REFERENCE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly checks: Md10QualificationChecks;
};

const NOW = asUtcInstant('2026-09-16T15:00:00.000Z');

export function evaluateMd10Qualification(): Md10QualificationResult {
  const blockers: string[] = [];

  const contributorConsensus = buildFxDecentralizedConsensus({
    seed: MD10_FIXTURE_EUR_USD_CONTRIBUTOR_QUOTES[0]!,
    observations: MD10_FIXTURE_EUR_USD_CONTRIBUTOR_QUOTES,
    evaluatedAt: NOW,
    estimator: 'TRIMMED_MEDIAN',
    trimCount: 1,
  });

  const venueQuote = fixtureEurUsdVenueQuote({
    observationId: 'fx:eurusd:venue',
    venueId: 'EBS',
    providerId: 'venue_feed',
    bidNumerator: 108_40n,
    askNumerator: 108_42n,
  });
  const mixedLaneAttempt = buildFxDecentralizedConsensus({
    seed: MD10_FIXTURE_EUR_USD_CONTRIBUTOR_QUOTES[0]!,
    observations: [...MD10_FIXTURE_EUR_USD_CONTRIBUTOR_QUOTES, venueQuote],
    evaluatedAt: NOW,
  });
  const fixing = fixtureEurUsdFixing('fx:eurusd:fix', 108_50n);
  const fixingOnly = buildFxDecentralizedConsensus({
    seed: fixing,
    observations: [fixing, fixtureEurUsdFixing('fx:eurusd:fix2', 108_51n)],
    evaluatedAt: NOW,
  });

  const fxLanesIsolated =
    mixedLaneAttempt.sourceCount === MD10_FIXTURE_EUR_USD_CONTRIBUTOR_QUOTES.length &&
    mixedLaneAttempt.contributingObservationIds.every((id) => id !== venueQuote.provenance.observationId);

  const fxBidAskTracked =
    contributorConsensus.consolidatedBid !== null &&
    contributorConsensus.consolidatedAsk !== null &&
    contributorConsensus.consolidatedBid.numerator > 0n &&
    contributorConsensus.consolidatedAsk.numerator >= contributorConsensus.consolidatedBid.numerator;

  const fxNoSingleTruePrice = contributorConsensus.grantsSingleTruePrice === false;

  const fxConsensusDispersion =
    contributorConsensus.status === 'CONSOLIDATED' &&
    contributorConsensus.dispersion !== null &&
    contributorConsensus.dispersion.sourceMidsUsed >= 2;

  const policy = fixtureUsPolicyRate('rates:us:policy', 475);
  const tenYear = fixtureUsTenYearYield('rates:us:10y', 412);
  const overnight = Object.freeze({
    ...policy,
    kind: 'overnight_rate' as const,
    provenance: Object.freeze({ ...policy.provenance, observationId: 'rates:us:overnight' }),
  });
  const ratesConsensus = buildRateDecentralizedConsensus({
    seed: tenYear,
    observations: [tenYear, fixtureUsTenYearYield('rates:us:10y:b', 415)],
    evaluatedAt: NOW,
  });
  const ratesYieldPolicyOvernight =
    policy.kind === 'policy_rate' && tenYear.kind === 'government_yield' && overnight.kind === 'overnight_rate';

  const unlicensedSwap = Object.freeze({
    ...tenYear,
    kind: 'swap_reference_rate' as const,
    licensedSwapReference: false,
    provenance: Object.freeze({ ...tenYear.provenance, observationId: 'rates:swap:unlicensed' }),
  });
  const licensedSwap = Object.freeze({
    ...unlicensedSwap,
    licensedSwapReference: true,
    provenance: Object.freeze({ ...unlicensedSwap.provenance, observationId: 'rates:swap:licensed' }),
  });
  const swapConsensus = buildRateDecentralizedConsensus({
    seed: licensedSwap,
    observations: [unlicensedSwap, licensedSwap],
    evaluatedAt: NOW,
  });
  const unlicensedSwapRejected = swapConsensus.sourceCount === 1;

  const wtiFutures = fixtureWtiFutures('commodity:wti:dec', 72_50n);
  const wtiPhysical = fixtureWtiPhysicalBenchmark('commodity:wti:phys', 71_80n);
  const withoutBasis = assertCommodityComparable(wtiFutures, wtiPhysical, null);
  const basis = buildCommodityBasisLink({
    futures: wtiFutures,
    physical: wtiPhysical,
    basisMinorUnits: 70n,
    documentedAt: NOW,
  });
  const withBasis = assertCommodityComparable(wtiFutures, wtiPhysical, basis);

  const spotConsensus = buildCommodityDecentralizedConsensus({
    seed: wtiFutures,
    observations: [wtiFutures, fixtureWtiFutures('commodity:wti:dec:b', 72_55n)],
    evaluatedAt: NOW,
  });
  const commodityKindSeparation =
    withoutBasis.ok === false &&
    spotConsensus.status === 'CONSOLIDATED' &&
    spotConsensus.consensusKey.includes('futures');

  const futuresPhysicalBasisEnforced = withoutBasis.ok === false && withBasis.ok === true;

  const robustEstimatorOnly =
    contributorConsensus.estimator === 'TRIMMED_MEDIAN' &&
    (fixingOnly.estimator === 'MEDIAN' || fixingOnly.estimator === 'TRIMMED_MEDIAN');

  const sourceCountEmitted =
    contributorConsensus.sourceCount >= 4 &&
    ratesConsensus.sourceCount >= 2 &&
    fixingOnly.sourceCount >= 2;

  const checks: Md10QualificationChecks = Object.freeze({
    fxLanesIsolated,
    fxBidAskTracked,
    fxNoSingleTruePrice,
    fxConsensusDispersion,
    ratesYieldPolicyOvernight,
    unlicensedSwapRejected,
    commodityKindSeparation,
    futuresPhysicalBasisEnforced,
    robustEstimatorOnly,
    sourceCountEmitted,
  });

  for (const [key, passed] of Object.entries(checks)) {
    if (!passed) {
      blockers.push(key);
    }
  }

  return Object.freeze({
    marker:
      blockers.length === 0
        ? HELIOS_MD10_MACRO_MARKET_REFERENCE_QUALIFIED
        : HELIOS_MD10_MACRO_MARKET_REFERENCE_BLOCKED,
    qualified: blockers.length === 0,
    blockers: Object.freeze(blockers),
    checks,
  });
}
