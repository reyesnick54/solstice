/**
 * Provider feed entitlement metadata for capital market observations.
 */

import { ENVIRONMENT } from '../../../config/src/flags.ts';
import type { CapitalMarketEntitlement, CapitalMarketEntitlementClass, CapitalMarketFeedTier } from './types.ts';

export type CapitalMarketEntitlementInput = {
  readonly providerId: string;
  readonly providerDeclaredRealtime: boolean;
  readonly feedTier: CapitalMarketFeedTier;
  readonly delayedMinutes?: number | null;
};

export function resolveCapitalMarketEntitlement(input: CapitalMarketEntitlementInput): CapitalMarketEntitlement {
  const entitlementClass = classifyEntitlement(input);
  const licensedForRealtime =
    entitlementClass === 'realtime' && ENVIRONMENT === 'simulation' ? false : entitlementClass === 'realtime';

  return Object.freeze({
    entitlementClass,
    feedTier: ENVIRONMENT === 'simulation' ? 'sandbox' : input.feedTier,
    delayedMinutes: input.delayedMinutes ?? null,
    licensedForRealtime,
    providerDeclaredRealtime: input.providerDeclaredRealtime,
  });
}

function classifyEntitlement(input: CapitalMarketEntitlementInput): CapitalMarketEntitlementClass {
  if (ENVIRONMENT === 'simulation') {
    return input.providerDeclaredRealtime ? 'sandbox' : 'test';
  }
  if (input.delayedMinutes && input.delayedMinutes > 0) {
    return 'delayed';
  }
  if (input.providerDeclaredRealtime) {
    return 'realtime';
  }
  return 'unknown';
}

export function entitlementBlocksRealtimePresentation(entitlement: CapitalMarketEntitlement): boolean {
  return entitlement.entitlementClass !== 'realtime' || !entitlement.licensedForRealtime;
}
