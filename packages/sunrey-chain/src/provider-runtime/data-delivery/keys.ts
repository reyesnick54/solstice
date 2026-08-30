/**
 * Safe cache key construction. Never embed secrets or sensitive identifiers.
 */

import { createHash } from 'node:crypto';

const FORBIDDEN_KEY_FRAGMENTS = [
  'ssn',
  'social_security',
  'health',
  'diagnosis',
  'account_number',
  'full_account',
  'pan',
  'password',
  'passwd',
  'api_key',
  'apikey',
  'bearer',
  'token',
  'secret',
  'credential',
  'private_key',
] as const;

export type CacheKeyInput = {
  readonly providerId: string;
  readonly capability: string;
  readonly resourceId: string;
};

export function buildCacheKey(input: CacheKeyInput): string {
  assertSafeKeyFragment(input.providerId, 'providerId');
  assertSafeKeyFragment(input.capability, 'capability');
  assertSafeKeyFragment(input.resourceId, 'resourceId');
  return `pdc:${input.providerId}:${input.capability}:${hashFragment(input.resourceId)}`;
}

export function buildDeduplicationKey(input: CacheKeyInput & {
  readonly providerTimestampUtc: string | null;
  readonly contentHash: string;
}): string {
  const bucket = input.providerTimestampUtc ?? 'no-provider-ts';
  return `${buildCacheKey(input)}::${bucket}::${input.contentHash}`;
}

export function buildRefreshJobId(input: CacheKeyInput & {
  readonly scheduleId: string;
  readonly intervalBucket: string;
}): string {
  return `refresh_${input.scheduleId}_${input.providerId}_${input.capability}_${hashFragment(input.resourceId)}_${input.intervalBucket}`;
}

export function assertSafeKeyFragment(value: string, field: string): void {
  if (!value || value.length > 256) {
    throw new Error(`unsafe cache key fragment for ${field}`);
  }
  const lowered = value.toLowerCase();
  for (const fragment of FORBIDDEN_KEY_FRAGMENTS) {
    if (lowered.includes(fragment)) {
      throw new Error(`forbidden fragment '${fragment}' in cache key field ${field}`);
    }
  }
}

export function metadataContainsForbiddenFragments(metadata: Readonly<Record<string, string>>): boolean {
  for (const [key, value] of Object.entries(metadata)) {
    try {
      assertSafeKeyFragment(key, 'metadataKey');
      assertSafeKeyFragment(value, 'metadataValue');
    } catch {
      return true;
    }
  }
  return false;
}

function hashFragment(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 16);
}
