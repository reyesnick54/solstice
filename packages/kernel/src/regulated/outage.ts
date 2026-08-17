import type { DecisionStatus } from '../../../permissions/src/decision.ts';
import { outageToDecision, type OutagePosture } from '../compliance/types.ts';
import type { ProviderHealthState } from './providers.ts';

export type RequiredProviderOutageDecision = {
  readonly providerId: string;
  readonly health: ProviderHealthState;
  readonly required: boolean;
  readonly posture: OutagePosture;
  readonly actionUnavailable: boolean;
  readonly silentBypass: false;
  readonly kernelDecision: DecisionStatus;
  readonly reasonCodes: readonly string[];
};

export function evaluateRequiredProviderOutage(input: {
  readonly providerId: string;
  readonly health: ProviderHealthState;
  readonly required: boolean;
  readonly posture: OutagePosture;
}): RequiredProviderOutageDecision {
  const unavailable = input.health === 'UNAVAILABLE' || input.health === 'UNKNOWN';
  const actionUnavailable = input.required && unavailable;
  return Object.freeze({
    providerId: input.providerId,
    health: input.health,
    required: input.required,
    posture: input.posture,
    actionUnavailable,
    silentBypass: false,
    kernelDecision: actionUnavailable ? outageToDecision(input.posture) : 'ALLOW',
    reasonCodes: Object.freeze(
      actionUnavailable ? ['REQUIRED_PROVIDER_UNAVAILABLE', `POSTURE_${input.posture}`] : ['PROVIDER_AVAILABLE'],
    ),
  });
}
