import type { UtcInstant } from './time.ts';

export const MODEL_PURPOSES = [
  'TRADING',
  'AML',
  'FRAUD',
  'PERSONALIZATION',
  'DATA_VALUATION',
  'RECOMMENDATION',
] as const;
export type ModelPurpose = (typeof MODEL_PURPOSES)[number];

export const MODEL_RISK_CLASSES = ['LOW', 'MODERATE', 'HIGH'] as const;
export type ModelRiskClass = (typeof MODEL_RISK_CLASSES)[number];

export const VALIDATION_STATES = ['DRAFT', 'VALIDATING', 'RELEASED', 'RETIRED'] as const;
export type ValidationState = (typeof VALIDATION_STATES)[number];

export const RELEASE_STATES = ['UNRELEASED', 'RELEASED', 'WITHDRAWN'] as const;
export type ReleaseState = (typeof RELEASE_STATES)[number];

export const DEPLOYMENT_STATES = ['NOT_DEPLOYED', 'SHADOW', 'PAPER', 'DISABLED'] as const;
export type DeploymentState = (typeof DEPLOYMENT_STATES)[number];

export const MONITORING_STATES = ['UNMONITORED', 'ACTIVE', 'PAUSED'] as const;
export type MonitoringState = (typeof MONITORING_STATES)[number];

export type ModelApprovalSignature = {
  readonly signer: string;
  readonly signedAt: UtcInstant;
  readonly role: 'MODEL_OWNER' | 'RISK' | 'COMPLIANCE';
};

export type ModelRecord = {
  readonly modelId: string;
  readonly version: string;
  readonly owner: string;
  readonly purpose: ModelPurpose;
  readonly riskClass: ModelRiskClass;
  readonly trainingDataReference: string;
  readonly features: readonly string[];
  readonly approvedJurisdictions: readonly string[];
  readonly approvedProducts: readonly string[];
  readonly validationState: ValidationState;
  readonly releaseState: ReleaseState;
  readonly deploymentState: DeploymentState;
  readonly monitoringState: MonitoringState;
  readonly limitations: readonly string[];
  readonly killSwitchState: 'ENGAGED' | 'CLEAR';
  readonly approvalSignatures: readonly ModelApprovalSignature[];
  readonly lastReview: UtcInstant;
};

/**
 * Only a RELEASED validation state may receive allocation.
 * This is a distinct type, not a boolean flag on ModelRecord.
 */
export type ReleasedModel = ModelRecord & {
  readonly validationState: 'RELEASED';
  readonly releaseState: 'RELEASED';
};

export type AllocationRefusal = {
  readonly ok: false;
  readonly code: 'MODEL_NOT_RELEASED';
  readonly modelId: string;
  readonly validationState: ValidationState;
};

export type AllocationGrant = {
  readonly ok: true;
  readonly model: ReleasedModel;
  readonly weightNumerator: bigint;
  readonly weightDenominator: bigint;
};

export function isReleasedModel(model: ModelRecord): model is ReleasedModel {
  return model.validationState === 'RELEASED' && model.releaseState === 'RELEASED';
}
