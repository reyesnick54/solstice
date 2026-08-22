/**
 * Structured capability negotiation. Domain services ask whether a
 * provider can perform a capability before execution.
 */

import {
  isProviderCapabilityId,
  type ProviderCapabilityId,
  type ProviderCategory,
  type ProviderRegistration,
} from './types.ts';

const CATEGORY_PREFIX: Readonly<Record<ProviderCategory, string>> = Object.freeze({
  BANKING: 'BANK.',
  PAYMENTS: 'PAYMENT.',
  FX: 'FX.',
  CARDS: 'CARD.',
  IDENTITY: 'IDENTITY.',
  KYC: 'KYC.',
  KYB: 'KYB.',
  AML: 'AML.',
  SANCTIONS: 'SANCTIONS.',
  FRAUD: 'FRAUD.',
  TRAVEL_RULE: 'TRAVEL_RULE.',
  CUSTODY: 'CUSTODY.',
  BLOCKCHAIN_ANALYTICS: 'BLOCKCHAIN_ANALYTICS.',
  MARKET_DATA: 'MARKET_DATA.',
  ORACLE: 'ORACLE.',
});

export function capabilityBelongsToCategory(
  capability: ProviderCapabilityId,
  category: ProviderCategory,
): boolean {
  return capability.startsWith(CATEGORY_PREFIX[category]);
}

export function validateDeclaredCapabilities(
  category: ProviderCategory,
  capabilities: readonly string[],
): readonly ProviderCapabilityId[] | null {
  const validated: ProviderCapabilityId[] = [];
  for (const capability of capabilities) {
    if (!isProviderCapabilityId(capability)) {
      return null;
    }
    if (!capabilityBelongsToCategory(capability, category)) {
      return null;
    }
    validated.push(capability);
  }
  return Object.freeze(validated);
}

export function canPerform(
  registration: ProviderRegistration | null,
  capability: ProviderCapabilityId,
): boolean {
  if (!registration) {
    return false;
  }
  if (registration.lifecycleState === 'DISABLED' || registration.lifecycleState === 'SUSPENDED') {
    return false;
  }
  return registration.capabilities.includes(capability);
}
