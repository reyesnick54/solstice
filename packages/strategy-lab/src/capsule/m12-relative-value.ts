import type { UtcInstant } from '@solstice/domain';
import {
  HELIOS_M12_CAPSULE_ID,
  HELIOS_M12_FAMILY_ID,
  HELIOS_M12_RULE_ID,
} from '../relative-value/constants.ts';
import { M12_BAR_INTERVAL, M12_PAIR_UNIVERSE } from '../relative-value/ids.ts';
import { M12_PARAMETERS_V1 } from '../relative-value/parameters.ts';
import { asStrategyCapsuleVersion } from './ids.ts';
import { computeStrategyCapsuleMaterialHash } from './fingerprint.ts';

export { HELIOS_M12_CAPSULE_ID, HELIOS_M12_FAMILY_ID, HELIOS_M12_RULE_ID };
import type {
  StrategyCapsuleMaterial,
  StrategyCapsuleRecord,
  StrategyCapsuleScope,
} from './types.ts';

export function buildHeliosM12Material(): StrategyCapsuleMaterial {
  const params = M12_PARAMETERS_V1;
  return Object.freeze({
    description: Object.freeze({
      strategyName: 'HELIOS M12 Relative Value / Statistical Arbitrage',
      hypothesis:
        'Volatility-normalized spread dislocations between co-moving instrument pairs revert when relationship stability, liquidity, and synchronization gates pass.',
      economicRationale:
        'Pair spread z-score with rolling correlation, optional cointegration hook, and explicit identity/liquidity validation. Correlation alone does not imply arbitrage.',
      intendedEdge: 'Temporary relative-value dislocation between hedged legs with synchronized evidence.',
      expectedOperatingRegime: 'Liquid pairs with stable rolling correlation and synchronized 1h bar evidence.',
      knownFailureModes: Object.freeze([
        'Correlation collapse / structural break',
        'Spread widening beyond stop',
        'Asset-class identity mismatch (e.g. GLD vs continuous research series)',
        'Stale or skewed leg timestamps',
        'Partial multi-leg fill requiring unwind',
        'Provider degradation on one leg',
      ]),
    }),
    instrumentUniverse: Object.freeze({
      supportedInstrumentClasses: Object.freeze(['ETF', 'CRYPTO', 'ETF_PROXY', 'CONTINUOUS_RESEARCH']),
      instrumentIds: Object.freeze(M12_PAIR_UNIVERSE.flatMap((pairId) => {
        return [`pair:${pairId}`];
      })),
      universeSelectionRules: Object.freeze(['HELIOS_M12_RELATIVE_VALUE_PAIR_UNIVERSE']),
      venues: Object.freeze(['ARCX', 'XNAS', 'NATIVE', 'COMEX']),
      currencies: Object.freeze(['USD']),
      liquidityRequirements: Object.freeze(['PER_LEG_SPREAD_WITHIN_LIMIT', 'SYNCHRONIZED_TIMESTAMPS']),
      eligibilityRestrictions: Object.freeze([
        'RESEARCH_ELIGIBLE',
        'WORK_ORDER_ACTIVE',
        'MANDATE_ACTIVE',
        'DECISION_VALIDITY_ENVELOPE',
        'NO_UNCONTROLLED_LEVERAGE',
      ]),
    }),
    featureSpecification: Object.freeze({
      featureIds: Object.freeze([
        'pair_spread_1h',
        'spread_z_score_scaled',
        'rolling_correlation_scaled',
        'hedge_ratio_scaled',
        'spread_volatility_bps',
        'cointegration_hook',
        'leg_spread_bps',
        'provider_health',
      ]),
      dataDependencies: Object.freeze([
        'helios.multi_asset.bar_1h',
        'helios.market_observation.freshness',
        'helios.multi_asset.pair_synchronization',
      ]),
      observationTypes: Object.freeze(['BAR_1H', 'QUOTE']),
      lookbackWindows: Object.freeze([
        String(params.relationshipWindowBars),
        String(params.correlationWindowBars),
      ]),
      normalizationRules: Object.freeze(['volatility_normalized_spread_z_score']),
      transformationVersions: Object.freeze(['helios-m12-relationship-v1']),
      sourceProviderRequirements: Object.freeze(['HELIOS_CAPITAL_MARKET_1H', 'HELIOS_CRYPTO_MARKET_1H']),
      freshnessRequirements: Object.freeze(['BAR_NOT_STALE', 'KNOWABLE_AT_RESPECTED', 'LEG_TIMESTAMP_SYNC']),
    }),
    modelDependencies: Object.freeze({
      grok: Object.freeze([]),
      s3m: Object.freeze([]),
      quantitative: Object.freeze([]),
      deterministicRuleId: HELIOS_M12_RULE_ID,
      deterministicRuleVersion: params.version,
      featureEngineVersion: 'helios-m12-relationship-v1',
    }),
    decisionRule: Object.freeze({
      ruleType: 'RELATIVE_VALUE_STAT_ARB',
      entryRule: Object.freeze({
        when: 'pair_qualified AND |spread_z| >= entryZScoreThreshold AND correlation >= minRollingCorrelation',
        action: 'ENTER_SPREAD',
        entryZScoreThresholdScaled: params.entryZScoreThresholdScaled.toString(),
        minRollingCorrelationScaled: params.minRollingCorrelationScaled.toString(),
        minHistoryBars: params.minHistoryBars,
        requiresOpenPosition: false,
      }),
      noActionRule: Object.freeze({
        when: 'pair validation fails OR governance blocks OR deviation below threshold',
        action: 'NO_ACTION',
      }),
      exitRule: Object.freeze({
        when: 'mean_reversion_target OR stop OR time_stop OR correlation_collapse OR forced_unwind',
        action: 'EXIT_SPREAD',
        exitZScoreTargetScaled: params.exitZScoreTargetScaled.toString(),
        stopZScoreThresholdScaled: params.stopZScoreThresholdScaled.toString(),
        maxHoldBars: params.maxHoldBars,
        requiresOpenPosition: true,
      }),
      invalidationRule: Object.freeze({
        when: 'stale_leg OR provider_degraded OR timestamp_mismatch OR strategy_invalidated',
        action: 'NO_ACTION',
      }),
      positionSizingRule: Object.freeze({
        sizingAuthority: 'EXTERNAL_META_ALLOCATOR',
        recommendedExposureOnly: true,
        maxRecommendedExposureBps: params.maxRecommendedExposureBps,
        maximumConcurrentPositions: 3,
        leveragePermitted: false,
      }),
      maximumExposureAssumptions: Object.freeze({
        maximumPortfolioAllocationPct: '1.50',
        sandboxAllocationBound: true,
      }),
      minimumEvidenceRequirements: Object.freeze({
        barInterval: M12_BAR_INTERVAL,
        deterministicResearch: true,
        decisionValidityEnvelope: true,
        multiLegProposalRequired: true,
      }),
    }),
    operatingAssumptions: Object.freeze({
      marketHours: Object.freeze(['US_CASH_SESSION_1H', 'CRYPTO_24X7_1H']),
      minimumLiquidity: 'PAIR_LEG_NORMAL',
      quoteRequirements: Object.freeze(['BID_ASK', 'BAR_CLOSE', 'LEG_SYNC']),
      spreadLimitsBps: Number(params.maxSpreadBps),
      dataDelayAssumptionMs: 5_000,
      maximumObservationAgeMs: params.maxObservationAgeMs,
      orderTypeAssumptions: Object.freeze(['MARKET_SIMULATION']),
      executionModelAssumptions: Object.freeze(['helios-eval-fill-v1', 'helios-multi-leg-execution-risk-v1']),
      accountSizeLimits: Object.freeze({ minimumSandboxMinor: '0' }),
      capacityAssumptions: Object.freeze(['SANDBOX_ALLOCATION_BOUND', 'META_ALLOCATOR_CAP', 'NO_LIVE_EXECUTION']),
    }),
    costModel: Object.freeze({
      commissionMinorPerShare: '1',
      spreadBps: 6,
      slippageBps: 10,
      exchangeFeesBps: 0,
      fundingBorrowCostBps: 0,
      marketDataCostAllocation: 'included_in_research_budget',
      inferenceResearchCostAllocation: 'zero_llm_inference',
      zeroCostForbidden: true,
      perLegCostAccounting: true,
    }),
    validity: Object.freeze({
      validFrom: null,
      expiresAt: null,
      regimeConstraints: Object.freeze(['PAPER', 'SIMULATION', 'SHADOW']),
      invalidatingConditions: Object.freeze([
        'LEG_STALE',
        'CORRELATION_COLLAPSE',
        'TIMESTAMP_MISMATCH',
        'ENVELOPE_EXPIRED',
        'STRATEGY_REVOKED',
        'PARAMETER_VERSION_MISMATCH',
        'MULTI_LEG_UNWIND_REQUIRED',
      ]),
      modelVersionCompatibility: Object.freeze(['helios-m12-relationship-v1']),
      dataVersionCompatibility: Object.freeze(['helios-m12-bar-1h-v1']),
    }),
    fixedQualifiedParameters: Object.freeze({
      maximumPortfolioAllocationPct: '1.50',
      maximumPositionSizeUnits: '0',
      maximumConcurrentPositions: 3,
      horizonDays: 30,
    }),
  });
}

