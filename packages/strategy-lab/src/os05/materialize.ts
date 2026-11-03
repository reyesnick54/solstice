import { err, ok, type Result } from '../../../domain/src/result.ts';
import { computeStrategyCapsuleMaterialHash } from '../capsule/fingerprint.ts';
import type { StrategyCapsuleMaterial, StrategyCapsuleQualificationState } from '../capsule/types.ts';
import type { StrategyGenome, StrategyGenomeFailure } from './types.ts';
import { validateStrategyGenome } from './validate.ts';

export const STRATEGY_GENOME_CAPSULE_CANDIDATE_SCHEMA =
  'helios.strategy-genome.capsule-candidate.v1' as const;

/** Qualified research artifact candidate — not live executable. */
export type StrategyGenomeCapsuleCandidate = {
  readonly schema: typeof STRATEGY_GENOME_CAPSULE_CANDIDATE_SCHEMA;
  readonly sourceGenomeId: StrategyGenome['genomeId'];
  readonly sourceGenomeVersion: StrategyGenome['version'];
  readonly genomeHash: string;
  readonly material: StrategyCapsuleMaterial;
  readonly materialHash: string;
  readonly qualificationState: Extract<StrategyCapsuleQualificationState, 'DRAFT' | 'RESEARCH_ONLY'>;
  readonly simulationOnly: true;
  readonly liveExecutionForbidden: true;
};

function findNode<T extends StrategyGenome['nodes'][number]['kind']>(
  genome: StrategyGenome,
  kind: T,
): Extract<StrategyGenome['nodes'][number], { kind: T }> | undefined {
  return genome.nodes.find((node): node is Extract<typeof node, { kind: T }> => node.kind === kind);
}

