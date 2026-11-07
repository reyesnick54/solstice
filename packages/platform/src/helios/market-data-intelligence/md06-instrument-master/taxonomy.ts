/**
 * HELIOS Market Data MD06 — temporal instrument master and reference data.
 */

export const HELIOS_MD06 = 'HELIOS_MD06' as const;

export const HELIOS_MD06_INSTRUMENT_MASTER_SCHEMA =
  'sunrey.helios.market-data.instrument-master.v1' as const;

export const HELIOS_MD06_AUTHORITY = 'REFERENCE_ONLY' as const;

export const HELIOS_MD06_INSTRUMENT_MASTER_QUALIFIED =
  'HELIOS_MD06_INSTRUMENT_MASTER_QUALIFIED' as const;

export const HELIOS_MD06_INSTRUMENT_MASTER_BLOCKED =
  'HELIOS_MD06_INSTRUMENT_MASTER_BLOCKED' as const;

/** Identifier systems supported when available (ticker is never permanent identity). */
export const INSTRUMENT_IDENTIFIER_SYSTEMS = [
  'ticker',
  'figi',
  'isin',
  'cusip',
  'sedol',
  'mic',
  'cik',
  'exchange_native_id',
  'provider_native_id',
] as const;
export type InstrumentIdentifierSystem = (typeof INSTRUMENT_IDENTIFIER_SYSTEMS)[number];

export const PERMANENT_IDENTITY_IDENTIFIER_SYSTEMS = [
  'figi',
  'isin',
  'cusip',
  'sedol',
  'cik',
  'exchange_native_id',
] as const;
export type PermanentIdentityIdentifierSystem = (typeof PERMANENT_IDENTITY_IDENTIFIER_SYSTEMS)[number];

export const CORPORATE_ACTION_KINDS = [
  'split',
  'reverse_split',
  'cash_dividend',
  'stock_dividend',
  'spin_off',
  'merger',
  'symbol_change',
  'delisting',
  'special_distribution',
] as const;
export type Md06CorporateActionKind = (typeof CORPORATE_ACTION_KINDS)[number];

export const OPTION_PUT_CALL = ['put', 'call'] as const;
export type OptionPutCall = (typeof OPTION_PUT_CALL)[number];

export const PRICE_SERIES_KINDS = ['RAW', 'ADJUSTED_RESEARCH'] as const;
export type PriceSeriesKind = (typeof PRICE_SERIES_KINDS)[number];

/** Extends AAF03 temporal entity graph (stored on graph nodes). */
export const MD06_TEMPORAL_ENTITY_KINDS = ['VENUE_INSTRUMENT', 'TRADING_SESSION'] as const;
export type Md06TemporalEntityKind = (typeof MD06_TEMPORAL_ENTITY_KINDS)[number];

export const MD06_TEMPORAL_RELATIONSHIP_TYPES = [
  'VENUE_INSTRUMENT_FOR',
  'HAS_TRADING_SESSION',
] as const;
export type Md06TemporalRelationshipType = (typeof MD06_TEMPORAL_RELATIONSHIP_TYPES)[number];
