/**
 * M03 — HELIOS futures contract and roll architecture.
 *
 * Execution must always resolve to a specific executable contract.
 * Synthetic continuous series are research-only and never executable.
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';

export const FUTURES_SCHEMA = 'sunrey.helios.futures.v1' as const;

export const ROLL_STATES = ['FRONT', 'BACK', 'ROLLING', 'POST_ROLL'] as const;
export type RollState = (typeof ROLL_STATES)[number];

export const EXECUTABILITY_CLASSES = ['EXECUTABLE', 'RESEARCH_ONLY', 'NON_EXECUTABLE'] as const;
export type ExecutabilityClass = (typeof EXECUTABILITY_CLASSES)[number];

export type FuturesContractMetadata = {
  readonly contractMonth: string;
  readonly expirationDate: UtcInstant;
  readonly firstNoticeDate: UtcInstant | null;
  readonly lastTradeDate: UtcInstant;
  readonly settlementDate: UtcInstant | null;
  readonly multiplierMinorUnits: bigint;
  readonly multiplierScale: number;
  readonly tickSizeMinorUnits: bigint;
  readonly tickSizeScale: number;
  readonly currency: string;
  readonly exchange: string;
  readonly rootSymbol: string;
};

export type FuturesFamilyIdentity = {
  readonly kind: 'futures_family';
  readonly familyId: string;
  readonly exchange: string;
  readonly rootSymbol: string;
  readonly displayName: string;
  readonly currency: string;
  readonly unit: string;
};

export type FuturesContractIdentity = {
  readonly kind: 'futures_contract';
  readonly contractId: string;
  readonly familyId: string;
  readonly contractMonth: string;
  readonly metadata: FuturesContractMetadata;
  readonly executability: 'EXECUTABLE';
};

export type FuturesContinuousIdentity = {
  readonly kind: 'futures_continuous';
  readonly continuousId: string;
  readonly familyId: string;
  readonly rollMethod: 'front_month' | 'volume_weighted';
  readonly executability: 'RESEARCH_ONLY';
};

export type RollContext = {
  readonly familyId: string;
  readonly rollState: RollState;
  readonly frontContractId: string;
  readonly backContractId: string | null;
  readonly rollWindowStart: UtcInstant | null;
  readonly rollWindowEnd: UtcInstant | null;
  readonly evaluatedAt: UtcInstant;
};

export type FirstNoticeAssessment = {
  readonly contractId: string;
  readonly firstNoticeDate: UtcInstant | null;
  readonly daysUntilFirstNotice: number | null;
  readonly withinFirstNoticeWindow: boolean;
  readonly requiresRoll: boolean;
  readonly message: string | null;
};
