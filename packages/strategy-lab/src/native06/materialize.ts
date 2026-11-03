import { err, ok, type Result } from '@solstice/domain';
import { computeStrategyCapsuleMaterialHash } from '../capsule/fingerprint.ts';
import type { StrategyCapsuleMaterial, StrategyCapsuleQualificationState } from '../capsule/types.ts';
import type { Native06GenomeFailure, Native06StrategyGenome } from './types.ts';
import { validateNative06StrategyGenome } from './validate.ts';

export const NATIVE06_GENOME_CAPSULE_CANDIDATE_SCHEMA =
  'helios.strategy-genome.bytex-native.capsule-candidate.v1' as const;

export type Native06StrategyCapsuleCandidate = {
  readonly schema: typeof NATIVE06_GENOME_CAPSULE_CANDIDATE_SCHEMA;
  readonly sourceGenomeId: Native06StrategyGenome['genomeId'];
  readonly sourceGenomeVersion: Native06StrategyGenome['version'];
  readonly genomeHash: string;
  readonly material: StrategyCapsuleMaterial;
  readonly materialHash: string;
  readonly qualificationState: Extract<StrategyCapsuleQualificationState, 'DRAFT' | 'RESEARCH_ONLY'>;
  readonly simulationOnly: true;
  readonly liveExecutionForbidden: true;
};

function findNode<T extends Native06StrategyGenome['nodes'][number]['kind']>(
  genome: Native06StrategyGenome,
  kind: T,
): Extract<Native06StrategyGenome['nodes'][number], { kind: T }> | undefined {
  return genome.nodes.find((node): node is Extract<typeof node, { kind: T }> => node.kind === kind);
}

