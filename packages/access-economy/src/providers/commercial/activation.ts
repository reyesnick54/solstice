/**
 * Commercial Access provider activation policy.
 *
 * Production must not silently enable a sandbox provider. Reuses the
 * provider-sdk activation posture: catalog presence ≠ runtime activation.
 */

import type {
  AccessProviderCapability,
  CommercialAccessCapabilityId,
  CommercialProviderActivationState,
  CommercialProviderId,
} from './types.ts';

export type ActivationGateInput = {
  readonly providerId: CommercialProviderId;
  readonly activationState: CommercialProviderActivationState;
  readonly capabilityId: CommercialAccessCapabilityId;
  readonly credentialStatus: 'NONE' | 'CONFIGURED' | 'VALIDATED' | 'MISSING';
  readonly contractStatus: 'NONE' | 'PENDING' | 'SIGNED' | 'EXPIRED';
  readonly environment?: string;
};

export type ActivationGateResult = {
  readonly allowed: boolean;
  readonly effectiveState: CommercialProviderActivationState;
  readonly reasons: readonly string[];
};

const OPERATIONAL_STATES: ReadonlySet<CommercialProviderActivationState> = new Set([
  'SANDBOX',
  'PREVIEW',
  'PRODUCTION',
]);

const BLOCKED_STATES: ReadonlySet<CommercialProviderActivationState> = new Set([
  'BLOCKED_PENDING_CREDENTIALS',
  'BLOCKED_PENDING_CONTRACT',
  'BLOCKED_PENDING_COMPLIANCE',
  'DISABLED',
]);

const DEFAULT_ACCESS_ENVIRONMENT = 'simulation' as const;

export function evaluateCommercialActivation(input: ActivationGateInput): ActivationGateResult {
  const reasons: string[] = [];
  const environment = input.environment ?? DEFAULT_ACCESS_ENVIRONMENT;

  if (BLOCKED_STATES.has(input.activationState)) {
    return Object.freeze({
      allowed: false,
      effectiveState: input.activationState,
      reasons: Object.freeze([`activation_state_${input.activationState.toLowerCase()}`]),
    });
  }

  if (input.activationState === 'DISCOVERY_ONLY') {
    const discoveryOnly: ReadonlySet<CommercialAccessCapabilityId> = new Set(['SEARCH']);
    if (!discoveryOnly.has(input.capabilityId)) {
      reasons.push('discovery_only_capability_denied');
    }
    return Object.freeze({
      allowed: reasons.length === 0,
      effectiveState: 'DISCOVERY_ONLY',
      reasons: Object.freeze(reasons),
    });
  }

  if (input.activationState === 'PRODUCTION') {
    if (environment === 'simulation') {
      reasons.push('simulation_environment_blocks_production');
    }
    if (input.credentialStatus !== 'VALIDATED') {
      reasons.push('production_requires_validated_credentials');
    }
    if (input.contractStatus !== 'SIGNED') {
      reasons.push('production_requires_signed_contract');
    }
  }

  if (input.activationState === 'SANDBOX' || input.activationState === 'PREVIEW') {
    if (input.credentialStatus === 'MISSING' || input.credentialStatus === 'NONE') {
      reasons.push('sandbox_requires_configured_credentials');
    }
  }

  if (!OPERATIONAL_STATES.has(input.activationState) && input.activationState !== 'DISCOVERY_ONLY') {
    reasons.push('non_operational_activation_state');
  }

  return Object.freeze({
    allowed: reasons.length === 0,
    effectiveState: input.activationState,
    reasons: Object.freeze(reasons),
  });
}

export function isProductionEnabled(state: CommercialProviderActivationState): boolean {
  return state === 'PRODUCTION';
}

export function isSandboxOnly(state: CommercialProviderActivationState): boolean {
  return state === 'SANDBOX' || state === 'PREVIEW';
}

export function capabilitySupported(
  capabilities: readonly AccessProviderCapability[],
  capabilityId: CommercialAccessCapabilityId,
): boolean {
  const row = capabilities.find((candidate) => candidate.capabilityId === capabilityId);
  return row?.supported === true;
}
