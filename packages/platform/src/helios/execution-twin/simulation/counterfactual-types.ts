/**
 * HELIOS CF08 — counterfactual result and validation types.
 */

import type { UtcInstant } from '@solstice/domain';

import type { Level2Snapshot, SubmitOrderRequest } from './types.ts';
import type {
  CounterfactualSimulationFidelityLevel,
  ResponsiveMarketModelKind,
} from './counterfactual-taxonomy.ts';

/** Record with every counterfactual run (all levels). */
export type CounterfactualRunProvenance = {
  readonly simulationFidelity: CounterfactualSimulationFidelityLevel;
  readonly modelVersion: string;
  readonly calibrationPeriodId: string;
  /** Epistemic uncertainty label for research consumers; not a live risk limit. */
  readonly uncertaintySummary: string;
  readonly modelKind: ResponsiveMarketModelKind;
  readonly modelId: string;
  readonly nonFactual: true;
};

export type MarketTrajectoryPoint = {
  readonly at: UtcInstant;
  readonly midPriceMinorUnits: bigint;
  readonly bestBidMinorUnits: bigint;
  readonly bestAskMinorUnits: bigint;
};

export type PassiveReplayOutcome = {
  readonly kind: 'PASSIVE_REPLAY';
  readonly observedTrajectory: readonly MarketTrajectoryPoint[];
  readonly marketImpactAssumed: false;
  readonly provenance: CounterfactualRunProvenance;
};

export type ExecutionTwinCounterfactualOutcome = {
  readonly kind: 'EXECUTION_TWIN';
  readonly fillFingerprint: string;
  /** OS03 fill pipeline: spread, fees, latency, partial fills, liquidity, slippage. */
  readonly usesNativeExecutionTwin: true;
  readonly provenance: CounterfactualRunProvenance;
};

export type ResponsiveMarketCounterfactualOutcome = {
  readonly kind: 'RESPONSIVE_MARKET_MODEL';
  readonly fillFingerprint: string;
  readonly adjustedBookFingerprint: string;
  readonly provenance: CounterfactualRunProvenance;
};

export type CounterfactualModeOutcome =
  | PassiveReplayOutcome
  | ExecutionTwinCounterfactualOutcome
  | ResponsiveMarketCounterfactualOutcome;

/** Validation dimensions for responsive (Level 3) models — scores are 0–100 rubric, research-only. */
export type ResponsiveModelValidationScores = {
  readonly realismScore: number;
  readonly counterfactualValidityScore: number;
  readonly responseSensitivityScore: number;
  readonly stylizedFactsScore: number;
  readonly impactCurveScore: number;
  readonly postTradeReversionScore: number;
};

export type CounterfactualValidationBundle = {
  readonly scores: ResponsiveModelValidationScores;
  readonly notes: string;
};

export type CounterfactualTripleRun = {
  readonly passiveReplay: PassiveReplayOutcome;
  readonly executionTwin: ExecutionTwinCounterfactualOutcome;
  readonly responsiveMarket: ResponsiveMarketCounterfactualOutcome;
  readonly validation: CounterfactualValidationBundle;
};

export type CounterfactualScenarioInput = {
  readonly calibrationPeriodId: string;
  readonly uncertaintySummary: string;
  readonly instrumentId: string;
  readonly trajectorySnapshots: readonly Level2Snapshot[];
  readonly hypotheticalOrder: SubmitOrderRequest;
};
