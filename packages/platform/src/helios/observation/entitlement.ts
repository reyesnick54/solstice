/**
 * Observation entitlements — right to use data is separate from numeric contents.
 * Unknown entitlement never becomes unrestricted.
 */

import type { ExternalObservation } from '../../../../provider-sdk/src/types.ts';
import type {
  EntitlementClass,
  FeedDelayClassification,
  ObservationEntitlement,
} from './types.ts';

export function buildObservationEntitlement(input: {
  readonly observation: ExternalObservation<unknown>;
  readonly entitlementClass?: EntitlementClass;
  readonly feedDelayClassification?: FeedDelayClassification;
}): ObservationEntitlement {
  const commercialUseStatus = input.observation.licensing.commercialUseStatus;
  const redistributionStatus = input.observation.licensing.redistributionStatus;
  const feedDelayClassification = input.feedDelayClassification ?? inferFeedDelay(input.entitlementClass);

  let entitlementClass = input.entitlementClass ?? inferEntitlementClass({
    commercialUseStatus,
    redistributionStatus,
    feedDelayClassification,
  });

  const unavailable =
    entitlementClass === 'unavailable' ||
    commercialUseStatus === 'prohibited' ||
    redistributionStatus === 'prohibited';

  if (commercialUseStatus === 'unknown' || redistributionStatus === 'unknown') {
    if (entitlementClass !== 'sandbox_test' && entitlementClass !== 'internal_use') {
      entitlementClass = 'unknown';
    }
  }

  return Object.freeze({
    entitlementClass,
    commercialUseStatus,
    redistributionStatus,
    feedDelayClassification,
    unavailable,
  });
}

export function isEntitlementUsable(entitlement: ObservationEntitlement): boolean {
  if (entitlement.unavailable) return false;
  if (entitlement.entitlementClass === 'unavailable') return false;
  if (entitlement.commercialUseStatus === 'prohibited') return false;
  return true;
}

export function isEntitlementUnknown(entitlement: ObservationEntitlement): boolean {
  return (
    entitlement.entitlementClass === 'unknown' ||
    entitlement.commercialUseStatus === 'unknown' ||
    entitlement.redistributionStatus === 'unknown'
  );
}

function inferFeedDelay(entitlementClass?: EntitlementClass): FeedDelayClassification {
  switch (entitlementClass) {
    case 'provider_feed_real_time':
      return 'real_time';
    case 'provider_feed_delayed':
      return 'delayed';
    case 'provider_feed_eod':
      return 'end_of_day';
    default:
      return 'unknown';
  }
}

function inferEntitlementClass(input: {
  readonly commercialUseStatus: string;
  readonly redistributionStatus: string;
  readonly feedDelayClassification: FeedDelayClassification;
}): EntitlementClass {
  if (input.commercialUseStatus === 'prohibited') {
    return 'commercial_restricted';
  }
  if (input.redistributionStatus === 'prohibited') {
    return 'redistribution_restricted';
  }
  switch (input.feedDelayClassification) {
    case 'real_time':
      return 'provider_feed_real_time';
    case 'delayed':
      return 'provider_feed_delayed';
    case 'end_of_day':
      return 'provider_feed_eod';
    default:
      return 'unknown';
  }
}
