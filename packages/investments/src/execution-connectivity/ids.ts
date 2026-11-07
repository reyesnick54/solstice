import { type Brand, brandAs } from '../../../domain/src/brand.ts';

export type ExternalBrokerAccountId = Brand<string, 'ExternalBrokerAccountId'>;
export type ExternalCashPositionId = Brand<string, 'ExternalCashPositionId'>;
export type ExternalSecurityPositionId = Brand<string, 'ExternalSecurityPositionId'>;

function asNonEmpty<T extends string>(value: string, label: string): Brand<string, T> {
  if (value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return brandAs<string, T>(value);
}

export function asExternalBrokerAccountId(value: string): ExternalBrokerAccountId {
  return asNonEmpty(value, 'ExternalBrokerAccountId');
}

export function asExternalCashPositionId(value: string): ExternalCashPositionId {
  return asNonEmpty(value, 'ExternalCashPositionId');
}

export function asExternalSecurityPositionId(value: string): ExternalSecurityPositionId {
  return asNonEmpty(value, 'ExternalSecurityPositionId');
}
