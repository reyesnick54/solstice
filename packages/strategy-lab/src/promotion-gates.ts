import { err, ok, type Result } from '../../domain/src/result.ts';
import type { PromotionCapsule } from './promotion-capsule.ts';
import type { EvaluationQualificationResult } from './evaluation-qualification.ts';
import type { ForwardShadowEvidenceSummary } from './forward-shadow.ts';
import type { QualificationPolicy } from './qualification-policy.ts';
import type { StrategyFailure } from './types.ts';

export type GateResult = {
  readonly gate: 'RESEARCH_TO_EVALUATION' | 'EVALUATION_TO_SHADOW' | 'SHADOW_TO_PAPER';
  readonly passed: boolean;
  readonly missing: readonly string[];
  readonly policyId: string;
  readonly policyVersion: string;
  readonly policyHash: string;
};

export function gateResearchToEvaluation(input: {
  readonly capsule: PromotionCapsule;
  readonly policy: QualificationPolicy;
}): Result<GateResult, StrategyFailure> {
  const missing: string[] = [];
  if (!input.capsule.fingerprint) missing.push('strategy fingerprint');
  if (input.capsule.instrumentUniverse.length === 0) missing.push('instrument universe');
  if (input.capsule.dataDependencies.length === 0) missing.push('feature/data dependencies');
  if (!input.capsule.costAssumptionsHash) missing.push('cost assumptions');
  if (!input.capsule.executionAssumptionsHash) missing.push('execution assumptions');
  if (input.capsule.evidenceRefs.length === 0) missing.push('evidence references');
  if (input.capsule.schemaDefects.length > 0) missing.push('schema/config defects unresolved');
  if (!input.capsule.compiledHash) missing.push('immutable compiled Strategy Capsule version');

  return ok(
    Object.freeze({
      gate: 'RESEARCH_TO_EVALUATION',
      passed: missing.length === 0,
      missing: Object.freeze([...missing]),
      policyId: input.policy.policyId,
      policyVersion: input.policy.version,
      policyHash: input.policy.policyHash,
    }),
  );
}

export function gateEvaluationToShadow(input: {
  readonly qualification: EvaluationQualificationResult;
  readonly policy: QualificationPolicy;
}): Result<GateResult, StrategyFailure> {
  const missing: string[] = [];
  if (input.qualification.policyHash !== input.policy.policyHash) {
    missing.push('qualification policy version mismatch');
  }
  if (!input.qualification.passed) {
    missing.push('declared evaluation qualification result');
  }
  return ok(
    Object.freeze({
      gate: 'EVALUATION_TO_SHADOW',
      passed: missing.length === 0,
      missing: Object.freeze([...missing]),
      policyId: input.policy.policyId,
      policyVersion: input.policy.version,
      policyHash: input.policy.policyHash,
    }),
  );
}

export function gateShadowToPaper(input: {
  readonly shadow: ForwardShadowEvidenceSummary;
  readonly policy: QualificationPolicy;
}): Result<GateResult, StrategyFailure> {
  const missing: string[] = [];
  if (input.shadow.durationDays < input.policy.shadowMinimumDurationDays) {
    missing.push('minimum forward shadow duration');
  }
  if (input.shadow.decisionCount < input.policy.shadowMinimumDecisions) {
    missing.push('minimum forward shadow decisions');
  }
  if (input.shadow.noActionCount < input.policy.shadowMinimumNoActionDecisions) {
    missing.push('minimum no-action shadow decisions');
  }
  if (input.shadow.maxDrawdownProxyBps > input.policy.shadowMaxDrawdownProxyBps) {
    missing.push('shadow drawdown proxy within limit');
  }
  if (input.policy.shadowCostSensitivityRequired && !input.shadow.costSensitivityPassed) {
    missing.push('shadow cost sensitivity');
  }
  if (input.policy.shadowBenchmarkComparisonRequired && !input.shadow.benchmarkComparisonPassed) {
    missing.push('shadow benchmark comparison');
  }
  if (input.policy.shadowCalibrationRequired && !input.shadow.calibrationPassed) {
    missing.push('shadow calibration');
  }
  if (input.shadow.financialEffectCreated) {
    return err({
      code: 'PROMOTION_GATE_FAILED',
      message: 'shadow run must not create financial reservation or execution',
    });
  }
  return ok(
    Object.freeze({
      gate: 'SHADOW_TO_PAPER',
      passed: missing.length === 0,
      missing: Object.freeze([...missing]),
      policyId: input.policy.policyId,
      policyVersion: input.policy.version,
      policyHash: input.policy.policyHash,
    }),
  );
}
