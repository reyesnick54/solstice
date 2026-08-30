/**
 * Provider enablement policy.
 *
 * Catalog presence does not imply runtime activation. Activation considers
 * verification status, launch tier, commercial-use status, environment,
 * explicit feature flags, and credential availability.
 */

import { ENVIRONMENT } from '../../config/src/flags.ts';
import type { CatalogProviderEntry } from './catalog/types.ts';
import type {
  ProviderActivationMode,
  ProviderConfiguration,
  ProviderDescriptor,
  SecretReferenceName,
} from './types.ts';

export type ActivationEvaluationInput = {
  readonly catalogEntry: CatalogProviderEntry;
  readonly configuration: ProviderConfiguration | null;
  readonly requestedMode: ProviderActivationMode;
  readonly environment?: string;
  readonly credentialAvailable?: boolean;
  readonly featureFlagEnabled?: boolean;
};

export type ActivationEvaluation = {
  readonly providerId: string;
  readonly requestedMode: ProviderActivationMode;
  readonly effectiveMode: ProviderActivationMode;
  readonly allowed: boolean;
  readonly reasons: readonly string[];
};

const BLOCKED_LAUNCH_TIERS = new Set(['blocked_pending_review']);
const COMMERCIAL_BLOCKERS = new Set(['noncommercial_only', 'requires_legal_review']);
const VERIFICATION_BLOCKERS = new Set(['deprecated', 'unavailable']);

export class ProviderActivationPolicy {
  evaluate(input: ActivationEvaluationInput): ActivationEvaluation {
    const reasons: string[] = [];
    const environment = input.environment ?? ENVIRONMENT;
    const { catalogEntry } = input;

    if (input.requestedMode === 'blocked') {
      return this.result(input, 'blocked', false, ['explicitly_blocked']);
    }

    if (BLOCKED_LAUNCH_TIERS.has(catalogEntry.sunrey.launch_tier)) {
      return this.result(input, 'blocked', false, ['launch_tier_blocked']);
    }

    if (VERIFICATION_BLOCKERS.has(catalogEntry.verification.status)) {
      return this.result(input, 'blocked', false, [`verification_${catalogEntry.verification.status}`]);
    }

    if (COMMERCIAL_BLOCKERS.has(catalogEntry.commercial_use.status)) {
      reasons.push(`commercial_use_${catalogEntry.commercial_use.status}`);
    }

    if (catalogEntry.authentication.required) {
      const credentialAvailable = input.credentialAvailable ?? this.credentialConfigured(input.configuration);
      if (!credentialAvailable) {
        reasons.push('required_credential_unavailable');
      }
    }

    if (input.featureFlagEnabled === false) {
      reasons.push('feature_flag_disabled');
    }

    if (environment === 'simulation' && input.requestedMode === 'production_enabled') {
      reasons.push('simulation_environment');
    }

    if (input.requestedMode === 'production_enabled') {
      if (catalogEntry.sunrey.launch_tier !== 'production_candidate') {
        reasons.push('not_production_candidate');
      }
      if (catalogEntry.verification.status !== 'verified') {
        reasons.push('verification_not_verified');
      }
      if (catalogEntry.commercial_use.status !== 'verified_allowed') {
        reasons.push('commercial_use_not_verified');
      }
      if (environment === 'simulation') {
        return this.result(input, 'preview_only', false, [...reasons, 'production_forbidden_in_simulation']);
      }
    }

    if (reasons.length > 0 && input.requestedMode === 'production_enabled') {
      return this.result(input, 'preview_only', false, reasons);
    }

    if (reasons.length > 0 && input.requestedMode === 'enabled') {
      return this.result(input, 'preview_only', false, reasons);
    }

    if (input.requestedMode === 'disabled') {
      return this.result(input, 'disabled', true, ['explicitly_disabled']);
    }

    return this.result(input, input.requestedMode, true, reasons.length > 0 ? reasons : ['policy_allowed']);
  }

  resolveDescriptorActivation(
    catalogEntry: CatalogProviderEntry,
    configuration: ProviderConfiguration | null,
    requestedMode: ProviderActivationMode = 'preview_only',
  ): ProviderActivationMode {
    return this.evaluate({
      catalogEntry,
      configuration,
      requestedMode,
    }).effectiveMode;
  }

  private credentialConfigured(configuration: ProviderConfiguration | null): boolean {
    if (!configuration?.secretReference) {
      return false;
    }
    const envName = configuration.secretReference.environmentVariable;
    const value = process.env[envName];
    return typeof value === 'string' && value.length > 0;
  }

  private result(
    input: ActivationEvaluationInput,
    effectiveMode: ProviderActivationMode,
    allowed: boolean,
    reasons: readonly string[],
  ): ActivationEvaluation {
    return Object.freeze({
      providerId: input.catalogEntry.provider_id,
      requestedMode: input.requestedMode,
      effectiveMode,
      allowed,
      reasons: Object.freeze([...reasons]),
    });
  }
}

export function descriptorAllowsRuntime(descriptor: ProviderDescriptor): boolean {
  return descriptor.activationMode !== 'disabled' && descriptor.activationMode !== 'blocked';
}

export function sanitizeDescriptorForExposure(descriptor: ProviderDescriptor): ProviderDescriptor {
  return Object.freeze({
    ...descriptor,
    secretReference: descriptor.secretReference
      ? Object.freeze({
          environmentVariable: descriptor.secretReference.environmentVariable,
          resolved: false as const,
        } satisfies SecretReferenceName)
      : null,
  });
}

export function createProviderActivationPolicy(): ProviderActivationPolicy {
  return new ProviderActivationPolicy();
}
