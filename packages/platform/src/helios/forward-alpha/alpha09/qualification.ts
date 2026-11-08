/**
 * HELIOS Forward Alpha ALPHA09 qualification.
 */

import {
  HELIOS_ALPHA09_RISK_ADJUSTED_EVIDENCE_BLOCKED,
  HELIOS_ALPHA09_RISK_ADJUSTED_EVIDENCE_QUALIFIED,
} from './taxonomy.ts';
import type { ForwardAlpha09RiskAdjustedEvidence } from './types.ts';

export {
  HELIOS_ALPHA09_RISK_ADJUSTED_EVIDENCE_QUALIFIED,
  HELIOS_ALPHA09_RISK_ADJUSTED_EVIDENCE_BLOCKED,
};

export type Alpha09QualificationChecks = {
  readonly performanceStatePresent: boolean;
  readonly riskStatePresent: boolean;
  readonly tailStatePresent: boolean;
  readonly concentrationMeasured: boolean;
  readonly trackRecordAssessed: boolean;
  readonly meetsDurationAndOpportunity: boolean;
  readonly repeatabilityNotDominatedBySingleSlice: boolean;
  readonly simulationOnly: boolean;
  readonly noExecutionAuthority: boolean;
};

export type Alpha09QualificationResult = {
  readonly marker:
    | typeof HELIOS_ALPHA09_RISK_ADJUSTED_EVIDENCE_QUALIFIED
    | typeof HELIOS_ALPHA09_RISK_ADJUSTED_EVIDENCE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateForwardAlpha09Qualification(
  evidence: ForwardAlpha09RiskAdjustedEvidence,
): Alpha09QualificationResult {
  const checks: Alpha09QualificationChecks = {
    performanceStatePresent: evidence.performance.schema.length > 0,
    riskStatePresent: evidence.risk.schema.length > 0,
    tailStatePresent: evidence.tail.schema.length > 0,
    concentrationMeasured: evidence.concentration.schema.length > 0,
    trackRecordAssessed: evidence.trackRecord.schema.length > 0,
    meetsDurationAndOpportunity:
      evidence.trackRecord.meetsDurationRequirement && evidence.trackRecord.meetsOpportunityRequirement,
    repeatabilityNotDominatedBySingleSlice: !evidence.concentration.repeatabilityClaimBlocked,
    simulationOnly: evidence.simulationOnly,
    noExecutionAuthority: evidence.grantsExecutionAuthority === false,
  };

  const entries: [keyof Alpha09QualificationChecks, string][] = [
    ['performanceStatePresent', 'forward_performance_state'],
    ['riskStatePresent', 'forward_risk_state'],
    ['tailStatePresent', 'forward_tail_state'],
    ['concentrationMeasured', 'concentration_attribution'],
    ['trackRecordAssessed', 'minimum_track_record'],
    ['meetsDurationAndOpportunity', 'duration_and_opportunity_requirements'],
    ['repeatabilityNotDominatedBySingleSlice', 'no_single_slice_dominance'],
    ['simulationOnly', 'simulation_only'],
    ['noExecutionAuthority', 'no_execution_authority'],
  ];

  const blockers = entries.filter(([key]) => !checks[key]).map(([, label]) => label);
  const qualified = blockers.length === 0;

  return Object.freeze({
    marker: qualified
      ? HELIOS_ALPHA09_RISK_ADJUSTED_EVIDENCE_QUALIFIED
      : HELIOS_ALPHA09_RISK_ADJUSTED_EVIDENCE_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}

export function checksFromEvidence(evidence: ForwardAlpha09RiskAdjustedEvidence): Alpha09QualificationChecks {
  return {
    performanceStatePresent: true,
    riskStatePresent: true,
    tailStatePresent: true,
    concentrationMeasured: true,
    trackRecordAssessed: true,
    meetsDurationAndOpportunity:
      evidence.trackRecord.meetsDurationRequirement && evidence.trackRecord.meetsOpportunityRequirement,
    repeatabilityNotDominatedBySingleSlice: !evidence.concentration.repeatabilityClaimBlocked,
    simulationOnly: evidence.simulationOnly,
    noExecutionAuthority: evidence.grantsExecutionAuthority === false,
  };
}
