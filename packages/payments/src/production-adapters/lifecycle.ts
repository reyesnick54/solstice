/**
 * Provider adapter lifecycle. Production entry stays closed without
 * certification, credentials, webhook verification, and explicit
 * authorization that this repository does not grant.
 */

import {
  FINANCIAL_ADAPTER_FLAGS,
  PRODUCTION_ENTRY_STATES,
  type ProviderLifecycleState,
} from './types.ts';

export const LIFECYCLE_TRANSITIONS: Readonly<Record<ProviderLifecycleState, readonly ProviderLifecycleState[]>> = {
  SIMULATED: ['SANDBOX'],
  SANDBOX: ['CERTIFICATION', 'SIMULATED'],
  CERTIFICATION: ['PREPRODUCTION', 'SANDBOX'],
  PREPRODUCTION: ['LIMITED_LIVE', 'CERTIFICATION'],
  LIMITED_LIVE: ['PRODUCTION', 'PREPRODUCTION'],
  PRODUCTION: ['LIMITED_LIVE'],
};

export type LifecycleAdvanceRequest = {
  readonly from: ProviderLifecycleState;
  readonly to: ProviderLifecycleState;
  readonly certified: boolean;
  readonly credentialBound: boolean;
  readonly webhookVerificationConfigured: boolean;
  readonly productionAuthorized: boolean;
};

export type LifecycleDecision =
  | { readonly ok: true; readonly state: ProviderLifecycleState }
  | { readonly ok: false; readonly code: string; readonly message: string };

export function canEnterProductionLifecycle(state: ProviderLifecycleState): boolean {
  return (PRODUCTION_ENTRY_STATES as readonly string[]).includes(state);
}

export function advanceProviderLifecycle(request: LifecycleAdvanceRequest): LifecycleDecision {
  const allowed = LIFECYCLE_TRANSITIONS[request.from];
  if (!allowed.includes(request.to)) {
    return { ok: false, code: 'ILLEGAL_LIFECYCLE_TRANSITION', message: `${request.from} cannot advance to ${request.to}` };
  }
  if (canEnterProductionLifecycle(request.to)) {
    if (!request.certified) {
      return { ok: false, code: 'UNCERTIFIED_ADAPTER', message: 'uncertified adapter cannot enter production lifecycle' };
    }
    if (!request.credentialBound) {
      return { ok: false, code: 'MISSING_CREDENTIAL_REFERENCE', message: 'missing credential reference fails closed' };
    }
    if (!request.webhookVerificationConfigured) {
      return { ok: false, code: 'WEBHOOK_VERIFICATION_REQUIRED', message: 'production lifecycle requires webhook verification' };
    }
    if (!request.productionAuthorized || FINANCIAL_ADAPTER_FLAGS.productionAuthorized !== false) {
      return {
        ok: false,
        code: 'PRODUCTION_AUTHORIZATION_REQUIRED',
        message: 'production authorization is not granted in this repository',
      };
    }
    return {
      ok: false,
      code: 'PRODUCTION_AUTHORIZATION_REQUIRED',
      message: 'production authorization is not granted in this repository',
    };
  }
  if (request.to === 'PREPRODUCTION' && !request.certified) {
    return { ok: false, code: 'UNCERTIFIED_ADAPTER', message: 'preproduction requires a passed certification suite' };
  }
  return { ok: true, state: request.to };
}
