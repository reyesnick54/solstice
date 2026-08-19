import { createHash } from 'node:crypto';

import type { MoonReyProductiveSettlementAuthorization, ProductiveValueResult } from './types.ts';

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function isSha256Hex(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}

export function computeProductiveValueDigest(value: Pick<
  ProductiveValueResult,
  | 'productiveValueId'
  | 'contributionId'
  | 'contributionFingerprint'
  | 'eventId'
  | 'eventFingerprint'
  | 'attributionDecisionId'
  | 'valueFunctionPolicyId'
  | 'valueFunctionPolicyVersion'
  | 'productiveValueQuantity'
  | 'productiveValueUnit'
>): string {
  return sha256Hex(
    [
      'mpvr.v1',
      value.productiveValueId,
      value.contributionId,
      value.contributionFingerprint,
      value.eventId,
      value.eventFingerprint,
      value.attributionDecisionId,
      value.valueFunctionPolicyId,
      String(value.valueFunctionPolicyVersion),
      value.productiveValueQuantity.toString(),
      value.productiveValueUnit,
    ].join(':'),
  );
}

export function computeAuthorizationEvidenceDigest(
  authorization: Pick<
    MoonReyProductiveSettlementAuthorization,
    | 'authorizationId'
    | 'contributionFingerprint'
    | 'productiveValueId'
    | 'productiveValueDigest'
    | 'conversionPolicyVersion'
    | 'authorizedMoonReyQuantity'
  >,
): string {
  return sha256Hex(
    [
      authorization.authorizationId,
      authorization.contributionFingerprint,
      authorization.productiveValueId,
      authorization.productiveValueDigest,
      authorization.conversionPolicyVersion,
      authorization.authorizedMoonReyQuantity.toString(),
    ].join(':'),
  );
}

const RAW_PROVIDER_KEYS = [
  'rawProviderPayload',
  'rawHttp',
  'httpBody',
  'providerSecret',
  'apiKey',
  'credentials',
  'secret',
] as const;

export function containsRawProviderData(value: unknown, depth = 0): boolean {
  if (value === null || value === undefined || typeof value !== 'object' || depth > 4) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsRawProviderData(item, depth + 1));
  }
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if ((RAW_PROVIDER_KEYS as readonly string[]).includes(key) && inner) {
      return true;
    }
    if (containsRawProviderData(inner, depth + 1)) {
      return true;
    }
  }
  return false;
}
