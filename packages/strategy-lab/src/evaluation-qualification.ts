import { createHash } from 'node:crypto';

import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { BacktestRun } from './backtest.ts';
import type { PromotionCapsule } from './promotion-capsule.ts';
import { asEvaluationQualificationId, type EvaluationQualificationId } from './ids.ts';
import type { QualificationPolicy } from './qualification-policy.ts';
import type { StrategyFailure } from './types.ts';
import type { StrategyValidationReport } from './validation.ts';
import type { WalkForwardRun } from './walk-forward.ts';

export type EvaluationQualificationMetrics = {
  readonly evaluationDays: number;
  readonly opportunityCount: number;
  readonly maxDrawdownBps: number;
  readonly realizedLossMinor: bigint;
  readonly benchmarkRelativeBps: number | null;
  readonly costSensitivityPassed: boolean;
  readonly robustnessWindowCount: number;
  readonly futureLeakageDetected: boolean;
  readonly reproducible: boolean;
  readonly limitationsAccepted: boolean;
  readonly noActionCount: number;
};

export type EvaluationQualificationResult = {
  readonly qualificationId: EvaluationQualificationId;
  readonly capsuleFingerprint: string;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly policyHash: string;
  readonly metrics: EvaluationQualificationMetrics;
  readonly passCriteria: readonly string[];
  readonly failCriteria: readonly string[];
  readonly passed: boolean;
  readonly generatedAt: UtcInstant;
};

function daysBetween(start: UtcInstant, end: UtcInstant): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export function evaluateQualification(input: {
  readonly capsule: PromotionCapsule;
  readonly policy: QualificationPolicy;
  readonly validation: StrategyValidationReport;
  readonly outOfSample?: BacktestRun | null;
  readonly walkForward?: WalkForwardRun | null;
  readonly reproducibilityHash?: string | null;
  readonly priorReproducibilityHash?: string | null;
  readonly limitationsAccepted?: boolean;
  readonly generatedAt: UtcInstant;
}): Result<EvaluationQualificationResult, StrategyFailure> {
  const oos = input.outOfSample ?? input.validation.outOfSampleResults;
  if (!oos) {
    return err({
      code: 'PROMOTION_GATE_FAILED',
      message: 'evaluation qualification requires out-of-sample results',
    });
  }
  const evaluationDays = daysBetween(oos.period.start, oos.period.end);
  const opportunityCount = oos.results.tradeCount;
  const maxDrawdownBps = Number(oos.results.maximumDrawdown.units / 10_000n);
  const netPnlMinor = oos.results.endingCapitalMinor - oos.results.startingCapitalMinor;
  const realizedLossMinor = netPnlMinor < 0n ? -netPnlMinor : 0n;
  const reproducible =
    input.reproducibilityHash !== undefined &&
    input.priorReproducibilityHash !== undefined &&
    input.reproducibilityHash === input.priorReproducibilityHash;
  const costSensitivityPassed =
    !input.policy.costSensitivityRequired ||
    oos.transactionCosts.mode === 'EXPLICIT_COSTS';
  const robustnessWindowCount = input.walkForward?.folds.length ?? 1;
  const limitationsAccepted = input.limitationsAccepted ?? input.validation.limitations.length === 0;

  const metrics: EvaluationQualificationMetrics = Object.freeze({
    evaluationDays,
    opportunityCount,
    maxDrawdownBps,
    realizedLossMinor,
    benchmarkRelativeBps: null,
    costSensitivityPassed,
    robustnessWindowCount,
    futureLeakageDetected: false,
    reproducible,
    limitationsAccepted,
    noActionCount: 0,
  });

  const passCriteria: string[] = [];
  const failCriteria: string[] = [];

  if (evaluationDays >= input.policy.minimumEvaluationDays) {
    passCriteria.push('minimum_evaluation_days');
  } else {
    failCriteria.push('minimum_evaluation_days');
  }
  if (opportunityCount >= input.policy.minimumOpportunityCount) {
    passCriteria.push('minimum_opportunity_count');
  } else if (opportunityCount === 0) {
    passCriteria.push('no_trade_strategy_accepted');
  } else {
    failCriteria.push('minimum_opportunity_count');
  }
  if (maxDrawdownBps <= input.policy.maxDrawdownBps) {
    passCriteria.push('max_drawdown');
  } else {
    failCriteria.push('max_drawdown');
  }
  if (input.policy.maxLossMinor === null || realizedLossMinor <= input.policy.maxLossMinor) {
    passCriteria.push('max_loss');
  } else {
    failCriteria.push('max_loss');
  }
  if (costSensitivityPassed) {
    passCriteria.push('cost_sensitivity');
  } else {
    failCriteria.push('cost_sensitivity');
  }
  if (robustnessWindowCount >= input.policy.robustnessWindowCount) {
    passCriteria.push('robustness_windows');
  } else {
    failCriteria.push('robustness_windows');
  }
  if (!input.policy.reproducibilityRequired || reproducible) {
    passCriteria.push('reproducibility');
  } else {
    failCriteria.push('reproducibility');
  }
  if (limitationsAccepted) {
    passCriteria.push('limitations_accepted');
  } else {
    failCriteria.push('limitations_accepted');
  }

  const passed = failCriteria.length === 0;
  const material = JSON.stringify({
    capsule: input.capsule.fingerprint,
    policy: input.policy.policyHash,
    passed,
    oos: oos.outputHash,
  });
  const qualificationId = asEvaluationQualificationId(
    `eqf_${createHash('sha256').update(material).digest('hex').slice(0, 20)}`,
  );

  return ok(
    Object.freeze({
      qualificationId,
      capsuleFingerprint: input.capsule.fingerprint,
      strategyId: input.capsule.strategyId,
      strategyVersion: input.capsule.version,
      policyId: input.policy.policyId,
      policyVersion: input.policy.version,
      policyHash: input.policy.policyHash,
      metrics,
      passCriteria: Object.freeze([...passCriteria]),
      failCriteria: Object.freeze([...failCriteria]),
      passed,
      generatedAt: input.generatedAt,
    }),
  );
}
