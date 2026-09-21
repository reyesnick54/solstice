import type { UtcInstant } from '@solstice/domain';
import {
  GOLD_ETF_GLD_ID,
  GOLD_FUTURES_GCZ2026_ID,
  GOLD_REFERENCE_ID,
  HELIOS_COMMODITY_OBSERVATION_SCHEMA,
  HELIOS_COMMODITY_QUALIFIED_TIMEFRAMES,
  WTI_COMMODITY_REFERENCE_ID,
  WTI_FUTURES_CLM2026_ID,
  WTI_OIL_ETF_PROXY_ID,
} from '../multi-asset/constants.ts';
import {
  DEFAULT_M11_FAST_MA_PERIODS,
  DEFAULT_M11_MAX_ADVERSE_EXCURSION_BPS,
  DEFAULT_M11_MAX_HOLDING_PERIOD_HOURS,
  DEFAULT_M11_MAX_OBSERVATION_AGE_MS,
  DEFAULT_M11_MAX_REALIZED_VOLATILITY_BPS,
  DEFAULT_M11_MAX_SPREAD_BPS,
  DEFAULT_M11_MIN_HISTORY_BARS,
  DEFAULT_M11_MIN_LIQUIDITY_SCORE,
  DEFAULT_M11_MIN_REALIZED_VOLATILITY_BPS,
  DEFAULT_M11_MIN_ROC_BPS,
  DEFAULT_M11_RECOMMENDED_EXPOSURE_UNITS,
  DEFAULT_M11_SLOW_MA_PERIODS,
  DEFAULT_M11_TRAILING_STOP_VOL_MULTIPLIER,
  HELIOS_M11_CAPSULE_ID,
  HELIOS_M11_FAMILY_ID,
  HELIOS_M11_RULE_ID,
} from '../commodity-trend/constants.ts';
import { asStrategyCapsuleVersion } from './ids.ts';
import { computeStrategyCapsuleMaterialHash } from './fingerprint.ts';
import type {
  StrategyCapsuleMaterial,
  StrategyCapsuleRecord,
  StrategyCapsuleScope,
} from './types.ts';

export const HELIOS_M11_COMMODITY_TREND_FOLLOWING_V1 = HELIOS_M11_RULE_ID;

