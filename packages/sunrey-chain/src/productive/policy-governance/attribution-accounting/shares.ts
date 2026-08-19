import {
  ATTRIBUTION_SHARE_SCALE,
  DEFAULT_MAXIMUM_AGGREGATE_SHARE,
  attributionFailure,
  type AttributionFailure,
} from './types.ts';

export function assertShare(share: bigint, label: string): AttributionFailure | undefined {
  if (share < 0n) {
    return attributionFailure('EVENT_OVERALLOCATED', `${label} cannot be negative`);
  }
  if (share > ATTRIBUTION_SHARE_SCALE) {
    return attributionFailure('EVENT_OVERALLOCATED', `${label} exceeds share scale ${ATTRIBUTION_SHARE_SCALE}`);
  }
  return undefined;
}

export function addShares(left: bigint, right: bigint): bigint {
  return left + right;
}

export function remainingShare(maximum: bigint, allocated: bigint): bigint {
  return maximum - allocated;
}

export function shareWouldExceed(maximum: bigint, allocated: bigint, requested: bigint): boolean {
  return allocated + requested > maximum;
}

export function policyMaximum(maximum?: bigint): bigint {
  return maximum ?? DEFAULT_MAXIMUM_AGGREGATE_SHARE;
}

export function shareExhausted(remaining: bigint, requested: bigint): boolean {
  return remaining < requested;
}

export function fullyAttributed(allocated: bigint, maximum: bigint): boolean {
  return allocated === maximum;
}

export function overAllocated(allocated: bigint, maximum: bigint): boolean {
  return allocated > maximum;
}
