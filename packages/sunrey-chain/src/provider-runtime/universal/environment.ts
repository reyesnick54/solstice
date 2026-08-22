/**
 * Provider environment isolation. Sandbox credentials never satisfy
 * production selection. Cross-environment webhook use is refused.
 */

import {
  universalErr,
  universalOk,
  type ProviderCredentialRef,
  type ProviderEnvironment,
  type ProviderRegistration,
  type ProviderWebhookConfiguration,
  type UniversalResult,
} from './types.ts';

const PRODUCTION_ELIGIBLE_ENVIRONMENTS = new Set<ProviderEnvironment>(['PRODUCTION']);

export function environmentsCompatible(
  configured: ProviderEnvironment,
  requested: ProviderEnvironment,
): boolean {
  if (requested === 'PRODUCTION') {
    return configured === 'PRODUCTION';
  }
  if (requested === 'PREPRODUCTION') {
    return configured === 'PREPRODUCTION' || configured === 'STAGING';
  }
  if (requested === 'STAGING') {
    return configured === 'STAGING' || configured === 'TEST';
  }
  if (requested === 'SANDBOX') {
    return configured === 'SANDBOX' || configured === 'TEST' || configured === 'LOCAL';
  }
  if (requested === 'TEST') {
    return configured === 'TEST' || configured === 'LOCAL';
  }
  return configured === 'LOCAL' || configured === 'TEST';
}

export function assertEnvironmentIsolation(
  registration: ProviderRegistration,
  requested: ProviderEnvironment,
): UniversalResult<true> {
  if (requested === 'PRODUCTION' && registration.environment !== 'PRODUCTION') {
    return universalErr(
      'PROVIDER_ENVIRONMENT_MISMATCH',
      'production provider selection fails when only non-production configuration exists',
      { providerId: registration.providerId },
    );
  }
  if (!environmentsCompatible(registration.environment, requested)) {
    return universalErr(
      'PROVIDER_ENVIRONMENT_MISMATCH',
      `${registration.environment} configuration cannot be used as ${requested}`,
      { providerId: registration.providerId },
    );
  }
  return universalOk(true);
}

export function assertCredentialEnvironment(
  credential: ProviderCredentialRef,
  requested: ProviderEnvironment,
): UniversalResult<true> {
  if (requested === 'PRODUCTION' && credential.environment !== 'PRODUCTION') {
    return universalErr(
      'PROVIDER_ENVIRONMENT_MISMATCH',
      'sandbox credentials must never be treated as production credentials',
      { providerId: credential.providerId },
    );
  }
  if (!environmentsCompatible(credential.environment, requested)) {
    return universalErr(
      'PROVIDER_ENVIRONMENT_MISMATCH',
      `credential environment ${credential.environment} cannot serve ${requested}`,
      { providerId: credential.providerId },
    );
  }
  return universalOk(true);
}

export function assertWebhookEnvironment(
  webhook: ProviderWebhookConfiguration,
  requested: ProviderEnvironment,
): UniversalResult<true> {
  if (webhook.environment !== requested) {
    return universalErr(
      'PROVIDER_ENVIRONMENT_MISMATCH',
      'cross-environment webhook configuration is forbidden',
    );
  }
  return universalOk(true);
}

export function isProductionEnvironment(environment: ProviderEnvironment): boolean {
  return PRODUCTION_ELIGIBLE_ENVIRONMENTS.has(environment);
}
