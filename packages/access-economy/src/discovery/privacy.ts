/**
 * ACCESS Wave 2 Prompt 31 — privacy-safe discovery request shaping.
 */

import type { AccessSearchRequest, DiscoveryGeography } from './types.ts';

const FORBIDDEN_FILTER_KEYS = Object.freeze([
  'balance',
  'tokenBalance',
  'sunreyBalance',
  'moonreyBalance',
  'hinId',
  'medicalRecord',
  'vaultContent',
  'privateCommunication',
  'walletAddress',
  'accountId',
]);

export function assertPrivacySafeSearchRequest(request: AccessSearchRequest): { readonly ok: true } | { readonly ok: false; readonly message: string } {
  for (const key of Object.keys(request.filters)) {
    const normalized = key.toLowerCase();
    if (FORBIDDEN_FILTER_KEYS.some((forbidden) => normalized.includes(forbidden.toLowerCase()))) {
      return Object.freeze({
        ok: false,
        message: `filter key "${key}" is not permitted in discovery queries`,
      });
    }
  }
  return Object.freeze({ ok: true });
}

export function privacySafeDiscoveryLogFields(input: {
  readonly providerId: string;
  readonly capability: string;
  readonly category: string | null;
  readonly hasLocation: boolean;
}): Record<string, string> {
  return Object.freeze({
    providerId: input.providerId,
    capability: input.capability,
    category: input.category ?? 'any',
    hasLocation: input.hasLocation ? 'yes' : 'no',
  });
}

export function generalizeLocationForProvider(geography: {
  readonly latitude: number;
  readonly longitude: number;
  readonly radiusKm: number | null;
}): DiscoveryGeography {
  return Object.freeze({
    latitude: Math.round(geography.latitude * 100) / 100,
    longitude: Math.round(geography.longitude * 100) / 100,
    radiusKm: geography.radiusKm ?? 10,
    countryCode: null,
    regionCode: null,
  });
}
