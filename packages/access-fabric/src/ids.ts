import { type Brand, brandAs } from '../../domain/src/brand.ts';

export type CapacityPoolId = Brand<string, 'CapacityPoolId'>;
export type CapacityReservationId = Brand<string, 'CapacityReservationId'>;
export type WaitlistEntryId = Brand<string, 'WaitlistEntryId'>;
export type CapacityResourceId = Brand<string, 'CapacityResourceId'>;

export function asCapacityPoolId(value: string): CapacityPoolId {
  if (value.length === 0) {
    throw new TypeError('CapacityPoolId must be a non-empty string');
  }
  return brandAs<string, 'CapacityPoolId'>(value);
}

export function asCapacityReservationId(value: string): CapacityReservationId {
  if (value.length === 0) {
    throw new TypeError('CapacityReservationId must be a non-empty string');
  }
  return brandAs<string, 'CapacityReservationId'>(value);
}

export function asWaitlistEntryId(value: string): WaitlistEntryId {
  if (value.length === 0) {
    throw new TypeError('WaitlistEntryId must be a non-empty string');
  }
  return brandAs<string, 'WaitlistEntryId'>(value);
}

export function asCapacityResourceId(value: string): CapacityResourceId {
  if (value.length === 0) {
    throw new TypeError('CapacityResourceId must be a non-empty string');
  }
  return brandAs<string, 'CapacityResourceId'>(value);
}
