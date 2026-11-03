/**
 * OS04 multi-venue adapter registry — fixture/skeleton only in CI.
 */

import { HELIOS_OS04_VENUE_IDS } from '../../../provider-sdk/src/venue/taxonomy.ts';
import type { HeliosVenueAdapterContract } from '../../../provider-sdk/src/venue/contract.ts';
import { BINANCE_VENUE_ADAPTER } from './binance/adapter.ts';
import { BYBIT_VENUE_ADAPTER } from './bybit/adapter.ts';
import { OKX_VENUE_ADAPTER } from './okx/adapter.ts';
import { BITGET_VENUE_ADAPTER } from './bitget/adapter.ts';
import { GATE_VENUE_ADAPTER } from './gate/adapter.ts';
import { KUCOIN_VENUE_ADAPTER } from './kucoin/adapter.ts';
import { HYPERLIQUID_VENUE_ADAPTER } from './hyperliquid/adapter.ts';
import { KRAKEN_VENUE_ADAPTER } from './kraken/adapter.ts';

export const HELIOS_OS04_VENUE_ADAPTERS: readonly HeliosVenueAdapterContract[] = Object.freeze([
  KRAKEN_VENUE_ADAPTER,
  BINANCE_VENUE_ADAPTER,
  BYBIT_VENUE_ADAPTER,
  OKX_VENUE_ADAPTER,
  BITGET_VENUE_ADAPTER,
  GATE_VENUE_ADAPTER,
  KUCOIN_VENUE_ADAPTER,
  HYPERLIQUID_VENUE_ADAPTER,
]);

export function getHeliosVenueAdapter(venueId: string): HeliosVenueAdapterContract | null {
  return HELIOS_OS04_VENUE_ADAPTERS.find((row) => row.venueId === venueId) ?? null;
}

export function listHeliosVenueAdapterIds(): readonly string[] {
  return HELIOS_OS04_VENUE_ADAPTERS.map((row) => row.venueId);
}

export function assertOs04VenueRegistryComplete(): boolean {
  const ids = new Set(listHeliosVenueAdapterIds());
  return HELIOS_OS04_VENUE_IDS.every((venueId) => ids.has(venueId));
}
