/**
 * MD06 domain types — instrument master, listings, corporate actions, and price series.
 */

import type { UtcInstant } from '@solstice/domain';

import type {
  CorporateActionKind,
  HELIOS_MD06_AUTHORITY,
  HELIOS_MD06_INSTRUMENT_MASTER_SCHEMA,
  InstrumentIdentifierKind,
  OptionPutCall,
  PriceSeriesKind,
} from './taxonomy.ts';

export type InstrumentIdentifier = {
  readonly kind: InstrumentIdentifierKind;
  readonly value: string;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveTo: UtcInstant | null;
  readonly knowableAt: UtcInstant;
};

export type InstrumentIdentity = {
  readonly schema: typeof HELIOS_MD06_INSTRUMENT_MASTER_SCHEMA;
  readonly authority: typeof HELIOS_MD06_AUTHORITY;
  readonly instrumentIdentityId: string;
  readonly displayName: string;
  readonly jurisdiction: string | null;
  readonly permanentIdentifierKind: Exclude<InstrumentIdentifierKind, 'TICKER' | 'MIC' | 'CIK'>;
  readonly permanentIdentifierValue: string;
  readonly identifiers: readonly InstrumentIdentifier[];
  readonly temporalGraphNodeId: string | null;
  readonly grantsExecutionAuthority: false;
};

export type InstrumentListing = {
  readonly listingId: string;
  readonly instrumentIdentityId: string;
  readonly canonicalInstrumentId: string | null;
  readonly venueMic: string;
  readonly ticker: string;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveTo: UtcInstant | null;
  readonly knowableAt: UtcInstant;
  readonly temporalGraphNodeId: string | null;
};

export type VenueInstrument = {
  readonly venueInstrumentId: string;
  readonly instrumentIdentityId: string;
  readonly venueMic: string;
  readonly exchangeNativeId: string | null;
  readonly providerNativeId: string | null;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveTo: UtcInstant | null;
  readonly knowableAt: UtcInstant;
};

export type TradingSession = {
  readonly sessionId: string;
  readonly venueMic: string;
  readonly calendarDate: string;
  readonly sessionOpen: UtcInstant;
  readonly sessionClose: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly temporalGraphNodeId: string | null;
};

export type CorporateActionSchedule = {
  readonly announcementTime: UtcInstant | null;
  readonly exDate: UtcInstant | null;
  readonly recordDate: UtcInstant | null;
  readonly paymentDate: UtcInstant | null;
  readonly knowableAt: UtcInstant;
};

export type CorporateAction = {
  readonly actionId: string;
  readonly instrumentIdentityId: string;
  readonly kind: CorporateActionKind;
  readonly schedule: CorporateActionSchedule;
  /** Split ratio numerator when kind is SPLIT or REVERSE_SPLIT (e.g. 4 for 4:1). */
  readonly splitNumerator: number | null;
  readonly splitDenominator: number | null;
  readonly cashDividendMinorPerShare: bigint | null;
  readonly newTicker: string | null;
  readonly spinOffInstrumentIdentityId: string | null;
  readonly mergerTargetInstrumentIdentityId: string | null;
  readonly evidenceRefs: readonly string[];
};

export type ContractLifecycle = {
  readonly contractLifecycleId: string;
  readonly instrumentIdentityId: string;
  readonly underlyingInstrumentIdentityId: string | null;
  readonly expiry: UtcInstant | null;
  readonly firstNotice: UtcInstant | null;
  readonly lastTrade: UtcInstant | null;
  readonly delivery: UtcInstant | null;
  readonly multiplierMinorUnits: bigint | null;
  readonly multiplierScale: number;
  readonly tickSizeMinorUnits: bigint | null;
  readonly tickSizeScale: number;
  readonly optionStrikeMinorUnits: bigint | null;
  readonly optionStrikeScale: number;
  readonly putCall: OptionPutCall | null;
  readonly knowableAt: UtcInstant;
};

export type InstrumentMasterRecord = {
  readonly schema: typeof HELIOS_MD06_INSTRUMENT_MASTER_SCHEMA;
  readonly masterVersion: number;
  readonly identities: readonly InstrumentIdentity[];
  readonly listings: readonly InstrumentListing[];
  readonly venueInstruments: readonly VenueInstrument[];
  readonly tradingSessions: readonly TradingSession[];
  readonly corporateActions: readonly CorporateAction[];
  readonly contractLifecycles: readonly ContractLifecycle[];
};

export type RawPriceBar = {
  readonly seriesKind: 'RAW';
  readonly instrumentIdentityId: string;
  readonly barTime: UtcInstant;
  readonly openMinor: bigint;
  readonly highMinor: bigint;
  readonly lowMinor: bigint;
  readonly closeMinor: bigint;
  readonly volume: bigint;
  readonly observationId: string;
  readonly knowableAt: UtcInstant;
};

export type AdjustedResearchBar = {
  readonly seriesKind: 'ADJUSTED_RESEARCH';
  readonly instrumentIdentityId: string;
  readonly barTime: UtcInstant;
  readonly openMinor: bigint;
  readonly highMinor: bigint;
  readonly lowMinor: bigint;
  readonly closeMinor: bigint;
  readonly volume: bigint;
  readonly derivedFromObservationIds: readonly string[];
  readonly adjustmentFactorScaled: bigint;
  readonly adjustmentFactorScale: number;
  readonly knowableAt: UtcInstant;
};

export type PriceBar = RawPriceBar | AdjustedResearchBar;

export type AppendRawBarInput = Omit<RawPriceBar, 'seriesKind'>;

export type InstrumentMasterSnapshot = InstrumentMasterRecord & {
  readonly rawBars: readonly RawPriceBar[];
  readonly adjustedBars: readonly AdjustedResearchBar[];
  readonly sealedAt: UtcInstant;
};
