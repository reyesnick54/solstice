import { asUtcInstant } from '@solstice/domain';

import type {
  ForwardCampaignRecord,
  ForwardResearchBookInput,
  ForwardResearchOperationalSnapshot,
  ForwardStrategyResearchRecord,
} from './types.ts';

const T0 = asUtcInstant('2026-11-01T00:00:00.000Z');
const T1 = asUtcInstant('2026-11-08T00:00:00.000Z');
const T_DAY = asUtcInstant('2026-11-08T12:00:00.000Z');

function strategy(
  overrides: Partial<ForwardStrategyResearchRecord> & Pick<ForwardStrategyResearchRecord, 'strategyId'>,
): ForwardStrategyResearchRecord {
  return Object.freeze({
    campaignId: overrides.campaignId ?? 'cmp_alpha24_fixture',
    genomeId: overrides.genomeId ?? 'genome_fixture',
    lifecycle: overrides.lifecycle ?? 'ACTIVE',
    registeredAt: overrides.registeredAt ?? T0,
    retiredAt: overrides.retiredAt ?? null,
    cumulativePnLMinor: overrides.cumulativePnLMinor ?? 1_500_000n,
    benchmarkRelativeBps: overrides.benchmarkRelativeBps ?? 120,
    maxDrawdownBps: overrides.maxDrawdownBps ?? 350,
    paperTradeCount: overrides.paperTradeCount ?? 42,
    executionQualityScoreBps: overrides.executionQualityScoreBps ?? 9_200,
    outcomeMaturityDays: overrides.outcomeMaturityDays ?? 30,
    regimeTags: overrides.regimeTags ?? Object.freeze(['RISK_ON']),
    capacityUtilizationBps: overrides.capacityUtilizationBps ?? 4_500,
    alphaDecayBps: overrides.alphaDecayBps ?? 15,
    executionDecayBps: overrides.executionDecayBps ?? 8,
    sequentialEvidenceState: overrides.sequentialEvidenceState ?? 'ACCUMULATING',
    multipleTestingBucket: overrides.multipleTestingBucket ?? 'family_momentum_v1',
    dataQualityIssueCount: overrides.dataQualityIssueCount ?? 0,
    unresolvedConcernCount: overrides.unresolvedConcernCount ?? 0,
    isChallenger: overrides.isChallenger ?? false,
    rankOrdinal: overrides.rankOrdinal ?? null,
    strategyId: overrides.strategyId,
  });
}

export function alpha24MixedUniverseFixture(): ForwardResearchBookInput {
  const campaigns: ForwardCampaignRecord[] = [
    Object.freeze({
      campaignId: 'cmp_alpha24_fixture',
      startedAt: T0,
      terminatedAt: null,
      state: 'ACTIVE',
      opportunityCount: 8,
    }),
    Object.freeze({
      campaignId: 'cmp_alpha24_retired',
      startedAt: asUtcInstant('2026-09-01T00:00:00.000Z'),
      terminatedAt: T1,
      state: 'COMPLETE',
      opportunityCount: 3,
    }),
  ];
  const strategies: ForwardStrategyResearchRecord[] = [
    strategy({ strategyId: 'str_winner_a', benchmarkRelativeBps: 210, cumulativePnLMinor: 2_100_000n }),
    strategy({
      strategyId: 'str_loser_b',
      benchmarkRelativeBps: -180,
      cumulativePnLMinor: -900_000n,
      lifecycle: 'ACTIVE',
    }),
    strategy({
      strategyId: 'str_retired_loser',
      benchmarkRelativeBps: -95,
      cumulativePnLMinor: -300_000n,
      lifecycle: 'RETIRED',
      retiredAt: T1,
      campaignId: 'cmp_alpha24_retired',
    }),
    strategy({
      strategyId: 'str_challenger_c',
      benchmarkRelativeBps: 45,
      isChallenger: true,
      lifecycle: 'CHALLENGER',
    }),
  ];
  const operations: ForwardResearchOperationalSnapshot = Object.freeze({
    asOf: T_DAY,
    periodStart: T1,
    periodEnd: T_DAY,
    marketConditionsSummary: 'simulation; elevated cross-asset dispersion; data_quality=ok',
    marketRegimeTag: 'TRANSITION',
    newDecisionCount: 6,
    incidentCount: 0,
    portfolioCumulativePnLMinor: 900_000n,
    portfolioBenchmarkRelativeBps: 35,
    portfolioMaxDrawdownBps: 420,
    riskMetricVolatilityBps: 1_100,
    riskMetricTailLossBps: 280,
    multipleTestingStateSummary: 'combined_effective_trials=14; firewall=armed',
    sequentialEvidenceSummary: 'e_value_below_promotion_threshold',
  });
  return Object.freeze({ campaigns, strategies, operations });
}

export function alpha24WinnersOnlyInputFixture(): ForwardResearchBookInput {
  const base = alpha24MixedUniverseFixture();
  const winnersOnly = base.strategies
    .filter((s) => s.benchmarkRelativeBps > 0)
    .map((s) => ({ ...s, lifecycle: 'ACTIVE' as const, retiredAt: null }));
  return Object.freeze({
    ...base,
    strategies: winnersOnly,
  });
}