export function buildHeliosM12StrategyCapsule(input: {
  readonly createdAt: UtcInstant;
  readonly createdBy: string;
  readonly scope?: StrategyCapsuleScope;
  readonly customerId?: string | null;
  readonly qualificationState?: StrategyCapsuleRecord['qualificationState'];
  readonly workOrderId?: string | null;
  readonly parameterVersion?: string;
}): StrategyCapsuleRecord {
  const scope = input.scope ?? 'GLOBAL';
  const material = buildHeliosM12Material();
  return Object.freeze({
    strategyCapsuleId: HELIOS_M12_CAPSULE_ID,
    strategyFamilyId: HELIOS_M12_FAMILY_ID,
    version: asStrategyCapsuleVersion('1'),
    parentVersion: null,
    scope,
    customerId: scope === 'CUSTOMER_SCOPED' ? (input.customerId ?? null) : null,
    environment: 'PAPER',
    createdAt: input.createdAt,
    createdBy: input.createdBy,
    lineage: Object.freeze({
      workOrderId: input.workOrderId ?? null,
      researchLineageRefs: Object.freeze(['helios-multi-asset-m12-relative-value-stat-arb']),
      parentProposalIds: Object.freeze([]),
    }),
    material,
    evidence: Object.freeze({
      researchResultRefs: Object.freeze([]),
      observationRefs: Object.freeze([]),
      provenanceRefs: Object.freeze([]),
      sourceIndependenceNotes: Object.freeze(['deterministic_research_no_llm', 'statistical_model_no_financial_authority']),
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
