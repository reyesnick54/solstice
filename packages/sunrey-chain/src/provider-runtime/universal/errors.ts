/**
 * Normalize vendor failures into canonical SunRey provider errors.
 * Raw sensitive vendor messages stay internal.
 */

import { universalErr, type ProviderErrorCode, type UniversalResult } from './types.ts';

const VENDOR_CODE_MAP: Readonly<Record<string, ProviderErrorCode>> = Object.freeze({
  timeout: 'PROVIDER_TIMEOUT',
  timed_out: 'PROVIDER_TIMEOUT',
  unavailable: 'PROVIDER_UNAVAILABLE',
  outage: 'PROVIDER_UNAVAILABLE',
  rate_limit: 'PROVIDER_RATE_LIMITED',
  rate_limited: 'PROVIDER_RATE_LIMITED',
  unauthorized: 'PROVIDER_AUTH_FAILED',
  auth_failed: 'PROVIDER_AUTH_FAILED',
  forbidden: 'PROVIDER_AUTH_FAILED',
  rejected: 'PROVIDER_REJECTED',
  declined: 'PROVIDER_REJECTED',
  validation: 'PROVIDER_VALIDATION_FAILED',
  invalid: 'PROVIDER_VALIDATION_FAILED',
  pending: 'PROVIDER_PENDING',
  processing: 'PROVIDER_PENDING',
  unknown: 'PROVIDER_UNKNOWN_STATUS',
  unknown_status: 'PROVIDER_UNKNOWN_STATUS',
  configuration: 'PROVIDER_CONFIGURATION_ERROR',
  misconfigured: 'PROVIDER_CONFIGURATION_ERROR',
});

export function normalizeProviderFailure(input: {
  readonly providerId: string;
  readonly vendorCode?: string;
  readonly vendorMessage?: string;
  readonly providerReference?: string;
}): UniversalResult<never> {
  const raw = (input.vendorCode ?? 'unknown').toLowerCase().replace(/[\s-]+/g, '_');
  const code = VENDOR_CODE_MAP[raw] ?? 'PROVIDER_UNKNOWN_STATUS';
  return universalErr(code, `provider ${input.providerId} returned ${code}`, {
    providerId: input.providerId,
    providerReference: input.providerReference,
  });
}

export function publicProviderError(error: { readonly code: string }): { readonly code: string } {
  return Object.freeze({ code: error.code });
}
