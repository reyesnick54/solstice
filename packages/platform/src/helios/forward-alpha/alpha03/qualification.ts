import {
  HELIOS_ALPHA03_PREQUENTIAL_ENGINE_BLOCKED,
  HELIOS_ALPHA03_PREQUENTIAL_ENGINE_QUALIFIED,
  SIMULATION_FORWARD_HARNESS,
  type PrequentialLoopPhase,
} from './taxonomy.ts';
import type { PrequentialDecision, PrequentialState } from './types.ts';

export type Alpha03QualificationChecks = Readonly<{
  readonly loopPhasesComplete: boolean;
  readonly decisionsSealedBeforeOutcome: boolean;
  readonly noRetroactivePredictionChange: boolean;
  readonly simulationHarnessLabeled: boolean;
  readonly restartPreservesSeals: boolean;
  readonly onlineLearningAfterScoreOnly: boolean;
  readonly pitEnforced: boolean;
  readonly noExecutionAuthority: boolean;
}>;

export type Alpha03QualificationResult = Readonly<{
  readonly marker:
    | typeof HELIOS_ALPHA03_PREQUENTIAL_ENGINE_QUALIFIED
    | typeof HELIOS_ALPHA03_PREQUENTIAL_ENGINE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
}>;

const REQUIRED_PHASES: readonly PrequentialLoopPhase[] = Object.freeze([
  'PREDICT',
  'SEAL',
  'WAIT',
  'OBSERVE',
  'SCORE',
]);

export function validatePrequentialDecisionInvariants(decision: PrequentialDecision): readonly string[] {
  const findings: string[] = [];
  if (!decision.immutableAfterSeal) {
    findings.push('DECISION_NOT_IMMUTABLE');
  }
  if (decision.grantsExecutionAuthority) {
    findings.push('EXECUTION_AUTHORITY_FORBIDDEN');
  }
  if (decision.score !== null && decision.outcome === null) {
    findings.push('SCORE_WITHOUT_OUTCOME');
  }
  if (decision.outcome !== null && decision.seal.contentHash.length === 0) {
    findings.push('OUTCOME_WITHOUT_SEAL');
  }
  return Object.freeze(findings);
}

export function evaluateAlpha03PrequentialQualification(
  checks: Alpha03QualificationChecks,
  state: PrequentialState,
  observedPhases: readonly PrequentialLoopPhase[],
): Alpha03QualificationResult {
  const blockers: string[] = [];
  for (const [key, pass] of Object.entries(checks) as [keyof Alpha03QualificationChecks, boolean][]) {
    if (!pass) {
      blockers.push(String(key));
    }
  }
  for (const phase of REQUIRED_PHASES) {
    if (!observedPhases.includes(phase)) {
      blockers.push(`missing_loop_phase:${phase}`);
    }
  }
  for (const decision of state.decisions) {
    for (const finding of validatePrequentialDecisionInvariants(decision)) {
      blockers.push(`decision:${decision.decisionId}:${finding}`);
    }
  }
  if (state.dataSource === SIMULATION_FORWARD_HARNESS && state.forwardAlphaEvidenceEligible) {
    blockers.push('simulation_must_not_claim_forward_alpha_evidence');
  }
  if (state.grantsExecutionAuthority) {
    blockers.push('campaign_execution_authority_forbidden');
  }
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_ALPHA03_PREQUENTIAL_ENGINE_QUALIFIED
      : HELIOS_ALPHA03_PREQUENTIAL_ENGINE_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
