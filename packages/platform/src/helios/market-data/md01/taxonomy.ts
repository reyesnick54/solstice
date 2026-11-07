import {
  CANONICAL_MARKET_DATA_EVENT_KINDS,
  MARKET_DATA_EVENT_SCHEMA_VERSION,
} from '@solstice/provider-sdk';

export { MARKET_DATA_EVENT_SCHEMA_VERSION };

export const HELIOS_MD01_MARKET_DATA_FABRIC_SCHEMA = 'sunrey.helios.market-data-fabric.md01.v1' as const;

export const MD01_CANONICAL_EVENT_KINDS = CANONICAL_MARKET_DATA_EVENT_KINDS;

export const MD01_TEMPORAL_OBSERVATION_KIND = 'MARKET_DATA_EVENT' as const;

export const MD01_FEATURE_FAMILY = 'MARKET_PRICE' as const;
