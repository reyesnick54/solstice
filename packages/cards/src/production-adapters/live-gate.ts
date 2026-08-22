/**
 * Card live-gate. Simulation processors cannot produce a production card.
 */

import { LIVE_MONEY_ENABLED, LIVE_PAYMENTS_ENABLED } from '../../../config/src/flags.ts';
import { CARD_ADAPTER_FLAGS, type CardProviderLifecycle } from './types.ts';

export type CardInvocationRequest = {
  readonly lifecycle: CardProviderLifecycle;
  readonly requestedAs: CardProviderLifecycle;
  readonly certified: boolean;
  readonly credentialBound: boolean;
};

export type CardInvocationDecision =
  | { readonly allowed: true; readonly productionCard: false }
  | { readonly allowed: false; readonly code: string; readonly message: string };

export function authorizeCardAdapterInvocation(request: CardInvocationRequest): CardInvocationDecision {
  if (LIVE_MONEY_ENABLED !== false || LIVE_PAYMENTS_ENABLED !== false) {
    return { allowed: false, code: 'LIVE_FLAGS_MUST_REMAIN_FALSE', message: 'live flags must remain false' };
  }
  if (CARD_ADAPTER_FLAGS.productionAuthorized !== false || CARD_ADAPTER_FLAGS.productionCardIssued !== false) {
    return { allowed: false, code: 'PRODUCTION_CARD_DISABLED', message: 'production card issuance remains disabled' };
  }
  if (request.requestedAs === 'PRODUCTION' && request.lifecycle !== 'PRODUCTION') {
    return {
      allowed: false,
      code: 'SIMULATION_CARD_NOT_PRODUCTION',
      message: 'simulation card provider cannot produce production card',
    };
  }
  if ((request.requestedAs === 'PRODUCTION' || request.requestedAs === 'LIMITED_LIVE') && !request.certified) {
    return { allowed: false, code: 'UNCERTIFIED_ADAPTER', message: 'uncertified adapter cannot enter production lifecycle' };
  }
  if (request.requestedAs === 'PRODUCTION' || request.requestedAs === 'LIMITED_LIVE') {
    return { allowed: false, code: 'PRODUCTION_AUTHORIZATION_REQUIRED', message: 'production card issuance is not authorized' };
  }
  if (!request.credentialBound && request.requestedAs !== 'SIMULATED') {
    return { allowed: false, code: 'MISSING_CREDENTIAL_REFERENCE', message: 'missing credential reference fails closed' };
  }
  return { allowed: true, productionCard: false };
}
