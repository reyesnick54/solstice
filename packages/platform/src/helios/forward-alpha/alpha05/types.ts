import type { UtcInstant } from '@solstice/domain';
import type { Ratio } from '@solstice/risk';

import type {
  AlphaDecompositionBucket,
  ForwardBenchmarkKind,
  HELIOS_ALPHA05_SCHEMA,
  ALPHA05_RULE_FLAGS,
} from './taxonomy.ts';

export type BenchmarkPriceObservation = {
  readonly at: UtcInstant;
  readonly instrumentId: string;
  readonly closeMinor: bigint;
};

export type ForwardBenchmark = {
  readonly schema: typeof HELIOS_ALPHA05_SCHEMA;
  readonly benchmarkId: string;
  readonly campaignId: string;
  readonly kind: ForwardBenchmarkKind;
  readonly methodology: string;
  readonly referenceId: string | null;
  readonly selectedBeforeCampaignAt: UtcInstant;
  readonly campaignStartsAt: UtcInstant;
  readonly frozenHash: string;
  readonly rules: typeof ALPHA05_RULE_FLAGS;
};

export type BenchmarkPortfolio = {
  readonly schema: typeof HELIOS_ALPHA05_SCHEMA;
  readonly benchmarkId: string;
  readonly campaignId: string;
  readonly kind: ForwardBenchmarkKind;
  readonly currency: string;
  readonly startingCapitalMinor: bigint;
  readonly endingCapitalMinor: bigint;
  readonly equity: readonly { readonly at: UtcInstant; readonly totalMinor: bigint }[];
};

export type ReturnAttributionMetrics = {
  readonly absoluteReturn: Ratio;
  readonly benchmarkReturn: Ratio;
  readonly activeReturn: Ratio;
  readonly trackingError: Ratio | null;
  readonly informationRatio: Ratio | null;
};

export type BenchmarkComparison = {
  readonly schema: typeof HELIOS_ALPHA05_SCHEMA;
  readonly comparisonId: string;
  readonly campaignId: string;
  readonly forwardBenchmark: ForwardBenchmark;
  readonly benchmarkPortfolio: BenchmarkPortfolio;
  readonly strategyStartingCapitalMinor: bigint;
  readonly strategyEndingCapitalMinor: bigint;
  readonly metrics: ReturnAttributionMetrics;
  readonly methodology: string;
  readonly computedAt: UtcInstant;
};

export type AlphaAttribution = {
  readonly schema: typeof HELIOS_ALPHA05_SCHEMA;
  readonly attributionId: string;
  readonly campaignId: string;
  readonly comparison: BenchmarkComparison;
  readonly metrics: ReturnAttributionMetrics;
  readonly attributableSkillAlpha: Ratio;
  readonly excludedNonAlpha: Ratio;
  readonly rules: typeof ALPHA05_RULE_FLAGS;
  readonly computedAt: UtcInstant;
};

export type AlphaDecompositionLine = {
  readonly bucket: AlphaDecompositionBucket;
  readonly contribution: Ratio;
  readonly countsAsSkillAlpha: boolean;
  readonly leverageDriven?: boolean;
  readonly sectorConcentrationDriven?: boolean;
  readonly cryptoBetaDriven?: boolean;
};

export type AlphaDecomposition = {
  readonly schema: typeof HELIOS_ALPHA05_SCHEMA;
  readonly decompositionId: string;
  readonly campaignId: string;
  readonly attribution: AlphaAttribution;
  readonly lines: readonly AlphaDecompositionLine[];
  readonly skillAlpha: Ratio;
  readonly nonAlpha: Ratio;
  readonly residualCheck: Ratio;
  readonly rules: typeof ALPHA05_RULE_FLAGS;
  readonly computedAt: UtcInstant;
};
