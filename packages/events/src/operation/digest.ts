import { createHash } from 'node:crypto';

import type { RequestDigestFields } from './types.ts';

function canonicalField(value: string | null | undefined): string {
  return value ?? '';
}

/**
 * Deterministic request digest bound to an idempotency key.
 * Native asset is always part of the identity so 100 SUNREY_COIN cannot
 * collide with 100 MOONREY_COIN.
 */
export function computeRequestDigest(fields: RequestDigestFields): string {
  const canonical = [
    `operationKind=${fields.operationKind}`,
    `amountMinor=${fields.amountMinor}`,
    `assetId=${fields.assetId}`,
    `currency=${canonicalField(fields.currency)}`,
    `beneficiary=${canonicalField(fields.beneficiary)}`,
    `destination=${canonicalField(fields.destination)}`,
    `providerId=${fields.providerId}`,
    `network=${canonicalField(fields.network)}`,
    `nativeAssetId=${canonicalField(fields.nativeAssetId)}`,
  ].join('\n');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function businessIntentFingerprint(fields: RequestDigestFields): string {
  const canonical = [
    `operationKind=${fields.operationKind}`,
    `amountMinor=${fields.amountMinor}`,
    `assetId=${fields.assetId}`,
    `currency=${canonicalField(fields.currency)}`,
    `beneficiary=${canonicalField(fields.beneficiary)}`,
    `destination=${canonicalField(fields.destination)}`,
    `network=${canonicalField(fields.network)}`,
    `nativeAssetId=${canonicalField(fields.nativeAssetId)}`,
  ].join('\n');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function providerIdempotencyKeyFor(input: {
  readonly businessKey: string;
  readonly providerId: string;
  readonly attemptLineage: string;
}): string {
  return `prov_${input.providerId}_${input.businessKey}_${input.attemptLineage}`;
}
