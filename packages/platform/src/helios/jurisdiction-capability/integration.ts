import type { EnvelopeEvaluationContext } from '../decision-validity/types.ts';
import type { HeliosJurisdictionCapabilityResult } from './types.ts';

export function jurisdictionEnabledFromCapabilityResult(result: HeliosJurisdictionCapabilityResult): boolean {
  return result.outcome === 'ALLOWED';
}

export function resolveEnvelopeJurisdictionCapability(
  ctx: EnvelopeEvaluationContext,
  capabilityResult?: HeliosJurisdictionCapabilityResult | null,
): boolean {
  if (capabilityResult) {
    return jurisdictionEnabledFromCapabilityResult(capabilityResult);
  }
  return ctx.jurisdictionCapabilityEnabled;
}

export type HeliosCapabilityGateAction =
  | 'HELIOS_WORK_ORDER_ACTIVATION'
  | 'HELIOS_STRATEGY_ACTIVATION'
  | 'HELIOS_PROPOSAL'
  | 'PROVIDER_PROVISIONING'
  | 'ORDER_SUBMISSION'
  | 'WITHDRAWAL'
  | 'DATA_MODEL_USE';

export const HELIOS_GATE_ACTION_MAP = Object.freeze({
  HELIOS_WORK_ORDER_ACTIVATION: 'HELIOS_WORK_ORDER_ACTIVATION',
  HELIOS_STRATEGY_ACTIVATION: 'HELIOS_STRATEGY_ACTIVATION',
  HELIOS_PROPOSAL: 'HELIOS_PROPOSAL',
  PROVIDER_PROVISIONING: 'PROVIDER_PROVISIONING',
  ORDER_SUBMISSION: 'ORDER_SUBMISSION',
  WITHDRAWAL: 'WITHDRAWAL',
  DATA_MODEL_USE: 'DATA_MODEL_USE',
} as const satisfies Record<HeliosCapabilityGateAction, string>);
