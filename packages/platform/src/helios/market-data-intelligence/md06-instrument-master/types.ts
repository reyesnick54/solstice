/**
 * MD06 domain records — reference intelligence only.
 */

import type { UtcInstant } from '@solstice/domain';

import type { HELIOS_MD06_INSTRUMENT_MASTER_SCHEMA } from './taxonomy.ts';
import type {
  InstrumentIdentifierSystem,
  Md06CorporateActionKind,
  OptionPutCall,
  PriceSeriesKind,
} from './taxonomy.ts';

export type InstrumentIdentifier = {
  readonly system: InstrumentIdentifierSystem;
  readonly value: string;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveTo: UtcInstant | null;
  readonly knowableAt: UtcInstant;
};

/** Stable identity; never equals a bare ticker string. */
export type InstrumentIdentity = {
  readonly instrumentIdentityId: string;
  readonly displayName: string;
  readonly assetClass: string;
  readonly identifiers: readonly InstrumentIdentifier[];
  readonly temporalGraphSecurityNodeId: string | null;
  readonly grantsExecutionAuthority: false;
};

export type InstrumentListing = {
  readonly listingId: string;
  readonly instrumentIdentityId: string;
  readonly ticker: string;
  readonly mic: string | null;
  readonly currency: string;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveTo: UtcInstant | null;
  readonly knowableAt: UtcInstant;
  readonly temporalGraphListingNodeId: string | null;
  readonly grantsExecutionAuthority: false;
};

export type VenueInstrument = {
  readonly venueInstrumentId: string;
  readonly instrumentIdentityId: string;
  readonly listingId: string | null;
  readonly venueId: string;
  readonly mic: string;
  readonly exchangeNativeId: string;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveTo: UtcInstant | null;
  readonly knowableAt: UtcInstant;
  readonly temporalGraphVenueInstrumentNodeId: string | null;
  readonly grantsExecutionAuthority: false;
};

export type TradingSession = {
  readonly sessionId: string;
  readonly venueId: string;
  readonly mic: string;
  readonly sessionName: string;
  readonly openTimeUtc: string;
  readonly closeTimeUtc: string;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveTo: UtcInstant | null;
  readonly knowableAt: UtcInstant;
  readonly temporalGraphSessionNodeId: string | null;
  readonly grantsExecutionAuthority: false;
};

export type CorporateActionSchedule = {
  readonly announcementTime: UtcInstant | null;
  readonly exDate: UtcInstant | null;
  readonly recordDate: UtcInstant | null;
  readonly paymentDate: UtcInstant | null;
  readonly knowableAt: UtcInstant;
};

export type CorporateAction = CorporateActionSchedule & {
  readonly corporateActionId: string;
  readonly instrumentIdentityId: string;
  readonly kind: Md06CorporateActionKind;
  readonly ratioNumerator: number | null;
  readonly ratioDenominator: number | null;
  readonly cashAmountMinor: bigint | null;
  readonly currency: string | null;
  readonly fromTicker: string | null;
  readonly toTicker: string | null;
  readonly grantsExecutionAuthority: false;
};

export type ContractLifecycle = {
  readonly contractLifecycleId: string;
  readonly instrumentIdentityId: string;
  readonly underlyingInstrumentIdentityId: string | null;
  readonly expiry: UtcInstant;
  readonly firstNotice: UtcInstant | null;
  readonly lastTrade: UtcInstant | null;
  readonly delivery: UtcInstant | null;
  readonly multiplier: number;
  readonly tickSize: number;
  readonly optionStrike: number | null;
  readonly putCall: OptionPutCall | null;
  readonly knowableAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
};

export type InstrumentMaster = {
  readonly schemaVersion: typeof HELIOS_MD06_INSTRUMENT_MASTER_SCHEMA;
  readonly identities: readonly InstrumentIdentity[];
  readonly listings: readonly InstrumentListing[];
  readonly venueInstruments: readonly VenueInstrument[];
  readonly tradingSessions: readonly TradingSession[];
  readonly corporateActions: readonly CorporateAction[];
  readonly contractLifecycles: readonly ContractLifecycle[];
  readonly grantsExecutionAuthority: false;
};

export type RawPriceObservation = {
  readonly observationId: string;
  readonly instrumentIdentityId: string;
  readonly seriesKind: 'RAW';
  readonly eventTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly closeMinor: bigint;
  readonly volume: bigint;
  readonly immutable: true;
};

export type AdjustedResearchPricePoint = {
  readonly pointId: string;
  readonly instrumentIdentityId: string;
  readonly seriesKind: 'ADJUSTED_RESEARCH';
  readonly eventTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly closeMinor: bigint;
  readonly adjustmentFactor: number;
  readonly derivedFromRawObservationIds: readonly string[];
};

export type ResolvedListingAt = {
  readonly instrumentIdentityId: string;
  readonly listing: InstrumentListing | null;
  readonly ticker: string | null;
  readonly resolutionState: 'RESOLVED' | 'AMBIGUOUS' | 'UNRESOLVED';
};

export type ResolvedVenueMapping = {
  readonly instrumentIdentityId: string | null;
  readonly venueInstrument: VenueInstrument | null;
  readonly resolutionState: 'RESOLVED' | 'EXPIRED' | 'UNRESOLVED';
};

export type PriceSeriesView = {
  readonly seriesKind: PriceSeriesKind;
  readonly instrumentIdentityId: string;
  readonly points: readonly { readonly eventTime: UtcInstant; readonly closeMinor: bigint }[];
  readonly grantsExecutionAuthority: false;
};
