/**
 * MD01 observation owner hook — re-export canonical events for H08 consumers.
 */

export {
  MARKET_DATA_EVENT_SCHEMA_VERSION,
  MARKET_DATA_EVENT_AUTHORITY,
  CANONICAL_MARKET_DATA_EVENT_KINDS,
  validateMarketDataEventEnvelope,
  type CanonicalMarketDataEvent,
} from '@solstice/provider-sdk';

export const HELIOS_OBSERVATION_MD01_INTEGRATION =
  'packages/platform/src/helios/observation/md01-market-events.ts' as const;
