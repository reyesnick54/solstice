/**
 * Generic fallback hooks — no hard-coded provider relationships.
 */

import type { FallbackContext, FallbackDecision, FallbackHook } from './reliability-types.ts';

export const noFallback: FallbackHook = () => Object.freeze({ action: 'none' });

export function staleCacheFallback(reason = 'primary provider failed; stale cache permitted'): FallbackHook {
  return (context: FallbackContext): FallbackDecision => {
    if (!context.staleFallbackAllowed) {
      return Object.freeze({ action: 'none' });
    }
    return Object.freeze({ action: 'use_stale_cache', reason });
  };
}

export function chainFallbackHooks(...hooks: readonly FallbackHook[]): FallbackHook {
  return (context: FallbackContext): FallbackDecision => {
    for (const hook of hooks) {
      const decision = hook(context);
      if (decision.action !== 'none') {
        return decision;
      }
    }
    return Object.freeze({ action: 'none' });
  };
}

export function evaluateFallback(
  hook: FallbackHook | undefined,
  context: FallbackContext,
): FallbackDecision {
  if (!hook) {
    return Object.freeze({ action: 'none' });
  }
  return hook(context);
}

export function isFallbackEligible(context: FallbackContext): boolean {
  return (
    context.error.classification === 'provider_unavailable' ||
    context.error.classification === 'rate_limited' ||
    context.error.classification === 'retryable' ||
    context.circuitState === 'OPEN'
  );
}
