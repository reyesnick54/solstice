import { asUtcInstant } from '@solstice/domain';

import { buildCohortAllocationPolicy } from './allocation.ts';
import { createForwardCohort, asForwardExperimentId } from './cohort.ts';
import { createChronologicalOpportunitySet, sharedOpportunityIdsForCohort } from './opportunity-alignment.ts';
import { sealForwardExperimentPreregistration } from './preregistration.ts';
import { createForwardControlStrategy, createForwardTreatmentStrategy } from './strategies.ts';
import type { ForwardCohort } from './types.ts';
import type { MemberOutcomeInput } from './comparison.ts';

const T0 = asUtcInstant('2026-11-08T12:00:00.000Z');

export function alpha20FixtureOpportunities() {
  return Object.freeze([
    {
      opportunityId: 'opp_alpha20_0',
      chronologicalIndex: 0,
      decisionAt: asUtcInstant('2026-11-08T13:00:00.000Z'),
      instrumentId: 'EQ:SIM:AAA',
      knowableAt: asUtcInstant('2026-11-08T12:59:00.000Z'),
    },
    {
      opportunityId: 'opp_alpha20_1',
      chronologicalIndex: 1,
      decisionAt: asUtcInstant('2026-11-08T14:00:00.000Z'),
      instrumentId: 'EQ:SIM:BBB',
      knowableAt: asUtcInstant('2026-11-08T13:59:00.000Z'),
    },
    {
      opportunityId: 'opp_alpha20_2',
      chronologicalIndex: 2,
      decisionAt: asUtcInstant('2026-11-08T15:00:00.000Z'),
      instrumentId: 'EQ:SIM:CCC',
      knowableAt: asUtcInstant('2026-11-08T14:59:00.000Z'),
    },
  ]);
}

export function alpha20QualifiedForwardCohort(): ForwardCohort {
  const opportunitySet = createChronologicalOpportunitySet({
    opportunitySetId: 'opp_set_alpha20_fixture',
    opportunities: alpha20FixtureOpportunities(),
  });
  const sharedIds = sharedOpportunityIdsForCohort(opportunitySet);
  const experimentId = asForwardExperimentId('exp_alpha20_fixture');

  const preregistration = sealForwardExperimentPreregistration({
    preregistrationId: 'prereg_alpha20_fixture',
    primaryOutcomeMetricId: 'active_return_bps',
    secondaryOutcomeMetricIds: Object.freeze(['sharpe_like_bps', 'max_drawdown_bps']),
    benchmarkId: 'SIM_EQ_MARKET',
    minimumSampleOpportunities: 3,
    stoppingPolicyKind: 'FIXED_HORIZON',
    fixedHorizonOpportunities: 3,
    sealedAt: T0,
  });

  const controlStrategies = Object.freeze([
    createForwardControlStrategy({
      memberId: 'mbr_cash',
      strategyId: 'strat_cash',
      strategyVersion: '1.0.0',
      role: 'CASH',
      shadowCapitalRegistrationId: 'reg_shadow_cash',
      assignedOpportunityIds: sharedIds,
    }),
    createForwardControlStrategy({
      memberId: 'mbr_bench',
      strategyId: 'strat_market_bench',
      strategyVersion: '1.0.0',
      role: 'MARKET_BENCHMARK',
      shadowCapitalRegistrationId: 'reg_shadow_bench',
      assignedOpportunityIds: sharedIds,
    }),
    createForwardControlStrategy({
      memberId: 'mbr_naive',
      strategyId: 'strat_naive',
      strategyVersion: '1.0.0',
      role: 'NAIVE_BASELINE',
      shadowCapitalRegistrationId: 'reg_shadow_naive',
      assignedOpportunityIds: sharedIds,
    }),
  ]);

  const treatmentStrategies = Object.freeze([
    createForwardTreatmentStrategy({
      memberId: 'mbr_champion',
      strategyId: 'strat_champion',
      strategyVersion: '2.1.0',
      role: 'INCUMBENT_CHAMPION',
      shadowCapitalRegistrationId: 'reg_shadow_champion',
      assignedOpportunityIds: sharedIds,
    }),
    createForwardTreatmentStrategy({
      memberId: 'mbr_challenger',
      strategyId: 'strat_challenger',
      strategyVersion: '0.9.0',
      role: 'CHALLENGER',
      shadowCapitalRegistrationId: 'reg_shadow_challenger',
      assignedOpportunityIds: sharedIds,
      evolNominationRef: 'evol_nom_alpha20',
    }),
  ]);

  const memberIds = Object.freeze([
    ...controlStrategies.map((s) => s.memberId),
    ...treatmentStrategies.map((s) => s.memberId),
  ]);

  const allocationPolicy = buildCohortAllocationPolicy({
    policyId: 'alloc_alpha20_fixture',
    experimentId,
    memberIds,
    sharedPortfolioCapitalMinor: '100000000',
    opportunityAssignmentMode: 'CHRONOLOGICAL_IDENTICAL',
  });

  return createForwardCohort({
    experimentId,
    cohortId: 'cohort_alpha20_fixture',
    preregistration,
    sealedAt: T0,
    opportunitySet,
    allocationPolicy,
    controlStrategies,
    treatmentStrategies,
  });
}

export function alpha20FixtureMemberOutcomes(): readonly MemberOutcomeInput[] {
  return Object.freeze([
    { memberId: 'mbr_cash', primaryOutcomeBps: 0, activeReturnBps: 0 },
    { memberId: 'mbr_bench', primaryOutcomeBps: 45, activeReturnBps: 45 },
    { memberId: 'mbr_naive', primaryOutcomeBps: 20, activeReturnBps: 18 },
    { memberId: 'mbr_champion', primaryOutcomeBps: 120, activeReturnBps: 75 },
    { memberId: 'mbr_challenger', primaryOutcomeBps: 95, activeReturnBps: 50 },
  ]);
}
