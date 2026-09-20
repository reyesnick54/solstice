import type { UtcInstant } from '../../../domain/src/time.ts';
import { asStrategyCapsuleId, asStrategyCapsuleVersion, asStrategyFamilyId } from './ids.ts';
import { computeStrategyCapsuleMaterialHash } from './fingerprint.ts';
import {
  CRYPTO_BTC_USD_ASSET_ID,
  CRYPTO_ETH_USD_ASSET_ID,
  HELIOS_CRYPTO_OBSERVATION_SCHEMA,
  HELIOS_CRYPTO_QUALIFIED_TIMEFRAMES,
} from '../multi-asset/constants.ts';
import {
  DEFAULT_M10_BREAKOUT_BUFFER_BPS,
  DEFAULT_M10_ENTRY_QUANTITY_UNITS,
  DEFAULT_M10_LOOKBACK_PERIODS,
  DEFAULT_M10_MAX_HOLDING_PERIOD_HOURS,
  DEFAULT_M10_MAX_OBSERVATION_AGE_MS,
  DEFAULT_M10_MAX_REALIZED_VOLATILITY_BPS,
  DEFAULT_M10_MAX_SPREAD_BPS,
  DEFAULT_M10_MIN_REALIZED_VOLATILITY_BPS,
  DEFAULT_M10_PERSISTENCE_BARS,
  HELIOS_M10_RULE_ID,
  DEFAULT_M10_TRAILING_STOP_VOL_MULTIPLIER,
  DEFAULT_M10_VOLUME_RATIO_THRESHOLD,
  HELIOS_M10_CAPSULE_ID,
  HELIOS_M10_FAMILY_ID,
} from '../crypto-momentum/constants.ts';
import type {
  StrategyCapsuleMaterial,
  StrategyCapsuleRecord,
  StrategyCapsuleScope,
} from './types.ts';

export const HELIOS_M10_CRYPTO_MOMENTUM_BREAKOUT_V1 = HELIOS_M10_RULE_ID;

