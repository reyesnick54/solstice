/**
 * HELIOS EARN02 — provider-neutral ingestion ports (simulation adapters only).
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { EarningsExternalObservation } from './types.ts';

/** SEC EDGAR — first-class public-source adapter port. */
export type SecEdgarEarningsPort = {
  readonly providerId: 'sec-edgar';
  readonly fetchEarningsFilings: (input: {
    readonly canonicalEntityId: string;
    readonly cik: string;
    readonly asOfKnowableCutoff: UtcInstant;
  }) => Promise<readonly EarningsExternalObservation[]>;
};

export type IssuerIrEarningsPort = {
  readonly providerId: string;
  readonly fetchRelease: (input: {
    readonly canonicalEntityId: string;
    readonly fiscalPeriodLabel: string;
    readonly asOfKnowableCutoff: UtcInstant;
  }) => Promise<readonly EarningsExternalObservation[]>;
};

export type EarningsCalendarPort = {
  readonly providerId: string;
  readonly fetchScheduledEvents: (input: {
    readonly canonicalEntityId: string;
    readonly from: UtcInstant;
    readonly to: UtcInstant;
    readonly asOfKnowableCutoff: UtcInstant;
  }) => Promise<readonly EarningsExternalObservation[]>;
};

export type AnalystEstimatePort = {
  readonly providerId: string;
  readonly fetchEstimates: (input: {
    readonly canonicalEntityId: string;
    readonly fiscalPeriodLabel: string;
    readonly asOfKnowableCutoff: UtcInstant;
  }) => Promise<readonly EarningsExternalObservation[]>;
};

export type TranscriptPort = {
  readonly providerId: string;
  readonly fetchTranscript: (input: {
    readonly canonicalEntityId: string;
    readonly fiscalPeriodLabel: string;
    readonly asOfKnowableCutoff: UtcInstant;
  }) => Promise<readonly EarningsExternalObservation[]>;
};

export type EarningsMarketDataPort = {
  readonly providerId: string;
  readonly fetchMarketReaction: (input: {
    readonly canonicalEntityId: string;
    readonly fiscalPeriodLabel: string;
    readonly asOfKnowableCutoff: UtcInstant;
  }) => Promise<readonly EarningsExternalObservation[]>;
};

export type EarningsOptionsPort = {
  readonly providerId: string;
  readonly fetchOptionsReaction: (input: {
    readonly canonicalEntityId: string;
    readonly fiscalPeriodLabel: string;
    readonly asOfKnowableCutoff: UtcInstant;
  }) => Promise<readonly EarningsExternalObservation[]>;
};

export type EarningsDataPorts = {
  readonly secEdgar?: SecEdgarEarningsPort;
  readonly issuerIr?: IssuerIrEarningsPort;
  readonly calendar?: EarningsCalendarPort;
  readonly analyst?: AnalystEstimatePort;
  readonly transcript?: TranscriptPort;
  readonly marketData?: EarningsMarketDataPort;
  readonly options?: EarningsOptionsPort;
};
