import { type Brand, brandAs } from '../../domain/src/brand.ts';

export type StrategyId = Brand<string, 'StrategyId'>;
export type StrategyVersion = Brand<string, 'StrategyVersion'>;
export type StrategySpecificationId = Brand<string, 'StrategySpecificationId'>;
export type StrategyCompilerVersion = Brand<string, 'StrategyCompilerVersion'>;
export type MarketDatasetId = Brand<string, 'MarketDatasetId'>;
export type MarketDatasetVersion = Brand<string, 'MarketDatasetVersion'>;
export type ExperimentId = Brand<string, 'ExperimentId'>;
export type ParameterSetId = Brand<string, 'ParameterSetId'>;
export type BacktestRunId = Brand<string, 'BacktestRunId'>;
export type WalkForwardRunId = Brand<string, 'WalkForwardRunId'>;
export type StrategyValidationId = Brand<string, 'StrategyValidationId'>;
export type ShadowRunId = Brand<string, 'ShadowRunId'>;
export type ShadowDecisionId = Brand<string, 'ShadowDecisionId'>;
export type PaperStrategyRunId = Brand<string, 'PaperStrategyRunId'>;
export type StrategyPromotionReviewId = Brand<string, 'StrategyPromotionReviewId'>;
export type StrategyCapsuleId = Brand<string, 'StrategyCapsuleId'>;
export type QualificationPolicyId = Brand<string, 'QualificationPolicyId'>;
export type EvaluationQualificationId = Brand<string, 'EvaluationQualificationId'>;
export type PromotionDecisionId = Brand<string, 'PromotionDecisionId'>;
export type ForwardShadowRunId = Brand<string, 'ForwardShadowRunId'>;
export type ForwardShadowDecisionId = Brand<string, 'ForwardShadowDecisionId'>;

function asPrefixed<T extends string>(value: string, prefix: string, label: string): Brand<string, T> {
  if (!value.startsWith(prefix) || value.length <= prefix.length) {
    throw new TypeError(`${label} must start with ${prefix}`);
  }
  return brandAs<string, T>(value);
}

function asNonEmpty<T extends string>(value: string, label: string): Brand<string, T> {
  if (value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return brandAs<string, T>(value);
}

export function asStrategyId(value: string): StrategyId {
  return asPrefixed(value, 'str_', 'StrategyId');
}

export function asStrategyVersion(value: string): StrategyVersion {
  return asNonEmpty(value, 'StrategyVersion');
}

export function asStrategySpecificationId(value: string): StrategySpecificationId {
  return asPrefixed(value, 'ssp_', 'StrategySpecificationId');
}

export function asStrategyCompilerVersion(value: string): StrategyCompilerVersion {
  return asNonEmpty(value, 'StrategyCompilerVersion');
}

export function asMarketDatasetId(value: string): MarketDatasetId {
  return asPrefixed(value, 'mds_', 'MarketDatasetId');
}

export function asMarketDatasetVersion(value: string): MarketDatasetVersion {
  return asNonEmpty(value, 'MarketDatasetVersion');
}

export function asExperimentId(value: string): ExperimentId {
  return asPrefixed(value, 'exp_', 'ExperimentId');
}

export function asParameterSetId(value: string): ParameterSetId {
  return asPrefixed(value, 'par_', 'ParameterSetId');
}

export function asBacktestRunId(value: string): BacktestRunId {
  return asPrefixed(value, 'btr_', 'BacktestRunId');
}

export function asWalkForwardRunId(value: string): WalkForwardRunId {
  return asPrefixed(value, 'wfr_', 'WalkForwardRunId');
}

export function asStrategyValidationId(value: string): StrategyValidationId {
  return asPrefixed(value, 'svl_', 'StrategyValidationId');
}

export function asShadowRunId(value: string): ShadowRunId {
  return asPrefixed(value, 'shd_', 'ShadowRunId');
}

export function asShadowDecisionId(value: string): ShadowDecisionId {
  return asPrefixed(value, 'sdec_', 'ShadowDecisionId');
}

export function asPaperStrategyRunId(value: string): PaperStrategyRunId {
  return asPrefixed(value, 'psr_', 'PaperStrategyRunId');
}

export function asStrategyPromotionReviewId(value: string): StrategyPromotionReviewId {
  return asPrefixed(value, 'spr_', 'StrategyPromotionReviewId');
}

export function asStrategyCapsuleId(value: string): StrategyCapsuleId {
  return asPrefixed(value, 'scap_', 'StrategyCapsuleId');
}

export function asQualificationPolicyId(value: string): QualificationPolicyId {
  return asPrefixed(value, 'qpol_', 'QualificationPolicyId');
}

export function asEvaluationQualificationId(value: string): EvaluationQualificationId {
  return asPrefixed(value, 'eqf_', 'EvaluationQualificationId');
}

export function asPromotionDecisionId(value: string): PromotionDecisionId {
  return asPrefixed(value, 'pdec_', 'PromotionDecisionId');
}

export function asForwardShadowRunId(value: string): ForwardShadowRunId {
  return asPrefixed(value, 'fshd_', 'ForwardShadowRunId');
}

export function asForwardShadowDecisionId(value: string): ForwardShadowDecisionId {
  return asPrefixed(value, 'fsdec_', 'ForwardShadowDecisionId');
}