export function buildHeliosM10Material(): StrategyCapsuleMaterial {
  return Object.freeze({
    description: Object.freeze({
      strategyName: 'HELIOS M10 Crypto Volume-Confirmed Momentum Breakout',
      hypothesis:
        'Enter on 1h breakout above rolling range with volume confirmation; exit on trailing stop, momentum failure, or timeout.',
      economicRationale:
        'Trend continuation after validated range expansion with liquidity and freshness gates; false-breakout controls reduce whipsaw.',
      intendedEdge: 'Volume-confirmed momentum breakout on BTC/USD and ETH/USD reference OHLCV.',
      expectedOperatingRegime: 'Forward-paper and Strategy Lab replay on production-shaped crypto reference data.',
      knownFailureModes: Object.freeze([
        'Breakout without volume confirmation',
        'False breakout / close inside range',
        'Stale observations or provider outage',
        'Excessive realized volatility or wide spread',
        'Momentum failure after entry',
        'Maximum holding period timeout',
      ]),
    }),
    instrumentUniverse: Object.freeze({
      supportedInstrumentClasses: Object.freeze(['CRYPTO']),
      instrumentIds: Object.freeze([CRYPTO_BTC_USD_ASSET_ID, CRYPTO_ETH_USD_ASSET_ID]),
      universeSelectionRules: Object.freeze(['M06_CRYPTO_REFERENCE_USD_PAIRS']),
      venues: Object.freeze(['CRYPTO_REFERENCE']),
      currencies: Object.freeze(['USD']),
      liquidityRequirements: Object.freeze(['REFERENCE_SPREAD_WITHIN_LIMIT', 'SUFFICIENT_1H_VOLUME']),
      eligibilityRestrictions: Object.freeze([
        'WORK_ORDER_ACTIVE',
        'CUSTOMER_MANDATE_VALID',
        'DECISION_VALIDITY_ENVELOPE',
        'FORWARD_PAPER_ONLY',
      ]),
    }),
    featureSpecification: Object.freeze({
      featureIds: Object.freeze([
        'ohlcv_1h',
        'rolling_price_range',
        'relative_volume',
        'realized_volatility',
        'spread_bps',
        'market_state',
        'freshness',
        'provider_health',
        'market_regime',
      ]),
      dataDependencies: Object.freeze([
        'sunrey.crypto-market-reference.v1',
        'helios.crypto-ohlcv-1h.v1',
        'helios.market_state',
        'helios.decision_validity_envelope',
      ]),
      observationTypes: Object.freeze(['CRYPTO_OHLCV_1H', 'REFERENCE_QUOTE']),
      lookbackWindows: Object.freeze([String(DEFAULT_M10_LOOKBACK_PERIODS)]),
      normalizationRules: Object.freeze(['minor_units_bigint', 'volume_relative_to_rolling_mean']),
      transformationVersions: Object.freeze([HELIOS_CRYPTO_OBSERVATION_SCHEMA]),
      sourceProviderRequirements: Object.freeze(['CRYPTO_MARKET_REFERENCE_M06']),
      freshnessRequirements: Object.freeze(['1H_BAR_NOT_STALE', `MAX_AGE_MS_${DEFAULT_M10_MAX_OBSERVATION_AGE_MS}`]),
    }),
    modelDependencies: Object.freeze({
      grok: Object.freeze([]),
      s3m: Object.freeze([]),
      quantitative: Object.freeze([]),
      deterministicRuleId: HELIOS_M10_RULE_ID,
      deterministicRuleVersion: 'v1',
      featureEngineVersion: 'helios-crypto-momentum-v1',
    }),
    decisionRule: Object.freeze({
      ruleType: 'CRYPTO_MOMENTUM_BREAKOUT_1H',
      entryRule: Object.freeze({
        when:
          'close > rolling_range_high + breakout_buffer AND relative_volume >= threshold AND spread <= max AND volatility within bounds AND fresh AND provider healthy AND persistence confirmed',
        action: 'BUY',
        lookbackPeriods: DEFAULT_M10_LOOKBACK_PERIODS,
        breakoutBufferBps: DEFAULT_M10_BREAKOUT_BUFFER_BPS,
        volumeRatioThreshold: DEFAULT_M10_VOLUME_RATIO_THRESHOLD,
        persistenceBars: DEFAULT_M10_PERSISTENCE_BARS,
        minimumCloseBeyondBreakout: 'computed_from_buffer',
        quantityUnits: DEFAULT_M10_ENTRY_QUANTITY_UNITS,
        requiresOpenPosition: false,
      }),
      noActionRule: Object.freeze({
        when: 'entry or exit conditions not met or invalidated',
        action: 'NO_ACTION',
      }),
      exitRule: Object.freeze({
        when:
          'trailing_stop OR momentum_failure OR max_holding_period OR emergency_close OR risk_forced_exit OR stale_data',
        action: 'SELL',
        trailingStopVolMultiplier: DEFAULT_M10_TRAILING_STOP_VOL_MULTIPLIER,
        maxHoldingPeriodHours: DEFAULT_M10_MAX_HOLDING_PERIOD_HOURS,
        quantityUnits: DEFAULT_M10_ENTRY_QUANTITY_UNITS,
        requiresOpenPosition: true,
      }),
      invalidationRule: Object.freeze({
        when:
          'stale OR provider_outage OR spread_exceeded OR volatility_out_of_bounds OR work_order_inactive OR mandate_invalid OR envelope_invalid',
        action: 'NO_ACTION_OR_PROTECTIVE_EXIT',
      }),
      positionSizingRule: Object.freeze({
        quantityUnits: DEFAULT_M10_ENTRY_QUANTITY_UNITS,
        maximumConcurrentPositions: 1,
        authority: 'CANONICAL_RISK_ENGINE_META_ALLOCATOR',
      }),
      maximumExposureAssumptions: Object.freeze({
        maximumPortfolioAllocationPct: '1.50',
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
      marketHours: Object.freeze(['CRYPTO_24X7']),
      minimumLiquidity: 'REFERENCE_SPREAD_WITHIN_LIMIT',
      quoteRequirements: Object.freeze(['1H_OHLCV', 'BID_ASK_WHEN_AVAILABLE']),
      spreadLimitsBps: DEFAULT_M10_MAX_SPREAD_BPS,
      dataDelayAssumptionMs: 0,
      maximumObservationAgeMs: DEFAULT_M10_MAX_OBSERVATION_AGE_MS,
      orderTypeAssumptions: Object.freeze(['PAPER_SIMULATION']),
      executionModelAssumptions: Object.freeze(['helios-paper-fill-v1', 'strategy-lab-realistic-fill-v1']),
      accountSizeLimits: Object.freeze({ minimumSandboxMinor: '0' }),
      capacityAssumptions: Object.freeze(['SANDBOX_ALLOCATION_BOUND', 'RISK_ENGINE_SIZING']),
      qualifiedTimeframes: Object.freeze([...HELIOS_CRYPTO_QUALIFIED_TIMEFRAMES]),
      liveCryptoExecution: false,
    }),
    costModel: Object.freeze({
      commissionMinorPerShare: '0',
      spreadBps: 8,
      slippageBps: 12,
      exchangeFeesBps: 5,
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
        'WORK_ORDER_INACTIVE',
      ]),
      modelVersionCompatibility: Object.freeze(['helios-crypto-momentum-v1']),
      dataVersionCompatibility: Object.freeze([HELIOS_CRYPTO_OBSERVATION_SCHEMA, 'sunrey.crypto-market-reference.v1']),
    }),
    fixedQualifiedParameters: Object.freeze({
      lookbackPeriods: DEFAULT_M10_LOOKBACK_PERIODS,
      breakoutBufferBps: DEFAULT_M10_BREAKOUT_BUFFER_BPS,
      volumeRatioThreshold: DEFAULT_M10_VOLUME_RATIO_THRESHOLD,
      maxSpreadBps: DEFAULT_M10_MAX_SPREAD_BPS,
      minRealizedVolatilityBps: DEFAULT_M10_MIN_REALIZED_VOLATILITY_BPS,
      maxRealizedVolatilityBps: DEFAULT_M10_MAX_REALIZED_VOLATILITY_BPS,
      maxHoldingPeriodHours: DEFAULT_M10_MAX_HOLDING_PERIOD_HOURS,
      maximumPortfolioAllocationPct: '1.50',
      maximumPositionSizeUnits: DEFAULT_M10_ENTRY_QUANTITY_UNITS,
      maximumConcurrentPositions: 1,
      horizonDays: 30,
    }),
  });
}

