/**
 * MD01 — certification plane alignment for canonical market-data events.
 */

import {
  CANONICAL_MARKET_DATA_EVENT_KINDS,
  MARKET_DATA_EVENT_AUTHORITY,
  MARKET_DATA_EVENT_GRANTS_EXECUTION_AUTHORITY,
  MARKET_DATA_EVENT_SCHEMA_VERSION,
  MARKET_EVENT_QUALITY_STATES,
  isDecimalString,
  validateMarketDataEventEnvelope,
  type CanonicalMarketDataEvent,
  type CanonicalMarketDataEventKind,
  type MarketDataEventEnvelopeBase,
} from '@solstice/provider-sdk';

export {
  MARKET_DATA_EVENT_SCHEMA_VERSION,
  MARKET_DATA_EVENT_AUTHORITY,
  MARKET_DATA_EVENT_GRANTS_EXECUTION_AUTHORITY,
  CANONICAL_MARKET_DATA_EVENT_KINDS,
  MARKET_EVENT_QUALITY_STATES,
  validateMarketDataEventEnvelope,
  isDecimalString,
  type CanonicalMarketDataEventKind,
  type CanonicalMarketDataEvent,
  type MarketDataEventEnvelopeBase,
};

export const EXTERNAL_DATA_MD01_CERTIFICATION_ANCHOR =
  'packages/external-data/src/certification/market-data' as const;

export function certifiedEventKindsForProvider(providerId: string): readonly CanonicalMarketDataEventKind[] {
  void providerId;
  return CANONICAL_MARKET_DATA_EVENT_KINDS;
}
