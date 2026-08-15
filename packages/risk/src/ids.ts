import { type Brand, brandAs } from '../../domain/src/brand.ts';

export type RiskAssessmentId = Brand<string, 'RiskAssessmentId'>;
export type PortfolioRiskSnapshotId = Brand<string, 'PortfolioRiskSnapshotId'>;
export type PreTradeRiskDecisionId = Brand<string, 'PreTradeRiskDecisionId'>;
export type RiskLimitId = Brand<string, 'RiskLimitId'>;
export type RiskBudgetId = Brand<string, 'RiskBudgetId'>;
export type StressScenarioId = Brand<string, 'StressScenarioId'>;
export type StressRunId = Brand<string, 'StressRunId'>;
export type RiskModelId = Brand<string, 'RiskModelId'>;
export type RiskModelVersion = Brand<string, 'RiskModelVersion'>;
export type RiskPolicyVersion = Brand<string, 'RiskPolicyVersion'>;

function asPrefixed<T extends string>(value: string, prefix: string, label: string): Brand<string, T> {
  if (!value.startsWith(prefix) || value.length <= prefix.length) {
    throw new TypeError(`${label} must start with ${prefix}`);
  }
  return brandAs<string, T>(value);
}

export function asRiskAssessmentId(value: string): RiskAssessmentId {
  return asPrefixed(value, 'ras_', 'RiskAssessmentId');
}

export function asPortfolioRiskSnapshotId(value: string): PortfolioRiskSnapshotId {
  return asPrefixed(value, 'prs_', 'PortfolioRiskSnapshotId');
}

export function asPreTradeRiskDecisionId(value: string): PreTradeRiskDecisionId {
  return asPrefixed(value, 'prd_', 'PreTradeRiskDecisionId');
}

export function asRiskLimitId(value: string): RiskLimitId {
  return asPrefixed(value, 'rlim_', 'RiskLimitId');
}

export function asRiskBudgetId(value: string): RiskBudgetId {
  return asPrefixed(value, 'rbdg_', 'RiskBudgetId');
}

export function asStressScenarioId(value: string): StressScenarioId {
  return asPrefixed(value, 'ssc_', 'StressScenarioId');
}

export function asStressRunId(value: string): StressRunId {
  return asPrefixed(value, 'srun_', 'StressRunId');
}

export function asRiskModelId(value: string): RiskModelId {
  return asPrefixed(value, 'mdl_', 'RiskModelId');
}

export function asRiskModelVersion(value: string): RiskModelVersion {
  if (value.length === 0) {
    throw new TypeError('RiskModelVersion is required');
  }
  return brandAs<string, 'RiskModelVersion'>(value);
}

export function asRiskPolicyVersion(value: string): RiskPolicyVersion {
  if (value.length === 0) {
    throw new TypeError('RiskPolicyVersion is required');
  }
  return brandAs<string, 'RiskPolicyVersion'>(value);
}
