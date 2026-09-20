/**
 * M03 — canonical futures contract architecture.
 *
 * Distinct from ETF, spot/reference, and continuous research series.
 * Execution requires a specific qualified contract identity.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';

export const FUTURES_SETTLEMENT_TYPES = ['PHYSICAL', 'CASH', 'UNKNOWN'] as const;
export type FuturesSettlementType = (typeof FUTURES_SETTLEMENT_TYPES)[number];

export const FUTURES_ROLL_STATES = [
  'FRONT',
  'SECOND',
  'BACK',
  'EXPIRED',
  'UNKNOWN',
] as const;
export type FuturesRollState = (typeof FUTURES_ROLL_STATES)[number];

export const FUTURES_IDENTITY_KINDS = [
  'family',
  'specific_contract',
  'continuous_research',
] as const;
export type FuturesIdentityKind = (typeof FUTURES_IDENTITY_KINDS)[number];

export const FUTURES_CONTRACT_MONTHS = [
  'F', 'G', 'H', 'J', 'K', 'M', 'N', 'Q', 'U', 'V', 'X', 'Z',
] as const;
export type FuturesContractMonthCode = (typeof FUTURES_CONTRACT_MONTHS)[number];

export type FuturesVenue = {
  readonly venueId: string;
  readonly mic: string | null;
  readonly displayName: string;
  readonly exchange: string | null;
};

export type FuturesContractSpec = {
  readonly contractId: string;
  readonly rootSymbol: string;
  readonly contractMonthCode: FuturesContractMonthCode;
  readonly contractYear: number;
  readonly venue: FuturesVenue;
  readonly currency: string;
  readonly multiplierMinorUnits: bigint;
  readonly multiplierScale: number;
  readonly tickSizeMinorUnits: bigint;
  readonly tickSizeScale: number;
  readonly settlementType: FuturesSettlementType;
  readonly expirationDate: UtcInstant;
  readonly firstNoticeDate: UtcInstant | null;
  readonly lastTradeDate: UtcInstant;
  readonly identityKind: 'specific_contract';
  readonly executable: true;
};

export type FuturesFamilySpec = {
  readonly familyId: string;
  readonly rootSymbol: string;
  readonly venue: FuturesVenue;
  readonly currency: string;
  readonly defaultMultiplierMinorUnits: bigint;
  readonly defaultMultiplierScale: number;
  readonly defaultSettlementType: FuturesSettlementType;
  readonly identityKind: 'family';
  readonly executable: false;
};

export type ContinuousResearchSeriesSpec = {
  readonly seriesId: string;
  readonly rootSymbol: string;
  readonly familyId: string;
  readonly venue: FuturesVenue;
  readonly currency: string;
  readonly rollMethodology: string;
  readonly identityKind: 'continuous_research';
  /** Continuous research series are never executable. */
  readonly executable: false;
};

export type FuturesRollSnapshot = {
  readonly familyId: string;
  readonly frontContractId: string;
  readonly secondContractId: string | null;
  readonly rollState: FuturesRollState;
  readonly evaluatedAt: UtcInstant;
};

export type FuturesContractMetadata = FuturesContractSpec | FuturesFamilySpec | ContinuousResearchSeriesSpec;

export function isExecutableFuturesIdentity(metadata: FuturesContractMetadata): boolean {
  return metadata.identityKind === 'specific_contract' && metadata.executable === true;
}

export function isContinuousResearchSeries(metadata: FuturesContractMetadata): boolean {
  return metadata.identityKind === 'continuous_research';
}
