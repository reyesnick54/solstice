/**
 * Productive asset lifecycle validation.
 */

import type {
  CanonicalProductiveAsset,
  ProductionAttributionAssessment,
  ProductiveAssetLifecycle,
} from './types.ts';

const ACTIVE_LIKE: ReadonlySet<ProductiveAssetLifecycle> = new Set(['ACTIVE', 'DEGRADED']);

export function lifecycleAllowsProduction(
  lifecycle: ProductiveAssetLifecycle,
  eventAtUtc: string,
  asset: Pick<CanonicalProductiveAsset, 'commissionedAtUtc' | 'retiredAtUtc'>,
): ProductionAttributionAssessment {
  if (lifecycle === 'PLANNED') {
    return {
      allowed: false,
      code: 'NOT_YET_COMMISSIONED',
      message: 'planned asset cannot accept production attribution before commissioning',
    };
  }
  if (lifecycle === 'RETIRED') {
    if (asset.retiredAtUtc && eventAtUtc >= asset.retiredAtUtc) {
      return {
        allowed: false,
        code: 'RETIRED_BEFORE_EVENT',
        message: 'event occurs on or after retirement date',
      };
    }
    return {
      allowed: false,
      code: 'LIFECYCLE_INCOMPATIBLE',
      message: 'retired asset cannot accept new production attribution',
    };
  }
  if (lifecycle === 'SUSPENDED') {
    return {
      allowed: false,
      code: 'LIFECYCLE_INCOMPATIBLE',
      message: 'suspended asset cannot accept production attribution',
    };
  }
  if (lifecycle === 'UNKNOWN') {
    return {
      allowed: false,
      code: 'UNKNOWN_LIFECYCLE',
      message: 'unknown lifecycle requires review before production attribution',
    };
  }
  if (asset.commissionedAtUtc && eventAtUtc < asset.commissionedAtUtc) {
    return {
      allowed: false,
      code: 'NOT_YET_COMMISSIONED',
      message: 'event precedes commissioning date',
    };
  }
  if (asset.retiredAtUtc && eventAtUtc >= asset.retiredAtUtc) {
    return {
      allowed: false,
      code: 'RETIRED_BEFORE_EVENT',
      message: 'event occurs on or after retirement date',
    };
  }
  if (!ACTIVE_LIKE.has(lifecycle)) {
    return {
      allowed: false,
      code: 'LIFECYCLE_INCOMPATIBLE',
      message: `lifecycle ${lifecycle} is incompatible with production attribution`,
    };
  }
  return { allowed: true, code: 'OK', message: 'lifecycle permits production attribution' };
}

export function transitionLifecycle(
  current: ProductiveAssetLifecycle,
  next: ProductiveAssetLifecycle,
): ProductiveAssetLifecycle {
  if (current === next) {
    return current;
  }
  if (current === 'RETIRED' && next !== 'RETIRED') {
    throw new Error('retired productive assets cannot be reactivated without review');
  }
  return next;
}