export function buildHeliosM11Material(): StrategyCapsuleMaterial {
  return Object.freeze({
    description: Object.freeze({
      strategyName: 'HELIOS M11 Gold and WTI Multi-Timeframe Trend Following',
      hypothesis:
        'Enter on confirmed 1h/4h directional trend with 1d context; exit on reversal, trailing volatility stop, MAE, roll, or governance invalidation.',
      economicRationale:
        'Trend persistence on qualified ETF proxies and specific futures contracts with liquidity, freshness, and roll gates; reference series inform signals only.',
      intendedEdge: 'Multi-timeframe trend following on Gold (GLD/GC) and WTI (USO/CL) qualified representations.',
      expectedOperatingRegime: 'Forward-paper and Strategy Lab replay on M07/M08 production-shaped commodity data.',
      knownFailureModes: Object.freeze([
        'Range-bound chop without directional confirmation',
        'Stale observations or provider outage',
        'Excessive realized volatility or wide spread',
        'Futures roll window restriction',
        'Synthetic continuous series mistaken for execution target',
        'Short direction blocked by mandate or jurisdiction',
      ]),
    }),
    instrumentUniverse: Object.freeze({
      supportedInstrumentClasses: Object.freeze(['COMMODITY', 'ETF', 'FUTURES']),
      instrumentIds: Object.freeze([
        GOLD_ETF_GLD_ID,
        GOLD_REFERENCE_ID,
        GOLD_FUTURES_GCZ2026_ID,
        WTI_OIL_ETF_PROXY_ID,
        WTI_COMMODITY_REFERENCE_ID,
        WTI_FUTURES_CLM2026_ID,
      ]),
      universeSelectionRules: Object.freeze([
        'M07_GOLD_QUALIFIED_REPRESENTATIONS',
        'M08_WTI_QUALIFIED_REPRESENTATIONS',
      ]),
      venues: Object.freeze(['COMEX', 'NYMEX', 'ARCX']),
      currencies: Object.freeze(['USD']),
      liquidityRequirements: Object.freeze(['REFERENCE_SPREAD_WITHIN_LIMIT', 'MIN_LIQUIDITY_SCORE']),
      eligibilityRestrictions: Object.freeze([
        'WORK_ORDER_ACTIVE',
        'CUSTOMER_MANDATE_VALID',
        'DECISION_VALIDITY_ENVELOPE',
        'FORWARD_PAPER_ONLY',
        'NO_CONTINUOUS_FUTURES_EXECUTION',
      ]),
    }),
    featureSpecification: Object.freeze({
      featureIds: Object.freeze([
        'ohlcv_1h',
        'ohlcv_4h',
        'ohlcv_1d_context',
        'rolling_trend',
        'moving_averages',
        'rate_of_change',
        'realized_volatility',
        'breakout_state',
        'relative_volume',
        'liquidity_score',
        'spread_bps',
        'market_state',
        'futures_roll_state',
        'market_regime',
        'session_state',
      ]),
      dataDependencies: Object.freeze([
        'sunrey.capital-market.gold.v1',
        'sunrey.helios.wti-energy.v1',
        'helios.commodity-ohlcv-multi-tf.v1',
        'helios.market_state',
        'helios.decision_validity_envelope',
        'helios.futures_roll_context',
      ]),
      observationTypes: Object.freeze(['COMMODITY_OHLCV_1H', 'COMMODITY_OHLCV_4H', 'REFERENCE_QUOTE']),
      lookbackWindows: Object.freeze([
        String(DEFAULT_M11_FAST_MA_PERIODS),
        String(DEFAULT_M11_SLOW_MA_PERIODS),
        String(DEFAULT_M11_MIN_HISTORY_BARS),
      ]),
      normalizationRules: Object.freeze(['minor_units_bigint', 'multi_timeframe_alignment']),
      transformationVersions: Object.freeze([HELIOS_COMMODITY_OBSERVATION_SCHEMA]),
      sourceProviderRequirements: Object.freeze(['GOLD_MARKET_M07', 'WTI_ENERGY_M08']),
      freshnessRequirements: Object.freeze([
        '1H_BAR_NOT_STALE',
        `MAX_AGE_MS_${DEFAULT_M11_MAX_OBSERVATION_AGE_MS}`,
      ]),
    }),
    modelDependencies: Object.freeze({
      grok: Object.freeze([]),
      s3m: Object.freeze([]),
      quantitative: Object.freeze([]),
      deterministicRuleId: HELIOS_M11_RULE_ID,
      deterministicRuleVersion: 'v1',
      featureEngineVersion: 'helios-commodity-trend-v1',
    }),
    decisionRule: Object.freeze({
      ruleType: 'COMMODITY_MULTI_TF_TREND_FOLLOWING',
      entryRule: Object.freeze({
        when:
          '1h/4h trend aligned AND ROC confirmed AND liquidity/spread/volatility within bounds AND fresh AND valid session AND non-expiring contract AND no roll restriction AND mandate permits direction',
        action: 'ENTER_LONG_OR_SHORT',
        fastMaPeriods: DEFAULT_M11_FAST_MA_PERIODS,
        slowMaPeriods: DEFAULT_M11_SLOW_MA_PERIODS,
        minRocBps: DEFAULT_M11_MIN_ROC_BPS,
        minHistoryBars: DEFAULT_M11_MIN_HISTORY_BARS,
        minLiquidityScore: DEFAULT_M11_MIN_LIQUIDITY_SCORE,
        recommendedExposureUnits: DEFAULT_M11_RECOMMENDED_EXPOSURE_UNITS,
        requiresOpenPosition: false,
      }),
      noActionRule: Object.freeze({
        when: 'range-bound, reference-only instrument, or entry/exit conditions not met',
        action: 'NO_ACTION',
      }),
      exitRule: Object.freeze({
        when:
          'trend_reversal OR trailing_vol_stop OR max_adverse_excursion OR max_holding_period OR futures_roll OR stale_data OR provider_degradation OR risk_forced_exit OR emergency_close OR customer_pause',
        action: 'EXIT',
        trailingStopVolMultiplier: DEFAULT_M11_TRAILING_STOP_VOL_MULTIPLIER,
        maxAdverseExcursionBps: DEFAULT_M11_MAX_ADVERSE_EXCURSION_BPS,
        maxHoldingPeriodHours: DEFAULT_M11_MAX_HOLDING_PERIOD_HOURS,
        recommendedExposureUnits: DEFAULT_M11_RECOMMENDED_EXPOSURE_UNITS,
        requiresOpenPosition: true,
      }),
      invalidationRule: Object.freeze({
        when:
          'stale OR provider_outage OR spread_exceeded OR volatility_out_of_bounds OR continuous_series_execution OR contract_expired OR roll_restriction OR work_order_inactive OR mandate_invalid OR envelope_invalid',
        action: 'NO_ACTION_OR_PROTECTIVE_EXIT',
      }),
      positionSizingRule: Object.freeze({
        quantityUnits: DEFAULT_M11_RECOMMENDED_EXPOSURE_UNITS,
        maximumConcurrentPositions: 2,
        authority: 'CANONICAL_RISK_ENGINE_META_ALLOCATOR',
        note: 'Capsule emits recommendedConfidenceBps only — no capital reservation',
      }),
      maximumExposureAssumptions: Object.freeze({
        maximumPortfolioAllocationPct: '2.00',
        sandboxAllocationBound: true,
        perInstrumentCapPct: '1.00',
      }),
      minimumEvidenceRequirements: Object.freeze({
        observationFreshness: 'fresh',
        providerHealth: 'healthy',
        workOrderState: 'ACTIVE',
        decisionValidityEnvelope: true,
        deterministicResearch: true,
      }),
    }),
    operatingAssumptions: Object.freeze({
      marketHours: Object.freeze(['GOLD_SESSION', 'WTI_SESSION', 'ETF_REGULAR_HOURS']),
      minimumLiquidity: 'MIN_LIQUIDITY_SCORE',
      quoteRequirements: Object.freeze(['1H_OHLCV', '4H_TREND_CONTEXT', 'BID_ASK_WHEN_AVAILABLE']),
      spreadLimitsBps: DEFAULT_M11_MAX_SPREAD_BPS,
      dataDelayAssumptionMs: 0,
      maximumObservationAgeMs: DEFAULT_M11_MAX_OBSERVATION_AGE_MS,
      orderTypeAssumptions: Object.freeze(['PAPER_SIMULATION']),
      executionModelAssumptions: Object.freeze(['helios-paper-fill-v1', 'strategy-lab-realistic-fill-v1']),
      accountSizeLimits: Object.freeze({ minimumSandboxMinor: '0' }),
      capacityAssumptions: Object.freeze(['SANDBOX_ALLOCATION_BOUND', 'RISK_ENGINE_SIZING']),
      qualifiedTimeframes: Object.freeze([...HELIOS_COMMODITY_QUALIFIED_TIMEFRAMES]),
      liveCommodityExecution: false,
      liveFuturesExecution: false,
    }),
    costModel: Object.freeze({
      commissionMinorPerShare: '0',
      spreadBps: 10,
      slippageBps: 15,
      exchangeFeesBps: 4,
      fundingBorrowCostBps: 0,
      marketDataCostAllocation: 'included_in_research_budget',
      inferenceResearchCostAllocation: 'zero_llm_inference',
      zeroCostForbidden: true,
    }),
    validity: Object.freeze({
      validFrom: null,
      expiresAt: null,
      regimeConstraints: Object.freeze(['PAPER', 'SIMULATION', 'SHADOW']),
      invalidatingConditions: Object.freeze([
        'OBSERVATION_STALE',
        'PROVIDER_OUTAGE',
        'SPREAD_EXCEEDED',
        'VOLATILITY_OUT_OF_BOUNDS',
        'FUTURES_ROLL_RESTRICTION',
        'SYNTHETIC_CONTINUOUS_EXECUTION_ATTEMPT',
      ]),
      modelVersionCompatibility: Object.freeze(['helios-commodity-trend-v1']),
      dataVersionCompatibility: Object.freeze([
        HELIOS_COMMODITY_OBSERVATION_SCHEMA,
        'sunrey.capital-market.gold.v1',
        'sunrey.helios.wti-energy.v1',
      ]),
    }),
    fixedQualifiedParameters: Object.freeze({
      fastMaPeriods: DEFAULT_M11_FAST_MA_PERIODS,
      slowMaPeriods: DEFAULT_M11_SLOW_MA_PERIODS,
      minHistoryBars: DEFAULT_M11_MIN_HISTORY_BARS,
      minRocBps: DEFAULT_M11_MIN_ROC_BPS,
      maxSpreadBps: DEFAULT_M11_MAX_SPREAD_BPS,
      minLiquidityScore: DEFAULT_M11_MIN_LIQUIDITY_SCORE,
      minRealizedVolatilityBps: DEFAULT_M11_MIN_REALIZED_VOLATILITY_BPS,
      maxRealizedVolatilityBps: DEFAULT_M11_MAX_REALIZED_VOLATILITY_BPS,
      maxHoldingPeriodHours: DEFAULT_M11_MAX_HOLDING_PERIOD_HOURS,
      trailingStopVolMultiplier: DEFAULT_M11_TRAILING_STOP_VOL_MULTIPLIER,
      maxAdverseExcursionBps: DEFAULT_M11_MAX_ADVERSE_EXCURSION_BPS,
      maximumPortfolioAllocationPct: '2.00',
      maximumPositionSizeUnits: DEFAULT_M11_RECOMMENDED_EXPOSURE_UNITS,
      maximumConcurrentPositions: 2,
      horizonDays: 30,
    }),
  });
}