export function materializeStrategyCapsuleCandidate(
  genome: StrategyGenome,
): Result<StrategyGenomeCapsuleCandidate, StrategyGenomeFailure> {
  const validated = validateStrategyGenome(genome);
  if (!validated.ok) {
    return validated;
  }
  const feature = findNode(validated.value, 'FEATURE');
  const condition = findNode(validated.value, 'CONDITION');
  const signal = findNode(validated.value, 'SIGNAL');
  const sizing = findNode(validated.value, 'SIZING');
  const risk = findNode(validated.value, 'RISK');
  const exit = findNode(validated.value, 'EXIT');
  const execution = findNode(validated.value, 'EXECUTION');
  const regimeGate = findNode(validated.value, 'REGIME_GATE');
  if (!feature || !signal || !sizing || !risk || !exit || !execution) {
    return err({
      code: 'MISSING_REQUIRED_NODE',
      message: 'materialization requires FEATURE, SIGNAL, SIZING, RISK, EXIT, and EXECUTION nodes',
    });
  }

  const volThreshold =
    condition && condition.thresholdParam in validated.value.parameters
      ? validated.value.parameters[condition.thresholdParam]
      : null;
  const signalThreshold =
    signal.thresholdParam in validated.value.parameters
      ? validated.value.parameters[signal.thresholdParam]
      : null;

  const material: StrategyCapsuleMaterial = Object.freeze({
    description: Object.freeze({
      strategyName: validated.value.name,
      hypothesis: validated.value.hypothesis,
      economicRationale: `Declarative Strategy Genome ${validated.value.genomeId}@${validated.value.version}`,
      intendedEdge: 'Genome-defined signal with catalog-bound features and risk constraints.',
      expectedOperatingRegime: regimeGate
        ? regimeGate.permittedRegimes.join(', ')
        : 'Genome default — regime gate not specified',
      knownFailureModes: Object.freeze([
        'Catalog parameter drift',
        'Feature manifest version mismatch',
        'Regime gate violation',
        'Risk constraint breach',
      ]),
    }),
    instrumentUniverse: Object.freeze({
      supportedInstrumentClasses: Object.freeze(['ETF', 'EQUITY']),
      instrumentIds: Object.freeze([]),
      universeSelectionRules: Object.freeze(['STRATEGY_GENOME_DECLARATIVE']),
      venues: Object.freeze([]),
      currencies: Object.freeze(['USD']),
      liquidityRequirements: Object.freeze(['GENOME_EXECUTION_PREFERENCE']),
      eligibilityRestrictions: Object.freeze(['RESEARCH_ONLY', 'GENOME_MATERIALIZED']),
    }),
    featureSpecification: Object.freeze({
      featureIds: Object.freeze([feature.outputRef, feature.catalogRef]),
      dataDependencies: Object.freeze(['helios.strategy_genome.feature_manifest']),
      observationTypes: Object.freeze(['BAR', 'FEATURE']),
      lookbackWindows: Object.freeze([
        String(feature.params.lookbackDays ?? 'configured'),
      ]),
      normalizationRules: Object.freeze(['catalog_bound']),
      transformationVersions: Object.freeze([validated.value.lineage.featureManifestVersion]),
      sourceProviderRequirements: Object.freeze(['SIMULATION']),
      freshnessRequirements: Object.freeze(['KNOWABLE_AT_RESPECTED']),
    }),
    modelDependencies: Object.freeze({
      grok: Object.freeze([]),
      s3m: Object.freeze([]),
      quantitative: Object.freeze([]),
      deterministicRuleId: `genome:${validated.value.genomeId}`,
      deterministicRuleVersion: validated.value.version,
      featureEngineVersion: validated.value.lineage.featureManifestVersion,
    }),
    decisionRule: Object.freeze({
      ruleType: 'STRATEGY_GENOME_DECLARATIVE',
      entryRule: Object.freeze({
        feature: feature.catalogRef,
        condition: condition?.catalogRef ?? null,
        signal: signal.catalogRef,
        comparator: signal.comparator,
        threshold: signalThreshold,
        volThreshold,
        direction: signal.direction,
      }),
      noActionRule: Object.freeze({
        when: 'preconditions fail or regime gate blocks',
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
        volFeatureRef: sizing.volFeatureRef,
      }),
      maximumExposureAssumptions: Object.freeze({
        maxGrossExposureBps: sizing.params.maxGrossExposureBps ?? 'configured',
      }),
      minimumEvidenceRequirements: Object.freeze({
        genomeHash: validated.value.lineage.genomeHash,
        nodeCatalogVersion: validated.value.lineage.nodeCatalogVersion,
      }),
    }),
    operatingAssumptions: Object.freeze({
      marketHours: Object.freeze(['REGULAR_SESSION']),
      minimumLiquidity: 'GENOME_DECLARED',
      quoteRequirements: Object.freeze(['FRESH']),
      spreadLimitsBps: 50,
      dataDelayAssumptionMs: 0,
      maximumObservationAgeMs: 86_400_000,
      orderTypeAssumptions: Object.freeze([String(execution.params.preferredOrderType ?? 'LIMIT')]),
      executionModelAssumptions: Object.freeze([execution.catalogRef]),
      accountSizeLimits: Object.freeze({ research: 'simulation_bound' }),
      capacityAssumptions: Object.freeze(['NON_LIVE']),
    }),
    costModel: Object.freeze({
      commissionMinorPerShare: '1',
      spreadBps: 5,
      slippageBps: 3,
      exchangeFeesBps: 0,
      fundingBorrowCostBps: 0,
      marketDataCostAllocation: 'research',
      inferenceResearchCostAllocation: 'none',
      zeroCostForbidden: true,
    }),
    validity: Object.freeze({
      validFrom: null,
      expiresAt: null,
      regimeConstraints: regimeGate ? regimeGate.permittedRegimes : Object.freeze([]),
      invalidatingConditions: Object.freeze(['LIVE_EXECUTION_ATTEMPT', 'GENOME_HASH_MISMATCH']),
      modelVersionCompatibility: Object.freeze([validated.value.lineage.featureManifestVersion]),
      dataVersionCompatibility: Object.freeze([validated.value.lineage.nodeCatalogVersion]),
    }),
    marketRegimePreferences: Object.freeze({
      permittedRegimes: regimeGate ? regimeGate.permittedRegimes : Object.freeze([]),
      prohibitedRegimes: regimeGate ? regimeGate.prohibitedRegimes : Object.freeze([]),
      preferredRegimes: Object.freeze([]),
    }),
    fixedQualifiedParameters: Object.freeze({
      maximumPortfolioAllocationPct: '1.00',
      maximumPositionSizeUnits: '0',
      maximumConcurrentPositions: 1,
      horizonDays: Number(feature.params.lookbackDays ?? 20),
    }),
  });

  const riskOverlay = Object.freeze({
    catalogRef: risk.catalogRef,
    params: risk.params,
    sizingInputRef: risk.sizingInputRef,
    maxContributionVarBps: risk.params.maxContributionVarBps,
  });

  const materialWithRisk = Object.freeze({
    ...material,
    decisionRule: Object.freeze({
      ...material.decisionRule,
      maximumExposureAssumptions: Object.freeze({
        ...material.decisionRule.maximumExposureAssumptions,
        riskConstraint: riskOverlay,
      }),
    }),
  });

  const materialHash = computeStrategyCapsuleMaterialHash(materialWithRisk, 'GLOBAL');

  return ok(
    Object.freeze({
      schema: STRATEGY_GENOME_CAPSULE_CANDIDATE_SCHEMA,
      sourceGenomeId: validated.value.genomeId,
      sourceGenomeVersion: validated.value.version,
      genomeHash: validated.value.lineage.genomeHash,
      material: materialWithRisk,
      materialHash,
      qualificationState: 'RESEARCH_ONLY',
      simulationOnly: true,
      liveExecutionForbidden: true,
    }),
  );
}
