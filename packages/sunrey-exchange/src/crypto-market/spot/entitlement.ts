/**
 * HELIOS M06 — crypto spot feed entitlement metadata.
 */

import type { CapitalMarketEntitlement } from '../../capital-market/types.ts';

export type CryptoSpotEntitlementInput = {
  readonly apiKeyConfigured: boolean;
  readonly providerDeclaredRealtime: boolean;
};

export function resolveCryptoSpotEntitlement(input: CryptoSpotEntitlementInput): CapitalMarketEntitlement {
  if (input.apiKeyConfigured) {
    return Object.freeze({
      entitlementClass: 'sandbox',
      feedTier: 'free_tier',
      delayedMinutes: null,
      licensedForRealtime: false,
      providerDeclaredRealtime: input.providerDeclaredRealtime,
    });
  }
  return Object.freeze({
    entitlementClass: 'indicative',
    feedTier: 'free_tier',
    delayedMinutes: null,
    licensedForRealtime: false,
    providerDeclaredRealtime: false,
  });
}

export function entitlementBlocksResearch(entitlement: CapitalMarketEntitlement): boolean {
  return entitlement.entitlementClass === 'unknown';
}
