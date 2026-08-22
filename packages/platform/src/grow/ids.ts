import { type Brand, brandAs } from '../../domain/src/brand.ts';

export type FinancialProposalId = Brand<string, 'FinancialProposalId'>;
export type FinancialProposalVersion = Brand<number, 'FinancialProposalVersion'>;
export type GrowApprovalId = Brand<string, 'GrowApprovalId'>;
export type GrowExecutionCommandId = Brand<string, 'GrowExecutionCommandId'>;
export type GrowExecutionId = Brand<string, 'GrowExecutionId'>;
export type RecurringMandateId = Brand<string, 'RecurringMandateId'>;
export type GrowMonitoringCycleId = Brand<string, 'GrowMonitoringCycleId'>;
export type ActivatedPlanId = Brand<string, 'ActivatedPlanId'>;
export type PlanComponentId = Brand<string, 'PlanComponentId'>;

const PREFIX = {
  FinancialProposalId: 'fpr_',
  GrowApprovalId: 'gap_',
  GrowExecutionCommandId: 'gxc_',
  GrowExecutionId: 'gxe_',
  RecurringMandateId: 'grm_',
  GrowMonitoringCycleId: 'gmc_',
  ActivatedPlanId: 'gapl_',
  PlanComponentId: 'gpc_',
} as const;

function brandPrefixed<Name extends keyof typeof PREFIX>(value: string, name: Name): Brand<string, Name> {
  if (value.length === 0 || !value.startsWith(PREFIX[name])) {
    throw new TypeError(`${name} must start with ${PREFIX[name]}`);
  }
  return brandAs<string, Name>(value);
}

export function asFinancialProposalId(value: string): FinancialProposalId {
  return brandPrefixed(value, 'FinancialProposalId');
}

export function asGrowApprovalId(value: string): GrowApprovalId {
  return brandPrefixed(value, 'GrowApprovalId');
}

export function asGrowExecutionCommandId(value: string): GrowExecutionCommandId {
  return brandPrefixed(value, 'GrowExecutionCommandId');
}

export function asGrowExecutionId(value: string): GrowExecutionId {
  return brandPrefixed(value, 'GrowExecutionId');
}

export function asRecurringMandateId(value: string): RecurringMandateId {
  return brandPrefixed(value, 'RecurringMandateId');
}

export function asGrowMonitoringCycleId(value: string): GrowMonitoringCycleId {
  return brandPrefixed(value, 'GrowMonitoringCycleId');
}

export function asActivatedPlanId(value: string): ActivatedPlanId {
  return brandPrefixed(value, 'ActivatedPlanId');
}

export function asPlanComponentId(value: string): PlanComponentId {
  return brandPrefixed(value, 'PlanComponentId');
}

export function asFinancialProposalVersion(value: number): FinancialProposalVersion {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError('FinancialProposalVersion must be a positive integer');
  }
  return brandAs<number, 'FinancialProposalVersion'>(value);
}

export function proposalIdFor(planId: string, actionId: string, version: number): FinancialProposalId {
  const compact = `${planId}_${actionId}_v${String(version)}`.replace(/[^a-zA-Z0-9_]/g, '_');
  return asFinancialProposalId(`fpr_${compact}`);
}

export function approvalIdFor(proposalId: string, version: number): GrowApprovalId {
  return asGrowApprovalId(`gap_${proposalId}_v${String(version)}`);
}

export function commandIdFor(proposalId: string, version: number, idempotencyKey: string): GrowExecutionCommandId {
  const compact = `${proposalId}_v${String(version)}_${idempotencyKey}`.replace(/[^a-zA-Z0-9_]/g, '_');
  return asGrowExecutionCommandId(`gxc_${compact}`);
}

export function executionIdFor(commandId: string): GrowExecutionId {
  return asGrowExecutionId(`gxe_${commandId.replace(/^gxc_/, '')}`);
}

export function recurringMandateIdFor(subjectId: string, key: string): RecurringMandateId {
  return asRecurringMandateId(`grm_${subjectId}_${key}`);
}

export function monitoringCycleIdFor(subjectId: string, at: string): GrowMonitoringCycleId {
  return asGrowMonitoringCycleId(`gmc_${subjectId}_${at.replace(/[:.]/g, '')}`);
}

export function activatedPlanIdFor(planId: string, version: number): ActivatedPlanId {
  return asActivatedPlanId(`gapl_${planId}_v${String(version)}`);
}

export function planComponentIdFor(planId: string, actionId: string): PlanComponentId {
  return asPlanComponentId(`gpc_${planId}_${actionId}`.replace(/[^a-zA-Z0-9_]/g, '_'));
}
