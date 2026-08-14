import { type Brand, brandAs } from '../../domain/src/brand.ts';

export type BeneficiaryId = Brand<string, 'BeneficiaryId'>;
export type QuoteId = Brand<string, 'QuoteId'>;
export type PaymentId = Brand<string, 'PaymentId'>;
export type HoldId = Brand<string, 'HoldId'>;
export type CorridorId = Brand<string, 'CorridorId'>;
export type RouteId = Brand<string, 'RouteId'>;
export type ScreeningRef = Brand<string, 'ScreeningRef'>;
export type SettlementRef = Brand<string, 'SettlementRef'>;

function asId<T extends string>(label: string, value: string): Brand<string, T> {
  if (value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return brandAs<string, T>(value);
}

export function asBeneficiaryId(value: string): BeneficiaryId {
  return asId('BeneficiaryId', value);
}

export function asQuoteId(value: string): QuoteId {
  return asId('QuoteId', value);
}

export function asPaymentId(value: string): PaymentId {
  return asId('PaymentId', value);
}

export function asHoldId(value: string): HoldId {
  return asId('HoldId', value);
}

export function asCorridorId(value: string): CorridorId {
  return asId('CorridorId', value);
}

export function asRouteId(value: string): RouteId {
  return asId('RouteId', value);
}

export function asScreeningRef(value: string): ScreeningRef {
  return asId('ScreeningRef', value);
}

export function asSettlementRef(value: string): SettlementRef {
  return asId('SettlementRef', value);
}