export function buildHeliosM10StrategyCapsule(input: {
  readonly createdAt: UtcInstant;
  readonly createdBy: string;
  readonly scope?: StrategyCapsuleScope;
  readonly customerId?: string | null;
  readonly qualificationState?: StrategyCapsuleRecord['qualificationState'];
  readonly workOrderId?: string | null;
}): StrategyCapsuleRecord {
  const scope = input.scope ?? 'GLOBAL';
  const material = buildHeliosM10Material();
  return Object.freeze({
    strategyCapsuleId: HELIOS_M10_CAPSULE_ID,
    strategyFamilyId: HELIOS_M10_FAMILY_ID,
    version: asStrategyCapsuleVersion('1'),
    parentVersion: null,
    scope,
    customerId: scope === 'CUSTOMER_SCOPED' ? (input.customerId ?? null) : null,
    environment: 'PAPER',
    createdAt: input.createdAt,
    createdBy: input.createdBy,
    lineage: Object.freeze({
      workOrderId: input.workOrderId ?? null,
      researchLineageRefs: Object.freeze(['helios-multi-asset-m10-crypto-momentum']),
      parentProposalIds: Object.freeze([]),
    }),
    material,
    evidence: Object.freeze({
      researchResultRefs: Object.freeze([]),
      observationRefs: Object.freeze([]),
      provenanceRefs: Object.freeze(['m06-crypto-market-reference']),
      sourceIndependenceNotes: Object.freeze(['deterministic_research_no_llm', 'reference_only_not_execution']),
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
  HELIOS_M10_CAPSULE_ID,
  HELIOS_M10_FAMILY_ID,
  HELIOS_M10_RULE_ID,
} from '../crypto-momentum/constants.ts';
