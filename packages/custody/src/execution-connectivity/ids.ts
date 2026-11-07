import { type Brand, brandAs } from '../../../domain/src/brand.ts';

export type ExternalCustodyAccountId = Brand<string, 'ExternalCustodyAccountId'>;
export type BeneficialOwnerBindingId = Brand<string, 'BeneficialOwnerBindingId'>;
export type ExternalDigitalPositionId = Brand<string, 'ExternalDigitalPositionId'>;
export type Exec08ReconciliationId = Brand<string, 'Exec08ReconciliationId'>;

function asNonEmpty<T extends string>(value: string, label: string): Brand<string, T> {
  if (value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return brandAs<string, T>(value);
}

export function asExternalCustodyAccountId(value: string): ExternalCustodyAccountId {
  return asNonEmpty(value, 'ExternalCustodyAccountId');
}

export function asBeneficialOwnerBindingId(value: string): BeneficialOwnerBindingId {
  return asNonEmpty(value, 'BeneficialOwnerBindingId');
}

export function asExternalDigitalPositionId(value: string): ExternalDigitalPositionId {
  return asNonEmpty(value, 'ExternalDigitalPositionId');
}

export function asExec08ReconciliationId(value: string): Exec08ReconciliationId {
  return asNonEmpty(value, 'Exec08ReconciliationId');
}
