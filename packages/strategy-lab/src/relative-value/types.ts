import type { UtcInstant } from '@solstice/domain';
import type { M12PairId } from './ids.ts';

export const M12_PAIR_VALIDATION_OUTCOMES = [
  'QUALIFIED',
  'INSUFFICIENT_HISTORY',
  'UNSTABLE_RELATIONSHIP',
  'STRUCTURAL_BREAK',
  'CORRELATION_COLLAPSE',
  'REGIME_MISMATCH',
  'LIQUIDITY_INSUFFICIENT',
  'SPREAD_TOO_WIDE',
  'ASSET_CLASS_MISMATCH',
  'PROVIDER_DEGRADED',
  'TIMESTAMP_MISMATCH',
  'COINTEGRATION_REJECTED',
  'CORRELATION_NOT_ARBITRAGE',
] as const;
export type M12PairValidationOutcome = (typeof M12_PAIR_VALIDATION_OUTCOMES)[number];

export const M12_COINTEGRATION_OUTCOMES = [
  'NOT_RUN',
  'SUPPORTED',
  'INCONCLUSIVE',
  'REJECTED',
] as const;
export type M12CointegrationOutcome = (typeof M12_COINTEGRATION_OUTCOMES)[number];

export type M12BarObservation = {
  readonly instrumentId: string;
  readonly barInterval: '1h';
  readonly sourceEventTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly closeMinor: bigint;
  readonly bidMinor: bigint | null;
  readonly askMinor: bigint | null;
  readonly spreadBps: bigint | null;
  readonly available: boolean;
  readonly providerId: string;
  readonly providerSequence: number;
  readonly providerHealth: 'healthy' | 'degraded' | 'unavailable';
  readonly observationId: string;
};

export type M12RelationshipSnapshot = {
  readonly pairId: M12PairId;
  readonly asOf: UtcInstant;
  readonly hedgeRatioScaled: bigint;
  readonly spreadMinor: bigint;
  readonly spreadMeanMinor: bigint;
  readonly spreadVolBps: bigint;
  readonly spreadZScoreScaled: bigint;
  readonly rollingCorrelationScaled: bigint;
  readonly cointegrationOutcome: M12CointegrationOutcome;
  readonly historyBars: number;
  readonly synchronized: boolean;
};

export type M12PairValidationResult = {
  readonly pairId: M12PairId;
  readonly outcome: M12PairValidationOutcome;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly relationship: M12RelationshipSnapshot | null;
  readonly validatedAt: UtcInstant;
};

export const M12_PROPOSAL_ACTIONS = ['ENTER_SPREAD', 'EXIT_SPREAD', 'HOLD_SPREAD', 'NO_ACTION'] as const;
export type M12ProposalAction = (typeof M12_PROPOSAL_ACTIONS)[number];

export const M12_EXIT_REASONS = [
  'MEAN_REVERSION_TARGET',
  'STOP_LOSS',
  'TIME_STOP',
  'CORRELATION_COLLAPSE',
  'SPREAD_WIDENING',
  'STRATEGY_INVALIDATION',
  'FORCED_UNWIND',
  'NONE',
] as const;
export type M12ExitReason = (typeof M12_EXIT_REASONS)[number];

export type M12StrategyLeg = {
  readonly instrumentId: string;
  readonly direction: 'BUY' | 'SELL';
  readonly relativeWeightBps: number;
};

export type M12StrategyProposal = {
  readonly proposalId: string;
  readonly pairId: M12PairId;
  readonly action: M12ProposalAction;
  readonly legs: readonly M12StrategyLeg[];
  readonly expectedHedgeRelationship: string;
  readonly evidence: readonly string[];
  readonly invalidatingConditions: readonly string[];
  readonly spreadZScoreScaled: bigint | null;
  readonly rollingCorrelationScaled: bigint | null;
  readonly exitReason: M12ExitReason;
  readonly rationale: string;
  readonly decidedAt: UtcInstant;
  readonly parameterVersion: string;
  readonly grantsFinancialEffect: false;
  readonly sizingAuthority: 'EXTERNAL_META_ALLOCATOR';
};

export type M12OpenSpreadPosition = {
  readonly pairId: M12PairId;
  readonly direction: 'LONG_SPREAD' | 'SHORT_SPREAD';
  readonly entryBarIndex: number;
  readonly entryZScoreScaled: bigint;
  readonly openedAt: UtcInstant;
};

export type M12EvaluationContext = {
  readonly workOrderActive: boolean;
  readonly mandateActive: boolean;
  readonly envelopeValid: boolean;
  readonly pairEligible: boolean;
  readonly forceClose: boolean;
  readonly strategyInvalidated: boolean;
};
