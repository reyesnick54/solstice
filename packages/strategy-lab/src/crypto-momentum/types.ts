import type { UtcInstant } from '@solstice/domain';

import type { CryptoMomentumBreakoutConfig, HELIOS_M10_RULE_ID } from './constants.ts';

export type CryptoMomentumFreshnessStatus = 'fresh' | 'aging' | 'stale' | 'expired' | 'unknown';
export type CryptoMomentumProviderHealth = 'healthy' | 'degraded' | 'unavailable';

export type CryptoMomentumBar = {
  readonly instrumentId: string;
  readonly periodStart: UtcInstant;
  readonly openMinor: bigint;
  readonly highMinor: bigint;
  readonly lowMinor: bigint;
  readonly closeMinor: bigint;
  readonly volumeMinor: bigint;
  readonly bidMinor: bigint | null;
  readonly askMinor: bigint | null;
};

export type CryptoMomentumMarketState = {
  readonly regime: string | null;
  readonly freshnessStatus: CryptoMomentumFreshnessStatus;
  readonly observationAgeMs: number;
  readonly providerHealth: CryptoMomentumProviderHealth;
  readonly spreadBps: number;
  readonly relativeVolumeRatio: number;
  readonly rollingRangeHighMinor: bigint;
  readonly rollingRangeLowMinor: bigint;
  readonly realizedVolatilityBps: number;
};

export type CryptoMomentumGovernance = {
  readonly workOrderActive: boolean;
  readonly customerMandateValid: boolean;
  readonly decisionValidityEnvelopeValid: boolean;
};

export type CryptoMomentumPosition = {
  readonly hasOpenPosition: boolean;
  readonly entryAt: UtcInstant | null;
  readonly entryPriceMinor: bigint | null;
  readonly highWaterMarkMinor: bigint | null;
};

export type CryptoMomentumBreakoutControls = {
  readonly persistenceBarsConfirmed: number;
  readonly minimumCloseBeyondBreakoutMinor: bigint;
};

export type CryptoMomentumForcedExit = {
  readonly emergencyClose?: boolean;
  readonly riskForcedExit?: boolean;
};

export type CryptoMomentumDecision = {
  readonly strategyId: typeof HELIOS_M10_RULE_ID;
  readonly action: 'BUY' | 'SELL' | 'NO_ACTION';
  readonly instrumentId: string;
  readonly quantityUnits: string;
  readonly rationale: string;
  readonly ruleVersion: string;
  readonly invalidationReason: string | null;
  readonly exitReason: string | null;
  readonly closeMinor: string;
  readonly rollingRangeHighMinor: string;
  readonly relativeVolumeRatio: number;
  readonly spreadBps: number;
  readonly realizedVolatilityBps: number;
  readonly decidedAt: UtcInstant;
};

export type CryptoMomentumEvaluateInput = {
  readonly strategyId: typeof HELIOS_M10_RULE_ID;
  readonly instrumentId: string;
  readonly bar: CryptoMomentumBar;
  readonly market: CryptoMomentumMarketState;
  readonly governance: CryptoMomentumGovernance;
  readonly position: CryptoMomentumPosition;
  readonly controls: CryptoMomentumBreakoutControls;
  readonly forced?: CryptoMomentumForcedExit;
  readonly now: UtcInstant;
  readonly config?: Partial<CryptoMomentumBreakoutConfig>;
};

export type { CryptoMomentumBreakoutConfig };
