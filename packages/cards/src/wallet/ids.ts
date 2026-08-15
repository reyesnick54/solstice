import { type Brand, brandAs } from '../../../domain/src/brand.ts';

export type DevicePaymentTokenId = Brand<string, 'DevicePaymentTokenId'>;
export type WalletProviderReference = Brand<string, 'WalletProviderReference'>;

function brandId<Name extends string>(value: string, name: Name): Brand<string, Name> {
  if (value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return brandAs<string, Name>(value);
}

export function asDevicePaymentTokenId(value: string): DevicePaymentTokenId {
  return brandId(value, 'DevicePaymentTokenId');
}

export function asWalletProviderReference(value: string): WalletProviderReference {
  if (!value.startsWith('sim_wref_')) {
    throw new TypeError('WalletProviderReference must be a synthetic sim_wref_ value');
  }
  return brandId(value, 'WalletProviderReference');
}