export function buildHeliosM11StrategyCapsule(input: {
  readonly createdAt: UtcInstant;
  readonly createdBy: string;
  readonly scope?: StrategyCapsuleScope;
  readonly customerId?: string | null;
  readonly qualificationState?: StrategyCapsuleRecord['qualificationState'];
  readonly workOrderId?: string | null;
}): StrategyCapsuleRecord {
  const scope = input.scope ?? 'GLOBAL';
  const material = buildHeliosM11Material();
  return Object.freeze({
    strategyCapsuleId: HELIOS_M11_CAPSULE_ID,
    strategyFamilyId: HELIOS_M11_FAMILY_ID,
    version: asStrategyCapsuleVersion('1'),
    parentVersion: null,
    scope,
    customerId: scope === 'CUSTOMER_SCOPED' ? (input.customerId ?? null) : null,
    environment: 'PAPER',
    createdAt: input.createdAt,
    createdBy: input.createdBy,
    lineage: Object.freeze({
      workOrderId: input.workOrderId ?? null,
      researchLineageRefs: Object.freeze(['helios-multi-asset-m11-commodity-trend']),
      parentProposalIds: Object.freeze([]),
    }),
    material,
    evidence: Object.freeze({
      researchResultRefs: Object.freeze([]),
      observationRefs: Object.freeze([]),
      provenanceRefs: Object.freeze(['m07-gold-market-data', 'm08-wti-energy-data']),
      sourceIndependenceNotes: Object.freeze([
        'deterministic_research_no_llm',
        'reference_and_continuous_series_not_execution_targets',
      ]),
      knownContradictions: Object.freeze([]),
      rejectedEvidenceRefs: Object.freeze([]),
      evidenceVaultRefs: Object.freeze([]),
    }),
    qualificationState: input.qualificationState ?? 'EVALUATION_PENDING',
    qualificationAt: null,
    materialHash: computeStrategyCapsuleMaterialHash(material, scope),
    frozen: false,
    evaluationRefs: Object.freeze([]),
    simulationOnly: true,
    llmDeployable: false,
  });
}

export {
  HELIOS_M11_CAPSULE_ID,
  HELIOS_M11_FAMILY_ID,
  HELIOS_M11_RULE_ID,
} from '../commodity-trend/constants.ts';
