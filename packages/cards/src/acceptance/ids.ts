import { type Brand, brandAs } from '../../../domain/src/brand.ts';

export type MerchantId = Brand<string, 'MerchantId'>;
export type AcceptanceDeviceId = Brand<string, 'AcceptanceDeviceId'>;
export type AcceptanceSessionId = Brand<string, 'AcceptanceSessionId'>;
export type AcceptancePaymentId = Brand<string, 'AcceptancePaymentId'>;
export type ProviderDeviceReference = Brand<string, 'ProviderDeviceReference'>;
export type ProviderAcceptanceTransactionRef = Brand<string, 'ProviderAcceptanceTransactionRef'>;

function brandId<Name extends string>(value: string, name: Name): Brand<string, Name> {
  if (value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return brandAs<string, Name>(value);
}

export function asMerchantId(value: string): MerchantId {
  return brandId(value, 'MerchantId');
}

export function asAcceptanceDeviceId(value: string): AcceptanceDeviceId {
  return brandId(value, 'AcceptanceDeviceId');
}

export function asAcceptanceSessionId(value: string): AcceptanceSessionId {
  return brandId(value, 'AcceptanceSessionId');
}

export function asAcceptancePaymentId(value: string): AcceptancePaymentId {
  return brandId(value, 'AcceptancePaymentId');
}

export function asProviderDeviceReference(value: string): ProviderDeviceReference {
  if (!value.startsWith('sim_adev_')) {
    throw new TypeError('ProviderDeviceReference must be a synthetic sim_adev_ value');
  }
  return brandId(value, 'ProviderDeviceReference');
}

export function asProviderAcceptanceTransactionRef(value: string): ProviderAcceptanceTransactionRef {
  if (!value.startsWith('sim_atxn_')) {
    throw new TypeError('ProviderAcceptanceTransactionRef must be a synthetic sim_atxn_ value');
  }
  return brandId(value, 'ProviderAcceptanceTransactionRef');
}
