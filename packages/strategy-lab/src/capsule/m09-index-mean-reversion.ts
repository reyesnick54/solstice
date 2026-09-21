import type { UtcInstant } from '@solstice/domain';
import { M09_INSTRUMENT_UNIVERSE, M09_BAR_INTERVAL } from '../m09/ids.ts';
import { M09_PARAMETERS_V1 } from '../m09/parameters.ts';
import { HELIOS_M09_INDEX_MEAN_REVERSION_RULE_ID } from '../m09/rule.ts';
import { asStrategyCapsuleId, asStrategyCapsuleVersion, asStrategyFamilyId } from './ids.ts';
import { computeStrategyCapsuleMaterialHash } from './fingerprint.ts';
import type {
  StrategyCapsuleMaterial,
  StrategyCapsuleRecord,
  StrategyCapsuleScope,
} from './types.ts';

export const HELIOS_M09_RULE_ID = HELIOS_M09_INDEX_MEAN_REVERSION_RULE_ID;
export const HELIOS_M09_FAMILY_ID = asStrategyFamilyId('sfam_helios_m09_index_mean_reversion');
export const HELIOS_M09_CAPSULE_ID = asStrategyCapsuleId('scap_helios_m09_index_mean_reversion_v1');

export function buildHeliosM09Material(): StrategyCapsuleMaterial {
  const params = M09_PARAMETERS_V1;
  return Object.freeze({
    description: Object.freeze({
      strategyName: 'HELIOS M09 15-Minute Index Mean Reversion',
      hypothesis:
        'Volatility-normalized dislocations from a rolling reference on SPY/QQQ 15-minute bars revert within bounded horizons.',
      economicRationale:
        'Short-horizon index ETF dislocations against a rolling mean, normalized by recent realized volatility, with explicit liquidity and session gates.',
      intendedEdge: 'Temporary liquidity-driven deviation from rolling fair value on liquid index ETFs.',
      expectedOperatingRegime: 'Regular US cash session with fresh 15-minute bar evidence on SPY and QQQ.',
      knownFailureModes: Object.freeze([
        'Persistent trend / regime shift',
        'Stale or gap-filled bar history',
        'Spread widening beyond strategy tolerance',
        'Extreme realized volatility',
        'End-of-session flat rule',
      ]),
    }),
    instrumentUniverse: Object.freeze({
      supportedInstrumentClasses: Object.freeze(['ETF', 'INDEX_ETF']),
      instrumentIds: M09_INSTRUMENT_UNIVERSE,
      universeSelectionRules: Object.freeze(['HELIOS_M09_MULTI_ASSET_INDEX_UNIVERSE']),
      venues: Object.freeze(['ARCX', 'XNAS']),
      currencies: Object.freeze(['USD']),
      liquidityRequirements: Object.freeze(['SPREAD_WITHIN_LIMIT', 'SESSION_OPEN']),
      eligibilityRestrictions: Object.freeze([
        'RESEARCH_ELIGIBLE',
        'WORK_ORDER_ACTIVE',
        'MANDATE_ACTIVE',
        'DECISION_VALIDITY_ENVELOPE',
      ]),
    }),
    featureSpecification: Object.freeze({
      featureIds: Object.freeze([
        'close_15m',
        'rolling_mean_15m',
        'volatility_normalized_deviation',
        'realized_volatility_bps',
        'spread_bps',
        'liquidity_state',
        'market_state',
        'market_regime',
        'session_state',
      ]),
      dataDependencies: Object.freeze([
        'helios.multi_asset.bar_15m',
        'helios.market_observation.freshness',
      ]),
      observationTypes: Object.freeze(['BAR_15M', 'QUOTE']),
      lookbackWindows: Object.freeze([
        String(params.rollingWindowBars),
        String(params.volWindowBars),
      ]),
      normalizationRules: Object.freeze(['volatility_normalized_z_score_scaled']),
      transformationVersions: Object.freeze(['helios-m09-feature-v1']),
      sourceProviderRequirements: Object.freeze(['HELIOS_CAPITAL_MARKET_15M']),
      freshnessRequirements: Object.freeze(['BAR_NOT_STALE', 'KNOWABLE_AT_RESPECTED']),
    }),
    modelDependencies: Object.freeze({
      grok: Object.freeze([]),
      s3m: Object.freeze([]),
      quantitative: Object.freeze([]),
      deterministicRuleId: HELIOS_M09_RULE_ID,
      deterministicRuleVersion: params.version,
      featureEngineVersion: 'helios-m09-feature-v1',
    }),
    decisionRule: Object.freeze({
      ruleType: 'VOLATILITY_NORMALIZED_MEAN_REVERSION',
      entryRule: Object.freeze({
        when: 'z_score <= -entryZScoreThreshold AND history >= minHistoryBars AND spread <= maxSpreadBps AND vol <= maxRealizedVolBps',
        action: 'BUY',
        entryZScoreThresholdScaled: params.entryZScoreThresholdScaled.toString(),
        minHistoryBars: params.minHistoryBars,
        maxSpreadBps: params.maxSpreadBps.toString(),
        maxRealizedVolBps: params.maxRealizedVolBps.toString(),
        requiresOpenPosition: false,
      }),
      noActionRule: Object.freeze({
        when: 'entry preconditions fail OR no eligible instrument',
        action: 'NO_ACTION',
      }),
      exitRule: Object.freeze({
        when: 'mean_reversion_target OR time_stop OR vol_stop OR end_of_session OR invalidation OR forced_close',
        action: 'SELL',
        exitZScoreTargetScaled: params.exitZScoreTargetScaled.toString(),
        maxHoldBars: params.maxHoldBars,
        endOfSessionFlat: params.endOfSessionFlat,
        requiresOpenPosition: true,
      }),
      invalidationRule: Object.freeze({
        when: 'bar_stale OR envelope_invalid OR strategy_invalidated OR work_order_inactive',
        action: 'NO_ACTION',
      }),
      positionSizingRule: Object.freeze({
        sizingAuthority: 'EXTERNAL_META_ALLOCATOR',
        recommendedExposureOnly: true,
        maxRecommendedExposureBps: params.maxRecommendedExposureBps,
        maximumConcurrentPositions: 2,
      }),
      maximumExposureAssumptions: Object.freeze({
        maximumPortfolioAllocationPct: '2.00',
        sandboxAllocationBound: true,
      }),
      minimumEvidenceRequirements: Object.freeze({
        barInterval: M09_BAR_INTERVAL,
        deterministicResearch: true,
        decisionValidityEnvelope: true,
      }),
    }),
    operatingAssumptions: Object.freeze({
      marketHours: Object.freeze(['US_CASH_SESSION_15M']),
      minimumLiquidity: 'INDEX_ETF_NORMAL',
      quoteRequirements: Object.freeze(['BID_ASK', 'BAR_CLOSE']),
      spreadLimitsBps: Number(params.maxSpreadBps),
      dataDelayAssumptionMs: 3_000,
      maximumObservationAgeMs: params.maxObservationAgeMs,
      orderTypeAssumptions: Object.freeze(['MARKET_SIMULATION']),
      executionModelAssumptions: Object.freeze(['helios-eval-fill-v1']),
      accountSizeLimits: Object.freeze({ minimumSandboxMinor: '0' }),
      capacityAssumptions: Object.freeze(['SANDBOX_ALLOCATION_BOUND', 'META_ALLOCATOR_CAP']),
    }),
    costModel: Object.freeze({
      commissionMinorPerShare: '1',
      spreadBps: 5,
      slippageBps: 8,
      exchangeFeesBps: 0,
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
        'BAR_STALE',
        'ENVELOPE_EXPIRED',
        'STRATEGY_REVOKED',
        'PARAMETER_VERSION_MISMATCH',
      ]),
      modelVersionCompatibility: Object.freeze(['helios-m09-feature-v1']),
      dataVersionCompatibility: Object.freeze(['helios-m09-bar-15m-v1']),
    }),
    marketRegimePreferences: Object.freeze({
      permittedRegimes: Object.freeze([
        'RANGE_BOUND',
        'NORMAL_VOLATILITY',
        'LOW_VOLATILITY',
        'NORMAL_LIQUIDITY',
      ]),
      prohibitedRegimes: Object.freeze(['LIQUIDITY_STRESS', 'HIGH_VOLATILITY', 'TRENDING_UP', 'TRENDING_DOWN']),
      preferredRegimes: Object.freeze(['RANGE_BOUND', 'LOW_VOLATILITY']),
    }),
    fixedQualifiedParameters: Object.freeze({
      maximumPortfolioAllocationPct: '2.00',
      maximumPositionSizeUnits: '0',
      maximumConcurrentPositions: 2,
      horizonDays: 30,
    }),
  });
}

