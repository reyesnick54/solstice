import { sha256Hex } from '../../../../../security/src/hash.ts';
import { ATTRIBUTION_DOMAIN } from './constitution.ts';
import type { ProductiveAttributionDecision, ProductiveAttributionPolicy } from './types.ts';

export function hashAttributionPolicy(
  policy: Omit<ProductiveAttributionPolicy, 'contentHash'> | ProductiveAttributionPolicy,
): string {
  const { contentHash: _ignored, ...rest } = policy as ProductiveAttributionPolicy;
  void _ignored;
  return sha256Hex(`${ATTRIBUTION_DOMAIN}|policy|${stable(rest)}`);
}

export function attributionDecisionDigest(
  decision: Omit<ProductiveAttributionDecision, 'decisionDigest'>,
): string {
  return sha256Hex(`${ATTRIBUTION_DOMAIN}|decision|${stable(decision)}`);
}

function stable(value: unknown): string {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stable(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${key}:${stable(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
