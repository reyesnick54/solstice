/**
 * Consumption bindings for upstream HELIOS intelligence — no second fundamentals engine.
 */

import type { UtcInstant } from '@solstice/domain';
import type { PointInTimeFundamentalSnapshot } from '../feature-fabric/fundamental-types.ts';
import type { ValuationInputSource } from './taxonomy.ts';

export type SecFundamentalsBinding = {
  readonly source: Extract<ValuationInputSource, 'sec_point_in_time_fundamentals'>;
  readonly snapshotRef: string;
  readonly evaluationTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
};

export type Earn09ProbabilisticStateBinding = {
  readonly source: Extract<ValuationInputSource, 'earn09_probabilistic_earnings_state'>;
  readonly stateRef: string;
  readonly evaluationTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
};

export type AafV2FeatureFabricBinding = {
  readonly source: Extract<ValuationInputSource, 'aaf_v2_universal_feature_fabric'>;
  readonly manifestRef: string;
  readonly compilerVersion: string;
  readonly evaluationTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
};

export type MacroYieldRateBinding = {
  readonly source: Extract<ValuationInputSource, 'macro_intelligence_yield_rates'>;
  readonly seriesKey: string;
  readonly observationRef: string;
  readonly valueMinor: bigint;
  readonly knowableAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
};

export type StrategyLabResearchBinding = {
  readonly source: Extract<ValuationInputSource, 'strategy_lab_research'>;
  readonly strategyEvaluationId: string;
  readonly qualificationRef: string;
  readonly knowableAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
};

export type ValuationInputManifest = {
  readonly manifestId: string;
  readonly evaluationTime: UtcInstant;
  readonly secFundamentals: SecFundamentalsBinding | null;
  readonly earn09State: Earn09ProbabilisticStateBinding | null;
  readonly aafV2Fabric: AafV2FeatureFabricBinding | null;
  readonly macroYields: readonly MacroYieldRateBinding[];
  readonly strategyLab: StrategyLabResearchBinding | null;
  readonly grantsExecutionAuthority: false;
};

export function bindSecFundamentalsSnapshot(input: {
  readonly snapshot: PointInTimeFundamentalSnapshot;
}): SecFundamentalsBinding {
  const knowableAt = input.snapshot.evaluationTimeUtc;
  return Object.freeze({
    source: 'sec_point_in_time_fundamentals',
    snapshotRef: `os10.fundamentals.${input.snapshot.canonicalEntityId}.${knowableAt}`,
    evaluationTime: knowableAt,
    knowableAt,
    grantsExecutionAuthority: false,
  });
}