export function buildHeliosM09StrategyCapsule(input: {
  readonly createdAt: UtcInstant;
  readonly createdBy: string;
  readonly scope?: StrategyCapsuleScope;
  readonly customerId?: string | null;
  readonly qualificationState?: StrategyCapsuleRecord['qualificationState'];
  readonly workOrderId?: string | null;
  readonly parameterVersion?: string;
}): StrategyCapsuleRecord {
  const scope = input.scope ?? 'GLOBAL';
  const material = buildHeliosM09Material();
  return Object.freeze({
    strategyCapsuleId: HELIOS_M09_CAPSULE_ID,
    strategyFamilyId: HELIOS_M09_FAMILY_ID,
    version: asStrategyCapsuleVersion('1'),
    parentVersion: null,
    scope,
    customerId: scope === 'CUSTOMER_SCOPED' ? (input.customerId ?? null) : null,
    environment: 'PAPER',
    createdAt: input.createdAt,
    createdBy: input.createdBy,
    lineage: Object.freeze({
      workOrderId: input.workOrderId ?? null,
      researchLineageRefs: Object.freeze(['helios-multi-asset-m09-index-mean-reversion']),
      parentProposalIds: Object.freeze([]),
    }),
    material,
    evidence: Object.freeze({
      researchResultRefs: Object.freeze([]),
      observationRefs: Object.freeze([]),
      provenanceRefs: Object.freeze([]),
      sourceIndependenceNotes: Object.freeze(['deterministic_research_no_llm']),
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
