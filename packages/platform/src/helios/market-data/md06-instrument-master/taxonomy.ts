/**
 * HELIOS MARKET DATA MD06 — temporal instrument master and reference data.
 */

export const HELIOS_MD06 = 'HELIOS_MD06' as const;

export const HELIOS_MD06_INSTRUMENT_MASTER_SCHEMA =
  'sunrey.helios.market-data.instrument-master.v1' as const;

export const HELIOS_MD06_AUTHORITY = 'REFERENCE_ONLY' as const;

/** Graph node kinds introduced by MD06 (subset of extended AAF03 temporal entity graph). */
export const MD06_TEMPORAL_ENTITY_KINDS = [
  'INSTRUMENT_IDENTITY',
  'VENUE_INSTRUMENT',
  'TRADING_SESSION',
  'DERIVATIVE_CONTRACT',
] as const;

export const MD06_TEMPORAL_RELATIONSHIP_TYPES = [
  'HAS_INSTRUMENT_IDENTITY',
  'VENUE_INSTRUMENT_FOR',
  'SESSION_AT_VENUE',
  'CORPORATE_ACTION_ON',
  'UNDERLYING_OF',
  'CONTRACT_LIFECYCLE_FOR',
] as const;

export const INSTRUMENT_IDENTIFIER_KINDS = [
  'TICKER',
  'FIGI',
  'ISIN',
  'CUSIP',
  'SEDOL',
  'MIC',
  'CIK',
  'EXCHANGE_NATIVE_ID',
  'PROVIDER_NATIVE_ID',
] as const;
export type InstrumentIdentifierKind = (typeof INSTRUMENT_IDENTIFIER_KINDS)[number];

/** Ticker is never the permanent instrument identity kind. */
export const PERMANENT_INSTRUMENT_IDENTITY_KINDS = [
  'FIGI',
  'ISIN',
  'CUSIP',
  'SEDOL',
  'EXCHANGE_NATIVE_ID',
  'PROVIDER_NATIVE_ID',
] as const;

export const CORPORATE_ACTION_KINDS = [
  'SPLIT',
  'REVERSE_SPLIT',
  'CASH_DIVIDEND',
  'STOCK_DIVIDEND',
  'SPIN_OFF',
  'MERGER',
  'SYMBOL_CHANGE',
  'DELISTING',
  'SPECIAL_DISTRIBUTION',
] as const;
export type CorporateActionKind = (typeof CORPORATE_ACTION_KINDS)[number];

export const PRICE_SERIES_KINDS = ['RAW', 'ADJUSTED_RESEARCH'] as const;
export type PriceSeriesKind = (typeof PRICE_SERIES_KINDS)[number];

export const OPTION_PUT_CALL = ['PUT', 'CALL'] as const;
export type OptionPutCall = (typeof OPTION_PUT_CALL)[number];

export const HELIOS_MD06_INSTRUMENT_MASTER_QUALIFIED =
  'HELIOS_MD06_INSTRUMENT_MASTER_QUALIFIED' as const;

export const HELIOS_MD06_INSTRUMENT_MASTER_BLOCKED =
  'HELIOS_MD06_INSTRUMENT_MASTER_BLOCKED' as const;
