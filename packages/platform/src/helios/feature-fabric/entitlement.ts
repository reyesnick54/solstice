/**
 * Entitlement propagation from source observations to derived features.
 */

import type { EntitlementClass, ObservationEntitlement } from '../observation/types.ts';
import { isEntitlementUsable, isEntitlementUnknown } from '../observation/entitlement.ts';
import type { FeatureContributionInput, FeatureEntitlementState } from './types.ts';

export function deriveFeatureEntitlement(
  contributions: readonly FeatureContributionInput[],
): { readonly state: FeatureEntitlementState; readonly entitlementClass: EntitlementClass } {
  if (contributions.length === 0) {
    return { state: 'UNAVAILABLE', entitlementClass: 'unavailable' };
  }

  let worst: FeatureEntitlementState = 'USABLE';
  let entitlementClass: EntitlementClass = contributions[0]!.entitlement.entitlementClass;

  for (const contribution of contributions) {
    const ent = contribution.entitlement;
    if (!isEntitlementUsable(ent) || ent.unavailable) {
      worst = 'UNAVAILABLE';
      entitlementClass = 'unavailable';
      continue;
    }
    if (isEntitlementUnknown(ent)) {
      if (worst === 'USABLE') {
        worst = 'UNKNOWN';
      }
      if (entitlementClass !== 'unavailable') {
        entitlementClass = 'unknown';
      }
    }
    if (
      ent.entitlementClass === 'redistribution_restricted' ||
      ent.entitlementClass === 'commercial_restricted' ||
      ent.commercialUseStatus === 'restricted' ||
      ent.redistributionStatus === 'restricted'
    ) {
      worst = worst === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'RESTRICTED';
      if (entitlementClass !== 'unavailable') {
        entitlementClass = ent.entitlementClass;
      }
    }
  }

  return { state: worst, entitlementClass };
}

export function entitlementsFromContributions(
  contributions: readonly FeatureContributionInput[],
): readonly ObservationEntitlement[] {
  const seen = new Set<string>();
  const list: ObservationEntitlement[] = [];
  for (const contribution of contributions) {
    const key = `${contribution.entitlement.entitlementClass}:${contribution.entitlement.commercialUseStatus}`;
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(contribution.entitlement);
  }
  return Object.freeze(list);
}
