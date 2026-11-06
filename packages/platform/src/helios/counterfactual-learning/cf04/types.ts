import type {
  Cf04BaselineModelKind,
  Cf04LiquidityBucket,
  Cf04QuantileLevel,
  Cf04RegimeLabel,
  HELIOS_CF04_OUTCOME_MODEL_SCHEMA,
  OutcomeDimensionKey,
} from './taxonomy.ts';

/** Point-in-time feature row; inputs must be AAF-certified upstream. */
export type AafCertifiedFeatureRow = {
  readonly featureId: string;
  readonly certifiedAtUtcMs: number;
  readonly certificationMarker: string;
  readonly values: readonly number[];
};

/**
 * Strict point-in-time observation: features knowable at `asOfUtcMs`, realized outcomes
 * at `outcomeObservedUtcMs` (held-out for training splits).
 */
export type CounterfactualTrainingRow = {
  readonly rowId: string;
  readonly asOfUtcMs: number;
  readonly outcomeObservedUtcMs: number;
  /** Issuer / instrument identifiers — used only for leakage guards, not as learnable features. */
  readonly issuerId: string;
  readonly instrumentId: string;
  readonly regime: Cf04RegimeLabel;
  readonly liquidityBucket: Cf04LiquidityBucket;
  readonly actionId: string;
  readonly features: AafCertifiedFeatureRow;
  /** Realized outcome vector for supervised fitting (simulation/backtest evidence). */
  readonly realized: OutcomeVector;
};

export type OutcomeVector = {
  readonly netReturn: number;
  readonly excessReturn: number;
  readonly drawdown: number;
  readonly realizedVolatility: number;
  readonly turnover: number;
  readonly transactionCost: number;
  readonly slippage: number;
  readonly capitalUsage: number;
  readonly tailLoss: number;
  readonly holdingPeriod: number;
  readonly capacityUsage: number;
};

export type OutcomeDimensionQuantiles = Partial<Record<Cf04QuantileLevel, number>>;

/** Per-dimension marginal quantiles (transparent baseline — not a full copula). */
export type OutcomeQuantileSurface = {
  readonly [K in OutcomeDimensionKey]?: OutcomeDimensionQuantiles;
};

export type OutcomeDistribution =
  | {
      readonly kind: 'QUANTILES';
      readonly quantiles: OutcomeQuantileSurface;
    }
  | {
      readonly kind: 'EMPIRICAL_SAMPLES';
      readonly samples: readonly OutcomeVector[];
    };

export type OutcomePrediction = {
  readonly schema: typeof HELIOS_CF04_OUTCOME_MODEL_SCHEMA;
  readonly alternativeActionId: string;
  readonly evaluationAsOfUtcMs: number;
  /** Point summary (typically central tendency); full risk picture requires `distribution`. */
  readonly point: OutcomeVector;
  readonly distribution: OutcomeDistribution;
  readonly baselineModelKind: Cf04BaselineModelKind;
  readonly researchOnly: true;
  readonly grantsExecutionAuthority: false;
};

export type ScalarMetricSummary = {
  readonly mae: number;
  readonly rmse: number;
};

/** Nominal quantile level → empirical coverage on validation folds. */
export type QuantileCoverageReport = Partial<Record<Cf04QuantileLevel, number>>;

export type RegimeCalibrationSlice = {
  readonly regime: Cf04RegimeLabel;
  readonly metrics: ScalarMetricSummary;
  readonly quantileCoverage: QuantileCoverageReport;
};

export type ActionCalibrationSlice = {
  readonly actionId: string;
  readonly metrics: ScalarMetricSummary;
  readonly quantileCoverage: QuantileCoverageReport;
};

export type LiquidityCalibrationSlice = {
  readonly liquidityBucket: Cf04LiquidityBucket;
  readonly metrics: ScalarMetricSummary;
  readonly quantileCoverage: QuantileCoverageReport;
};

/**
 * Aggregated calibration and diagnostics. `certifiedMarker` is only set when an external
 * certifier stamps the run — implementations never self-assert qualification here.
 */
export type OutcomeModelCalibration = {
  readonly global: ScalarMetricSummary & { readonly quantileCoverage: QuantileCoverageReport };
  readonly byRegime: readonly RegimeCalibrationSlice[];
  readonly byAction: readonly ActionCalibrationSlice[];
  readonly byLiquidityBucket: readonly LiquidityCalibrationSlice[];
  readonly certifierRole: 'EXTERNAL_MODEL_VALIDATION';
  readonly certifiedMarker?: string;
  readonly certifiedAtUtcMs?: number;
};

export type ChronologicalSplitPolicy = {
  readonly foldCount: number;
  /** Minimum training rows per fold (validation folds may be smaller). */
  readonly minTrainRows: number;
};

export type Cf04TrainingConstraints = {
  readonly requireChronologicalSplits: true;
  readonly requireCrossFitting: true;
  /** Drop rows whose issuer/instrument appears in valuation fold with overlapping future info. */
  readonly blockIssuerInstrumentLeakage: true;
  readonly requireAafCertifiedFeatures: true;
  readonly requireRegimeAwareValidation: true;
  readonly splitPolicy: ChronologicalSplitPolicy;
};

export type CounterfactualOutcomeModel = {
  readonly predict: (input: {
    readonly alternativeActionId: string;
    readonly evaluationAsOfUtcMs: number;
    readonly features: AafCertifiedFeatureRow;
    readonly regime: Cf04RegimeLabel;
    readonly liquidityBucket: Cf04LiquidityBucket;
  }) => OutcomePrediction;
  readonly describe: () => {
    readonly schema: typeof HELIOS_CF04_OUTCOME_MODEL_SCHEMA;
    readonly baselineKind: Cf04BaselineModelKind;
    readonly outcomeDimensions: readonly OutcomeDimensionKey[];
  };
};

export type CrossFitOutcomeModelOptions = {
  readonly baselineKind: Cf04BaselineModelKind;
  readonly constraints: Cf04TrainingConstraints;
  readonly ridgeLambda?: number;
};
