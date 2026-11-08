/**
 * HELIOS Forward Alpha — ALPHA09 risk-adjusted return and tail evidence (types).
 */

import type { Ratio } from '@solstice/risk';
import type { UtcInstant } from '@solstice/domain';

import type {
  ALPHA09_TAIL_CONFIDENCE_BPS,
  Alpha09HorizonClass,
  HELIOS_ALPHA09_RISK_ADJUSTED_EVIDENCE_BLOCKED,
  HELIOS_ALPHA09_RISK_ADJUSTED_EVIDENCE_QUALIFIED,
  HELIOS_ALPHA09_SCHEMA,
} from './taxonomy.ts';

/** Scale-8 simple period return units (see `@solstice/risk` RATIO_UNIT). */
export type Alpha09PeriodReturnUnits = bigint;

export type ForwardAlpha09TradeObservation = {
  readonly tradeId: string;
  readonly instrumentId: string;
  readonly sectorId: string;
  readonly monthKey: string;
  readonly eventId: string;
  readonly realizedPnlMinor: bigint;
  readonly closedAt: UtcInstant;
};

export type ForwardAlpha09MeasureInput = {
  readonly schema: typeof HELIOS_ALPHA09_SCHEMA;
  readonly strategyId: string;
  readonly horizonClass: Alpha09HorizonClass;
  readonly observationDays: number;
  readonly startingCapitalMinor: bigint;
  readonly endingCapitalMinor: bigint;
  readonly periodReturns: readonly Alpha09PeriodReturnUnits[];
  readonly trades: readonly ForwardAlpha09TradeObservation[];
  readonly benchmarkPeriodReturns?: readonly Alpha09PeriodReturnUnits[];
  /** Per-period risk-free return in scale-8 units; defaults to zero. */
  readonly riskFreePeriodReturnUnits?: Alpha09PeriodReturnUnits;
  readonly sealedAt: UtcInstant;
};

export type ForwardPerformanceState = {
  readonly schema: 'sunrey.helios.forward-alpha.forward-performance-state.v1';
  readonly totalReturn: Ratio;
  readonly annualizedReturn: Ratio | null;
  readonly annualizedReturnMethod: 'LINEAR_EXTRAPOLATION_365_DAY' | null;
  readonly winRate: Ratio | null;
  readonly payoffRatio: Ratio | null;
  readonly profitFactor: Ratio | null;
  readonly largestGainMinor: bigint;
  readonly largestLossMinor: bigint;
  readonly periodCount: number;
  readonly tradeCount: number;
  readonly futureReturnGuarantee: false;
};

export type ForwardRiskState = {
  readonly schema: 'sunrey.helios.forward-alpha.forward-risk-state.v1';
  readonly volatility: Ratio | null;
  readonly volatilityMethod: 'SAMPLE_STDDEV_INTEGER_RETURNS' | null;
  readonly sharpe: Ratio | null;
  readonly sharpeMethod: 'EXCESS_RETURN_OVER_SAMPLE_STDDEV_ANNUALIZED_SQRT' | null;
  readonly sortino: Ratio | null;
  readonly sortinoMethod: 'EXCESS_RETURN_OVER_DOWNSIDE_DEVIATION_ANNUALIZED_SQRT' | null;
  readonly informationRatio: Ratio | null;
  readonly informationRatioMethod: 'ACTIVE_RETURN_OVER_TRACKING_ERROR' | null;
  readonly calmar: Ratio | null;
  readonly calmarMethod: 'ANNUALIZED_RETURN_OVER_MAX_DRAWDOWN' | null;
  readonly maximumDrawdown: Ratio;
  readonly drawdownDurationPeriods: number;
  readonly downsideDeviation: Ratio | null;
  readonly downsideDeviationMethod: 'TARGET_SEMIDEVIATION_POPULATION' | null;
  readonly futureLossGuarantee: false;
};

export type ForwardTailState = {
  readonly schema: 'sunrey.helios.forward-alpha.forward-tail-state.v1';
  readonly tailConfidenceBps: typeof ALPHA09_TAIL_CONFIDENCE_BPS;
  readonly expectedShortfall: Ratio | null;
  readonly expectedShortfallMethod: 'HISTORICAL_TAIL_MEAN' | null;
  readonly skew: number | null;
  readonly kurtosisExcess: number | null;
  readonly distributionMomentsMethod: 'SAMPLE_MOMENTS_ENGINEERING' | null;
  readonly futureTailGuarantee: false;
};

export type ForwardAlpha09ConcentrationState = {
  readonly schema: 'sunrey.helios.forward-alpha.concentration-state.v1';
  readonly totalAttributedPnlMinor: bigint;
  readonly topTradeShare: Ratio;
  readonly top5TradesShare: Ratio;
  readonly topInstrumentShare: Ratio;
  readonly topSectorShare: Ratio;
  readonly topMonthShare: Ratio;
  readonly topEventShare: Ratio;
  /** When true, one slice still explains most of the net result — not a repeatable-profit narrative. */
  readonly singleSliceDominance: boolean;
  readonly repeatabilityClaimBlocked: boolean;
};

export type ForwardAlpha09TrackRecordAssessment = {
  readonly schema: 'sunrey.helios.forward-alpha.track-record.v1';
  readonly horizonClass: Alpha09HorizonClass;
  readonly observationDays: number;
  readonly independentOpportunityCount: number;
  readonly periodCount: number;
  readonly requiredMinimumCalendarDays: number;
  readonly requiredMinimumOpportunities: number;
  readonly requiredMinimumPeriodsForSharpe: number;
  readonly requiredMinimumPeriodsForTailEs: number;
  readonly meetsDurationRequirement: boolean;
  readonly meetsOpportunityRequirement: boolean;
  readonly adequateForSharpeStyleMetrics: boolean;
  readonly adequateForTailEvidence: boolean;
  readonly notes: readonly string[];
};

export type ForwardAlpha09RiskAdjustedEvidence = {
  readonly schema: typeof HELIOS_ALPHA09_SCHEMA;
  readonly strategyId: string;
  readonly performance: ForwardPerformanceState;
  readonly risk: ForwardRiskState;
  readonly tail: ForwardTailState;
  readonly concentration: ForwardAlpha09ConcentrationState;
  readonly trackRecord: ForwardAlpha09TrackRecordAssessment;
  readonly qualificationMarker:
    | typeof HELIOS_ALPHA09_RISK_ADJUSTED_EVIDENCE_QUALIFIED
    | typeof HELIOS_ALPHA09_RISK_ADJUSTED_EVIDENCE_BLOCKED;
  readonly grantsExecutionAuthority: false;
  readonly simulationOnly: true;
  readonly researchOnly: true;
  readonly sealedAt: UtcInstant;
};
