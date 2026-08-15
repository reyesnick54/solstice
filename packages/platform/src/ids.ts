import { type Brand, brandAs } from '../../domain/src/brand.ts';

export type EconomicMandateId = Brand<string, 'EconomicMandateId'>;
export type MandateVersion = Brand<number, 'MandateVersion'>;
export type MandateConstraintId = Brand<string, 'MandateConstraintId'>;
export type MandateGoalId = Brand<string, 'MandateGoalId'>;
export type GrowthPlanId = Brand<string, 'GrowthPlanId'>;
export type GrowthPlanVersion = Brand<number, 'GrowthPlanVersion'>;
export type GrowthActionId = Brand<string, 'GrowthActionId'>;
export type GrowthCycleId = Brand<string, 'GrowthCycleId'>;
export type MandateDraftId = Brand<string, 'MandateDraftId'>;
export type MandateConfirmationId = Brand<string, 'MandateConfirmationId'>;

const PREFIX = {
  EconomicMandateId: 'emd_',
  MandateConstraintId: 'emc_',
  MandateGoalId: 'emg_',
  GrowthPlanId: 'gpl_',
  GrowthActionId: 'gac_',
  GrowthCycleId: 'gcy_',
  MandateDraftId: 'emdft_',
  MandateConfirmationId: 'emcf_',
} as const;

function brandPrefixed<Name extends keyof typeof PREFIX>(value: string, name: Name): Brand<string, Name> {
  if (value.length === 0 || !value.startsWith(PREFIX[name])) {
    throw new TypeError(`${name} must start with ${PREFIX[name]}`);
  }
  return brandAs<string, Name>(value);
}

export function asEconomicMandateId(value: string): EconomicMandateId {
  return brandPrefixed(value, 'EconomicMandateId');
}

export function asMandateConstraintId(value: string): MandateConstraintId {
  return brandPrefixed(value, 'MandateConstraintId');
}

export function asMandateGoalId(value: string): MandateGoalId {
  return brandPrefixed(value, 'MandateGoalId');
}

export function asGrowthPlanId(value: string): GrowthPlanId {
  return brandPrefixed(value, 'GrowthPlanId');
}

export function asGrowthActionId(value: string): GrowthActionId {
  return brandPrefixed(value, 'GrowthActionId');
}

export function asGrowthCycleId(value: string): GrowthCycleId {
  return brandPrefixed(value, 'GrowthCycleId');
}

export function asMandateDraftId(value: string): MandateDraftId {
  return brandPrefixed(value, 'MandateDraftId');
}

export function asMandateConfirmationId(value: string): MandateConfirmationId {
  return brandPrefixed(value, 'MandateConfirmationId');
}

export function asMandateVersion(value: number): MandateVersion {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError('MandateVersion must be a positive integer');
  }
  return brandAs<number, 'MandateVersion'>(value);
}

export function asGrowthPlanVersion(value: number): GrowthPlanVersion {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError('GrowthPlanVersion must be a positive integer');
  }
  return brandAs<number, 'GrowthPlanVersion'>(value);
}

export function mandateIdForSubject(subjectId: string): EconomicMandateId {
  return asEconomicMandateId(`emd_${subjectId}`);
}

export function draftIdForSubject(subjectId: string, version: number): MandateDraftId {
  return asMandateDraftId(`emdft_${subjectId}_v${String(version)}`);
}

export function goalIdFor(kind: string, key: string): MandateGoalId {
  return asMandateGoalId(`emg_${kind.toLowerCase()}_${key}`);
}

export function constraintIdFor(kind: string, key: string): MandateConstraintId {
  return asMandateConstraintId(`emc_${kind.toLowerCase()}_${key}`);
}

export function cycleIdFor(subjectId: string, generatedAt: string): GrowthCycleId {
  return asGrowthCycleId(`gcy_${subjectId}_${generatedAt.replace(/[:.]/g, '')}`);
}

export function planIdFor(cycleId: string): GrowthPlanId {
  return asGrowthPlanId(`gpl_${cycleId.replace(/^gcy_/, '')}`);
}

export function actionIdFor(kind: string, key: string): GrowthActionId {
  return asGrowthActionId(`gac_${kind.toLowerCase()}_${key}`);
}

export function confirmationIdFor(mandateId: string, version: number): MandateConfirmationId {
  return asMandateConfirmationId(`emcf_${mandateId}_v${String(version)}`);
}
