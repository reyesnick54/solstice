import { type Brand, brandAs } from '../../../../domain/src/brand.ts';

export type GrowMoneyPlanId = Brand<string, 'GrowMoneyPlanId'>;
export type GrowMoneyPlanVersion = Brand<number, 'GrowMoneyPlanVersion'>;
export type GrowPlanComponentId = Brand<string, 'GrowPlanComponentId'>;
export type FinancialProposalId = Brand<string, 'FinancialProposalId'>;
export type FinancialProposalVersion = Brand<number, 'FinancialProposalVersion'>;
export type ScenarioRunId = Brand<string, 'ScenarioRunId'>;
export type AssumptionSetId = Brand<string, 'AssumptionSetId'>;
export type SuitabilitySnapshotId = Brand<string, 'SuitabilitySnapshotId'>;

const PREFIX = {
  GrowMoneyPlanId: 'gmp_',
  GrowPlanComponentId: 'gpc_',
  FinancialProposalId: 'fpr_',
  ScenarioRunId: 'scn_',
  AssumptionSetId: 'asm_',
  SuitabilitySnapshotId: 'sts_',
} as const;

function brandPrefixed<Name extends keyof typeof PREFIX>(value: string, name: Name): Brand<string, Name> {
  if (value.length === 0 || !value.startsWith(PREFIX[name])) {
    throw new TypeError(`${name} must start with ${PREFIX[name]}`);
  }
  return brandAs<string, Name>(value);
}

export function asGrowMoneyPlanId(value: string): GrowMoneyPlanId {
  return brandPrefixed(value, 'GrowMoneyPlanId');
}

export function asGrowPlanComponentId(value: string): GrowPlanComponentId {
  return brandPrefixed(value, 'GrowPlanComponentId');
}

export function asFinancialProposalId(value: string): FinancialProposalId {
  return brandPrefixed(value, 'FinancialProposalId');
}

export function asScenarioRunId(value: string): ScenarioRunId {
  return brandPrefixed(value, 'ScenarioRunId');
}

export function asAssumptionSetId(value: string): AssumptionSetId {
  return brandPrefixed(value, 'AssumptionSetId');
}

export function asSuitabilitySnapshotId(value: string): SuitabilitySnapshotId {
  return brandPrefixed(value, 'SuitabilitySnapshotId');
}

export function asGrowMoneyPlanVersion(value: number): GrowMoneyPlanVersion {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError('GrowMoneyPlanVersion must be a positive integer');
  }
  return brandAs<number, 'GrowMoneyPlanVersion'>(value);
}

export function asFinancialProposalVersion(value: number): FinancialProposalVersion {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError('FinancialProposalVersion must be a positive integer');
  }
  return brandAs<number, 'FinancialProposalVersion'>(value);
}

export function growMoneyPlanIdFor(ownerId: string, createdAt: string): GrowMoneyPlanId {
  return asGrowMoneyPlanId(`gmp_${ownerId}_${createdAt.replace(/[:.]/g, '')}`);
}

export function growPlanComponentIdFor(kind: string, key: string): GrowPlanComponentId {
  return asGrowPlanComponentId(`gpc_${kind.toLowerCase()}_${key}`);
}

export function financialProposalIdFor(planId: string, version: number, key: string): FinancialProposalId {
  return asFinancialProposalId(`fpr_${planId.replace(/^gmp_/, '')}_v${String(version)}_${key}`);
}

export function scenarioRunIdFor(planId: string, version: number): ScenarioRunId {
  return asScenarioRunId(`scn_${planId.replace(/^gmp_/, '')}_v${String(version)}`);
}

export function suitabilitySnapshotIdFor(proposalId: string): SuitabilitySnapshotId {
  return asSuitabilitySnapshotId(`sts_${proposalId.replace(/^fpr_/, '')}`);
}