export function materializeNative06CapsuleCandidate(
  genome: Native06StrategyGenome,
): Result<Native06StrategyCapsuleCandidate, Native06GenomeFailure> {
  const validated = validateNative06StrategyGenome(genome);
  if (!validated.ok) {
    return validated;
  }
  const data = findNode(validated.value, 'DATA');
  const indicator = findNode(validated.value, 'INDICATOR');
  const signal = findNode(validated.value, 'SIGNAL');
  const sizing = findNode(validated.value, 'SIZING');
  const risk = findNode(validated.value, 'RISK');
  const entry = findNode(validated.value, 'ENTRY');
  const exit = findNode(validated.value, 'EXIT');
  const execution = findNode(validated.value, 'EXECUTION_PREFERENCE');
  const regime = findNode(validated.value, 'REGIME');
  if (!data || !indicator || !signal || !sizing || !risk || !entry || !exit || !execution) {
    return err({
      code: 'MISSING_REQUIRED_NODE',
      message: 'materialization requires DATA, INDICATOR, SIGNAL, SIZING, RISK, ENTRY, EXIT, EXECUTION_PREFERENCE',
    });
  }

  const material: StrategyCapsuleMaterial = Object.freeze({
    description: Object.freeze({
      strategyName: validated.value.name,
      hypothesis: validated.value.hypothesis,
      economicRationale: `NATIVE06 BYTEX-assimilated genome ${validated.value.genomeId}@${validated.value.version}`,
      intendedEdge: 'Catalog-bound indicators and declarative entry/exit graph.',
      expectedOperatingRegime: regime ? regime.permittedRegimes.join(', ') : 'SIMULATION',
      knownFailureModes: Object.freeze([
        'Indicator manifest mismatch',
        'BYTEX document translation drift',
        'Regime gate violation',
        'Risk exposure cap breach',
      ]),
    }),
    instrumentUniverse: Object.freeze({
      supportedInstrumentClasses: Object.freeze(['CRYPTO', 'ETF', 'EQUITY']),
      instrumentIds: Object.freeze([]),
      universeSelectionRules: Object.freeze(['NATIVE06_BYTEX_ASSIMILATED']),
      venues: Object.freeze(['SIMULATION']),
      currencies: Object.freeze(['USD', 'USDT']),
      liquidityRequirements: Object.freeze(['GENOME_EXECUTION_PREFERENCE']),
      eligibilityRestrictions: Object.freeze(['RESEARCH_ONLY', 'GENOME_MATERIALIZED']),
    }),
    featureSpecification: Object.freeze({
      featureIds: Object.freeze([data.outputRef, indicator.outputRef, indicator.catalogRef]),
      dataDependencies: Object.freeze(['helios.feature_fabric.technical']),
      observationTypes: Object.freeze(['BAR', 'INDICATOR', 'FEATURE']),
      lookbackWindows: Object.freeze([String(indicator.params.period ?? 'configured')]),
      normalizationRules: Object.freeze(['native06_scaled_rational']),
      transformationVersions: Object.freeze([validated.value.lineage.featureManifestVersion]),
      sourceProviderRequirements: Object.freeze(['SIMULATION']),
      freshnessRequirements: Object.freeze(['KNOWABLE_AT_RESPECTED']),
    }),
    modelDependencies: Object.freeze({
      grok: Object.freeze([]),
      s3m: Object.freeze([]),
      quantitative: Object.freeze([]),
      deterministicRuleId: `native06:${validated.value.genomeId}`,
      deterministicRuleVersion: validated.value.version,
      featureEngineVersion: validated.value.lineage.featureManifestVersion,
    }),
    decisionRule: Object.freeze({
      ruleType: 'NATIVE06_STRATEGY_GENOME_DECLARATIVE',
      entryRule: Object.freeze({
        dataRef: data.catalogRef,
        indicatorRef: indicator.catalogRef,
        signalRef: signal.catalogRef,
        entryRef: entry.catalogRef,
        side: entry.params.side,
        orderType: entry.params.orderType,
        direction: signal.direction,
      }),
      noActionRule: Object.freeze({
        when: 'preconditions fail or regime blocks',
        action: 'NO_ACTION',
      }),
      exitRule: Object.freeze({
        catalogRef: exit.catalogRef,
        params: exit.params,
        signalInputRef: exit.signalInputRef,
      }),
      invalidationRule: Object.freeze({
        when: 'genome_hash_mismatch OR catalog_version_mismatch',
        action: 'NO_ACTION',
      }),
      positionSizingRule: Object.freeze({
        catalogRef: sizing.catalogRef,
        params: sizing.params,
        signalInputRef: sizing.signalInputRef,
        volFeatureRef: sizing.volFeatureRef ?? null,
      }),
      maximumExposureAssumptions: Object.freeze({
        maxGrossExposureBps: risk.params.maxGrossExposureBps ?? 'configured',
      }),
      minimumEvidenceRequirements: Object.freeze({
        genomeHash: validated.value.lineage.genomeHash,
        nodeCatalogVersion: validated.value.lineage.nodeCatalogVersion,
        upstreamDocumentId: validated.value.lineage.upstreamDocumentId ?? null,
      }),
    }),
    operatingAssumptions: Object.freeze({
      marketHours: Object.freeze(['CONTINUOUS', 'REGULAR_SESSION']),
      minimumLiquidity: 'GENOME_DECLARED',
      quoteRequirements: Object.freeze(['FRESH']),
      spreadLimitsBps: 50,
      dataDelayAssumptionMs: 0,
      maximumObservationAgeMs: 86_400_000,
      orderTypeAssumptions: Object.freeze([String(execution.params.preferredOrderType ?? 'MARKET')]),
      executionModelAssumptions: Object.freeze([execution.catalogRef]),
      accountSizeLimits: Object.freeze({ research: 'simulation_bound' }),
      capacityAssumptions: Object.freeze(['NON_LIVE']),
    }),
    costModel: Object.freeze({
      commissionMinorPerShare: '1',
      spreadBps: 5,
      slippageBps: Number(execution.params.maxSlippageToleranceBps ?? 3),
      exchangeFeesBps: 0,
      fundingBorrowCostBps: 0,
      marketDataCostAllocation: 'research',
      inferenceResearchCostAllocation: 'none',
      zeroCostForbidden: true,
    }),
    validity: Object.freeze({
      validFrom: null,
      expiresAt: null,
      regimeConstraints: regime ? regime.permittedRegimes : Object.freeze([]),
      invalidatingConditions: Object.freeze(['LIVE_EXECUTION_ATTEMPT', 'GENOME_HASH_MISMATCH']),
      modelVersionCompatibility: Object.freeze([validated.value.lineage.featureManifestVersion]),
      dataVersionCompatibility: Object.freeze([validated.value.lineage.nodeCatalogVersion]),
    }),
    marketRegimePreferences: Object.freeze({
      permittedRegimes: regime ? regime.permittedRegimes : Object.freeze([]),
      prohibitedRegimes: regime ? regime.prohibitedRegimes : Object.freeze([]),
      preferredRegimes: Object.freeze([]),
    }),
    fixedQualifiedParameters: Object.freeze({
      maximumPortfolioAllocationPct: '1.00',
      maximumPositionSizeUnits: String(validated.value.parameters.size ?? '0'),
      maximumConcurrentPositions: 1,
      horizonDays: Number(indicator.params.period ?? 20),
    }),
  });

  const materialHash = computeStrategyCapsuleMaterialHash(material, 'GLOBAL');

  return ok(
    Object.freeze({
      schema: NATIVE06_GENOME_CAPSULE_CANDIDATE_SCHEMA,
      sourceGenomeId: validated.value.genomeId,
      sourceGenomeVersion: validated.value.version,
      genomeHash: validated.value.lineage.genomeHash,
      material,
      materialHash,
      qualificationState: 'RESEARCH_ONLY',
      simulationOnly: true,
      liveExecutionForbidden: true,
    }),
  );
}
