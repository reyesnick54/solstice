import { LIVE_BANKING_RAILS, LIVE_PAYMENTS_ENABLED } from '../../../config/src/flags.ts';
import type { ProviderCandidateState } from './types.ts';
import { PRODUCTION_CANDIDATE_FLAGS } from './types.ts';

export function candidateIsRoutable(state: ProviderCandidateState): boolean {
  return state === 'SANDBOX_READY' || state === 'ENGINEERING_TESTED';
}

export function productionAuthorizedAlwaysFalse(): false {
  return PRODUCTION_CANDIDATE_FLAGS.productionAuthorized;
}

export function liveRailsRemainDisabled(): boolean {
  return LIVE_PAYMENTS_ENABLED === false && LIVE_BANKING_RAILS === false;
}

export function freezeCandidate<T extends object>(value: T): T {
  return Object.freeze(value);
}
