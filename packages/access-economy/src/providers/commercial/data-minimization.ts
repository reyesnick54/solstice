/**
 * Customer data minimization for commercial provider requests.
 *
 * Only canonical booking-profile fields may be sent to travel/experience
 * providers. Sensitive SunRey domains must never leave the boundary.
 */

import type { CommercialBookingProfile } from './types.ts';

export const FORBIDDEN_PROVIDER_PAYLOAD_FIELDS = [
  'tokenHoldings',
  'financialAgentData',
  'hin',
  'vault',
  'healthData',
  'bankBalances',
  'sunreyCoinBalance',
  'moonreyCoinBalance',
  'accessFundingState',
] as const;

export type ProviderPayloadScanResult = {
  readonly safe: boolean;
  readonly violations: readonly string[];
};

export function validateBookingProfile(profile: CommercialBookingProfile): ProviderPayloadScanResult {
  const violations: string[] = [];
  if (!profile.profileRef || profile.profileRef.length === 0) {
    violations.push('profileRef_required');
  }
  if (!profile.givenName || profile.givenName.length === 0) {
    violations.push('givenName_required');
  }
  if (!profile.familyName || profile.familyName.length === 0) {
    violations.push('familyName_required');
  }
  return Object.freeze({ safe: violations.length === 0, violations: Object.freeze(violations) });
}

export function scanProviderPayload(payload: Record<string, unknown>): ProviderPayloadScanResult {
  const violations: string[] = [];
  for (const field of FORBIDDEN_PROVIDER_PAYLOAD_FIELDS) {
    if (field in payload) {
      violations.push(`forbidden_field:${field}`);
    }
  }
  return Object.freeze({ safe: violations.length === 0, violations: Object.freeze(violations) });
}

export function toMinimalProviderPayload(profile: CommercialBookingProfile): Record<string, string | null> {
  return Object.freeze({
    profileRef: profile.profileRef,
    givenName: profile.givenName,
    familyName: profile.familyName,
    email: profile.email,
    phone: profile.phone,
  });
}

export function redactCredentialFromError(message: string): string {
  return message
    .replace(/api[_-]?key[=:]\s*\S+/gi, 'api_key=[REDACTED]')
    .replace(/client[_-]?secret[=:]\s*\S+/gi, 'client_secret=[REDACTED]')
    .replace(/bearer\s+\S+/gi, 'bearer [REDACTED]')
    .replace(/affiliate[_-]?id[=:]\s*\S+/gi, 'affiliate_id=[REDACTED]');
}
