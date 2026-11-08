import type { UtcInstant } from '@solstice/domain';

import { HELIOS_ALPHA20_FORWARD_EXPERIMENTS_SCHEMA } from './taxonomy.ts';
import type {
  CohortComparison,
  CohortMemberOutcomeSlice,
  ForwardCohort,
  ForwardExperimentPreregistration,
} from './types.ts';
import type { CohortShadowCapitalLedger } from './shadow-capital.ts';
import { memberShadowNavMinor } from './shadow-capital.ts';
import {
  assertMembersShareIdenticalOpportunityCalendar,
  sharedOpportunityIdsForCohort,
} from './opportunity-alignment.ts';

export type MemberOutcomeInput = {
  readonly memberId: string;
  readonly primaryOutcomeBps: number;
  readonly activeReturnBps: number;
  readonly shadowNavMinor?: string;
};

function averageBps(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sum = values.reduce((s, v) => s + v, 0);
  return Math.round(sum / values.length);
}

export function evaluateStoppingPolicySatisfied(
  preregistration: ForwardExperimentPreregistration,
  opportunityCount: number,
): boolean {
  const { stoppingPolicy, minimumSampleOpportunities } = preregistration;
  if (opportunityCount < minimumSampleOpportunities) {
    return false;
  }
  if (stoppingPolicy.kind === 'FIXED_HORIZON') {
    const horizon = stoppingPolicy.fixedHorizonOpportunities;
    return horizon !== null && opportunityCount >= horizon;
  }
  if (stoppingPolicy.kind === 'SEQUENTIAL_ALPHA07_BOUND') {
    return opportunityCount >= minimumSampleOpportunities;
  }
  return opportunityCount >= minimumSampleOpportunities;
}

export function buildCohortComparison(input: {
  readonly cohort: ForwardCohort;
  readonly comparedAt: UtcInstant;
  readonly memberOutcomes: readonly MemberOutcomeInput[];
  readonly shadowLedger?: CohortShadowCapitalLedger;
}): CohortComparison {
  const canonical = sharedOpportunityIdsForCohort(input.cohort.opportunitySet);
  const memberMap: Record<string, readonly string[]> = {};
  for (const s of [...input.cohort.controlStrategies, ...input.cohort.treatmentStrategies]) {
    memberMap[s.memberId] = s.assignedOpportunityIds;
  }
  const calendarOk = assertMembersShareIdenticalOpportunityCalendar(memberMap, canonical);

  const byId = new Map(input.memberOutcomes.map((row) => [row.memberId, row]));
  const slices: CohortMemberOutcomeSlice[] = [];
  for (const member of [...input.cohort.controlStrategies, ...input.cohort.treatmentStrategies]) {
    const outcome = byId.get(member.memberId);
    if (!outcome) {
      throw new Error(`ALPHA20 comparison missing outcome for ${member.memberId}`);
    }
    slices.push(
      Object.freeze({
        memberId: member.memberId,
        strategyId: member.strategyId,
        lane: member.lane,
        role: member.role,
        opportunityCount: member.assignedOpportunityIds.length,
        primaryOutcomeBps: outcome.primaryOutcomeBps,
        activeReturnBps: outcome.activeReturnBps,
        shadowNavMinor:
          outcome.shadowNavMinor ??
          (input.shadowLedger ? memberShadowNavMinor(input.shadowLedger, member.memberId) : '0'),
      }),
    );
  }

  const controlActive = slices.filter((s) => s.lane === 'CONTROL').map((s) => s.activeReturnBps);
  const treatmentActive = slices.filter((s) => s.lane === 'TREATMENT').map((s) => s.activeReturnBps);
  const controlPrimary = slices.filter((s) => s.lane === 'CONTROL').map((s) => s.primaryOutcomeBps);
  const treatmentPrimary = slices.filter((s) => s.lane === 'TREATMENT').map((s) => s.primaryOutcomeBps);

  const treatmentVsControlActiveReturnDeltaBps = averageBps(treatmentActive) - averageBps(controlActive);
  const primaryOutcomeTreatmentAdvantageBps = averageBps(treatmentPrimary) - averageBps(controlPrimary);

  const oppCount = canonical.length;
  const sampleRequirementMet = oppCount >= input.cohort.preregistration.minimumSampleOpportunities;
  const stoppingPolicySatisfied = evaluateStoppingPolicySatisfied(input.cohort.preregistration, oppCount);

  return Object.freeze({
    schema: HELIOS_ALPHA20_FORWARD_EXPERIMENTS_SCHEMA,
    experimentId: input.cohort.experimentId,
    comparedAt: input.comparedAt,
    opportunitySetId: input.cohort.opportunitySet.opportunitySetId,
    identicalOpportunitySets: calendarOk,
    calendarAlignmentVerified: calendarOk,
    memberOutcomes: Object.freeze(slices),
    treatmentVsControlActiveReturnDeltaBps,
    primaryOutcomeTreatmentAdvantageBps,
    sampleRequirementMet,
    stoppingPolicySatisfied,
  });
}
