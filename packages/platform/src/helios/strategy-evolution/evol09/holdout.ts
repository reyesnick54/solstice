/**
 * HELIOS EVOL09 — sealed holdout: evolutionary engine must not receive holdout feedback until freeze.
 */

import type { HoldoutRevealAfterFreeze, SealedHoldoutSegment, SealedHoldoutVault, SealedHoldoutVaultState } from './types.ts';

export function createSealedHoldoutVault(segment: SealedHoldoutSegment): SealedHoldoutVault {
  return Object.freeze({
    state: 'RESEARCH_ACTIVE',
    segment,
    unsealedHoldoutScore: null,
    unsealedHoldoutGradient: null,
    unsealedHoldoutRejectionReason: null,
  });
}

export function freezeResearchProgram(vault: SealedHoldoutVault): SealedHoldoutVault {
  if (vault.state === 'FROZEN') {
    return vault;
  }
  return Object.freeze({
    ...vault,
    state: 'FROZEN' as SealedHoldoutVaultState,
  });
}

/**
 * After freeze only: attach holdout outcomes for audit; evolution must not call this during search.
 */
export function unsealHoldoutAfterFreeze(
  vault: SealedHoldoutVault,
  reveal: HoldoutRevealAfterFreeze,
): SealedHoldoutVault {
  if (vault.state !== 'FROZEN') {
    throw new Error('EVOL09 holdout can only be unsealed after the research program is frozen');
  }
  return Object.freeze({
    ...vault,
    unsealedHoldoutScore: reveal.holdoutScore,
    unsealedHoldoutGradient: reveal.holdoutGradient === null ? null : Object.freeze([...reveal.holdoutGradient]),
    unsealedHoldoutRejectionReason: reveal.holdoutRejectionReason,
  });
}

/**
 * Strip any accidental holdout keys from engine-bound feedback (defense in depth).
 */
export function scrubHoldoutFromEnginePayload<T extends Record<string, unknown>>(payload: T): Omit<
  T,
  'holdoutScore' | 'holdoutGradient' | 'holdoutRejectionReason'
> {
  const {
    holdoutScore: _s,
    holdoutGradient: _g,
    holdoutRejectionReason: _r,
    ...rest
  } = payload as T & {
    holdoutScore?: unknown;
    holdoutGradient?: unknown;
    holdoutRejectionReason?: unknown;
  };
  return rest;
}
