/**
 * Server-side provider lifecycle. Casual API, agent, frontend, or env
 * transitions cannot move a provider into limited-live or production.
 */

import {
  ENVIRONMENT,
  LIVE_BANKING_RAILS,
  LIVE_EXTERNAL_BANK_CONNECTION,
  LIVE_EXTERNAL_KYC,
  LIVE_MONEY_ENABLED,
  LIVE_PAYMENTS_ENABLED,
  SIMULATION_MODE,
} from '../../../../config/src/flags.ts';
import {
  LIVE_CONNECTIVITY_ENABLED,
  PRODUCTION_ACTIVE,
  PRODUCTION_READY,
  production_authorized,
  universalErr,
  universalOk,
  type LifecycleTransitionRequest,
  type ProviderLifecycleState,
  type UniversalResult,
} from './types.ts';

export const LIFECYCLE_TRANSITIONS: {
  readonly [S in ProviderLifecycleState]: readonly ProviderLifecycleState[];
} = {
  DISABLED: ['SIMULATED', 'SUSPENDED'],
  SIMULATED: ['SANDBOX', 'SUSPENDED', 'DISABLED'],
  SANDBOX: ['CERTIFICATION', 'SIMULATED', 'SUSPENDED', 'DISABLED'],
  CERTIFICATION: ['PREPRODUCTION', 'SANDBOX', 'SUSPENDED', 'DISABLED'],
  PREPRODUCTION: ['LIMITED_LIVE', 'CERTIFICATION', 'SUSPENDED', 'DISABLED'],
  LIMITED_LIVE: ['PRODUCTION', 'PREPRODUCTION', 'SUSPENDED', 'DISABLED'],
  PRODUCTION: ['SUSPENDED', 'DISABLED'],
  SUSPENDED: ['SIMULATED', 'SANDBOX', 'DISABLED'],
};

const CASUAL_ACTORS = new Set(['API', 'AGENT', 'FRONTEND', 'ENVIRONMENT_VARIABLE']);

export function liveFlagsClosed(): boolean {
  return (
    ENVIRONMENT === 'simulation' ||
    SIMULATION_MODE === true ||
    LIVE_MONEY_ENABLED === false ||
    LIVE_PAYMENTS_ENABLED === false ||
    LIVE_BANKING_RAILS === false ||
    LIVE_EXTERNAL_KYC === false ||
    LIVE_EXTERNAL_BANK_CONNECTION === false ||
    PRODUCTION_READY === false ||
    PRODUCTION_ACTIVE === false ||
    LIVE_CONNECTIVITY_ENABLED === false ||
    production_authorized === false
  );
}

export function validateLifecycleTransition(
  from: ProviderLifecycleState,
  request: LifecycleTransitionRequest,
): UniversalResult<ProviderLifecycleState> {
  if (!LIFECYCLE_TRANSITIONS[from].includes(request.to)) {
    return universalErr(
      'PROVIDER_LIFECYCLE_FORBIDDEN',
      `${from} → ${request.to} is not a permitted transition`,
      { providerId: request.providerId },
    );
  }

  if (request.to === 'SANDBOX' && from === 'SIMULATED' && request.configurationComplete !== true) {
    return universalErr(
      'PROVIDER_CONFIGURATION_ERROR',
      'SIMULATED → SANDBOX requires completed configuration',
      { providerId: request.providerId },
    );
  }

  if (request.to === 'CERTIFICATION' && from === 'SANDBOX' && request.testSuiteReady !== true) {
    return universalErr(
      'PROVIDER_CERTIFICATION_INSUFFICIENT',
      'SANDBOX → CERTIFICATION requires test-suite readiness',
      { providerId: request.providerId },
    );
  }

  if (request.to === 'PREPRODUCTION' && from === 'CERTIFICATION') {
    if ((request.certificationEvidenceRefs ?? []).length === 0) {
      return universalErr(
        'PROVIDER_CERTIFICATION_INSUFFICIENT',
        'CERTIFICATION → PREPRODUCTION requires certification evidence',
        { providerId: request.providerId },
      );
    }
  }

  if (request.to === 'LIMITED_LIVE' || request.to === 'PRODUCTION') {
    if (CASUAL_ACTORS.has(request.actorKind)) {
      return universalErr(
        'PROVIDER_LIFECYCLE_FORBIDDEN',
        `${request.actorKind} cannot transition a provider to ${request.to}`,
        { providerId: request.providerId },
      );
    }
    if (request.to === 'LIMITED_LIVE') {
      if (!request.humanAuthorizationId || (request.externalGateRefs ?? []).length === 0) {
        return universalErr(
          'PROVIDER_LIFECYCLE_FORBIDDEN',
          'PREPRODUCTION → LIMITED_LIVE requires human authorization and external gates',
          { providerId: request.providerId },
        );
      }
    }
    if (request.to === 'PRODUCTION' && !request.productionAuthorizationId) {
      return universalErr(
        'PROVIDER_LIFECYCLE_FORBIDDEN',
        'LIMITED_LIVE → PRODUCTION requires explicit production authorization',
        { providerId: request.providerId },
      );
    }
    if (liveFlagsClosed()) {
      return universalErr(
        'PROVIDER_LIFECYCLE_FORBIDDEN',
        `${request.to} is forbidden while ENVIRONMENT=simulation and production flags remain false`,
        { providerId: request.providerId },
      );
    }
  }

  return universalOk(request.to);
}

export function lifecycleSufficientForSandbox(state: ProviderLifecycleState): boolean {
  return (
    state === 'SIMULATED' ||
    state === 'SANDBOX' ||
    state === 'CERTIFICATION' ||
    state === 'PREPRODUCTION'
  );
}
