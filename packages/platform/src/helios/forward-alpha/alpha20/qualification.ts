import {
  HELIOS_ALPHA20_FORWARD_EXPERIMENTS_BLOCKED,
  HELIOS_ALPHA20_FORWARD_EXPERIMENTS_QUALIFIED,
} from './taxonomy.ts';
import type { ForwardCohortExperimentEvidence } from './types.ts';
import { sumMemberWeightsConserved } from './shadow-capital.ts';

export type Alpha20QualificationResult = {
  readonly qualified: boolean;
  readonly marker:
    | typeof HELIOS_ALPHA20_FORWARD_EXPERIMENTS_QUALIFIED
    | typeof HELIOS_ALPHA20_FORWARD_EXPERIMENTS_BLOCKED;
  readonly blockers: readonly string[];
  readonly evidence: ForwardCohortExperimentEvidence;
};

export function evaluateAlpha20ForwardExperimentsQualification(
  evidence: ForwardCohortExperimentEvidence,
): Alpha20QualificationResult {
  const blockers: string[] = [];
  const { cohort, comparison } = evidence;

  if (cohort.grantsExecutionAuthority) {
    blockers.push('GRANTS_EXECUTION_AUTHORITY');
  }
  if (!cohort.simulationOnly) {
    blockers.push('NOT_SIMULATION_ONLY');
  }
  if (cohort.allocationPolicy.customerCapitalRandomized) {
    blockers.push('CUSTOMER_CAPITAL_RANDOMIZED');
  }
  if (!cohort.allocationPolicy.isolatedShadowAccounts) {
    blockers.push('SHADOW_ACCOUNTS_NOT_ISOLATED');
  }
  if (!sumMemberWeightsConserved(cohort.allocationPolicy)) {
    blockers.push('ALLOCATION_WEIGHTS_INVALID');
  }
  if (!comparison.calendarAlignmentVerified) {
    blockers.push('CALENDAR_MISALIGNMENT');
  }
  if (!comparison.identicalOpportunitySets) {
    blockers.push('UNEQUAL_OPPORTUNITY_SETS');
  }
  if (!comparison.sampleRequirementMet) {
    blockers.push('SAMPLE_REQUIREMENT_NOT_MET');
  }
  if (!comparison.stoppingPolicySatisfied) {
    blockers.push('STOPPING_POLICY_NOT_SATISFIED');
  }
  if (!cohort.preregistration.primaryOutcomeMetricId) {
    blockers.push('PRIMARY_OUTCOME_MISSING');
  }
  if (!cohort.preregistration.benchmarkId) {
    blockers.push('BENCHMARK_MISSING');
  }
  const hasControl = cohort.controlStrategies.length > 0;
  const hasTreatment = cohort.treatmentStrategies.length > 0;
  if (!hasControl || !hasTreatment) {
    blockers.push('INCOMPLETE_CONTROL_TREATMENT_ARMS');
  }

  const qualified = blockers.length === 0;
  return Object.freeze({
    qualified,
    marker: qualified ? HELIOS_ALPHA20_FORWARD_EXPERIMENTS_QUALIFIED : HELIOS_ALPHA20_FORWARD_EXPERIMENTS_BLOCKED,
    blockers: Object.freeze(blockers),
    evidence,
  });
}
