/**
 * HELIOS M06 — BTC/USD and ETH/USD spot instrument resolution via M01 multi-asset domain.
 */

import {
  resolveMultiAssetInstrument,
  resolveMultiAssetProviderMapping,
} from '../../capital-market/multi-asset/index.ts';
import type { RegisteredCapitalMarketInstrument } from '../../capital-market/instrument-registry.ts';
import { resolveCapitalMarketInstrument } from '../../capital-market/instrument-registry.ts';

export const M06_CRYPTO_SPOT_UNIVERSE = Object.freeze([
  'CRYPTO:GLOBAL:BTC:USD:SIM',
  'CRYPTO:GLOBAL:ETH:USD:SIM',
] as const);

export type M06CryptoSpotInstrumentId = (typeof M06_CRYPTO_SPOT_UNIVERSE)[number];

export function resolveCryptoSpotInstrument(instrumentId: string): RegisteredCapitalMarketInstrument | undefined {
  return resolveCapitalMarketInstrument(instrumentId);
}

export function resolveCryptoSpotByProviderSymbol(
  providerId: string,
  providerSymbol: string,
): RegisteredCapitalMarketInstrument | undefined {
  const record = resolveMultiAssetProviderMapping(providerId, providerSymbol);
  if (!record || record.status === 'INACTIVE' || record.assetClass !== 'CRYPTO_SPOT') {
    return undefined;
  }
  return resolveCapitalMarketInstrument(record.instrumentId);
}

export function isM06CryptoSpotInstrument(instrumentId: string): instrumentId is M06CryptoSpotInstrumentId {
  return (M06_CRYPTO_SPOT_UNIVERSE as readonly string[]).includes(instrumentId);
}

export function assertM06InstrumentActive(instrumentId: string): boolean {
  const record = resolveMultiAssetInstrument(instrumentId);
  return Boolean(record && record.status === 'ACTIVE' && record.assetClass === 'CRYPTO_SPOT');
}
