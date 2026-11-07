/**
 * Per-venue MD09 synchronization schemes — actual venue semantics, no forced fake sequences.
 */

import type { HeliosOs04VenueId, HeliosVenueAdapter } from '@solstice/provider-sdk';
import type { Md09SynchronizationScheme } from './types.ts';

const VENUE_SYNC: Readonly<Record<HeliosOs04VenueId, Omit<Md09SynchronizationScheme, 'sequencePolicy'>>> = {
  kraken: {
    venueId: 'kraken',
    sequenceField: 'sequence',
    snapshotAnchored: false,
    checksumSupported: false,
  },
  binance: {
    venueId: 'binance',
    sequenceField: 'update_id',
    snapshotAnchored: true,
    checksumSupported: true,
  },
  bybit: {
    venueId: 'bybit',
    sequenceField: 'update_id',
    snapshotAnchored: true,
    checksumSupported: false,
  },
  okx: {
    venueId: 'okx',
    sequenceField: 'sequence',
    snapshotAnchored: true,
    checksumSupported: false,
  },
  bitget: {
    venueId: 'bitget',
    sequenceField: 'update_id',
    snapshotAnchored: true,
    checksumSupported: false,
  },
  gate: {
    venueId: 'gate',
    sequenceField: 'sequence',
    snapshotAnchored: false,
    checksumSupported: false,
  },
  kucoin: {
    venueId: 'kucoin',
    sequenceField: 'sequence',
    snapshotAnchored: true,
    checksumSupported: false,
  },
  hyperliquid: {
    venueId: 'hyperliquid',
    sequenceField: 'none',
    snapshotAnchored: false,
    checksumSupported: false,
  },
};

export function describeMd09Synchronization(adapter: HeliosVenueAdapter): Md09SynchronizationScheme {
  const base = VENUE_SYNC[adapter.venueId];
  const conn = adapter.describeConnectivity();
  return Object.freeze({
    ...base,
    sequencePolicy: conn.sequence,
  });
}
