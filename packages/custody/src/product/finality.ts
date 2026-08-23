/**
 * Client-safe confirmation / finality.
 * Native assets use SunRey Chain BFT semantics.
 * External assets use normalized provider confirmations.
 */

import type { NativeChainFinality } from '../taxonomy.ts';
import type { ClientFinalityState } from './taxonomy.ts';

export function mapNativeFinality(input: {
  readonly native?: NativeChainFinality;
  readonly confirmations: number;
  readonly failed?: boolean;
  readonly review?: boolean;
}): ClientFinalityState {
  if (input.failed === true) {
    return 'FAILED';
  }
  if (input.review === true) {
    return 'REVIEW';
  }
  if (input.native === 'BFT_FINALIZED') {
    return 'FINALIZED';
  }
  if (input.native === 'MEMPOOL') {
    return input.confirmations > 0 ? 'CONFIRMING' : 'BROADCAST';
  }
  if (input.native === 'PENDING_PROPOSAL') {
    return 'PENDING';
  }
  if (input.confirmations >= 1) {
    return 'FINALIZED';
  }
  return 'PENDING';
}

export function mapExternalFinality(input: {
  readonly confirmations: number;
  readonly requiredConfirmations: number;
  readonly broadcast: boolean;
  readonly failed?: boolean;
  readonly review?: boolean;
}): ClientFinalityState {
  if (input.failed === true) {
    return 'FAILED';
  }
  if (input.review === true) {
    return 'REVIEW';
  }
  if (input.confirmations >= input.requiredConfirmations && input.requiredConfirmations > 0) {
    return 'FINALIZED';
  }
  if (input.confirmations > 0) {
    return 'CONFIRMING';
  }
  if (input.broadcast) {
    return 'BROADCAST';
  }
  return 'PENDING';
}

export function depositIsFinal(state: ClientFinalityState): boolean {
  return state === 'FINALIZED';
}
