import { err, ok, type Result } from '@solstice/domain';

import { computeStrategyCapsuleMaterialHash } from '../capsule/fingerprint.ts';
import type { StrategyCapsuleMaterial } from '../capsule/types.ts';
import {
  STRATEGY_GENOME_CAPSULE_CANDIDATE_SCHEMA,
  type StrategyGenomeCapsuleCandidate,
} from '../os05/materialize.ts';
import type { StrategyGenome, StrategyGenomeFailure } from '../os05/types.ts';
import { validateEarn11StrategyGenome } from './validate.ts';

function findNode<T extends StrategyGenome['nodes'][number]['kind']>(
  genome: StrategyGenome,
  kind: T,
): Extract<StrategyGenome['nodes'][number], { kind: T }> | undefined {
  return genome.nodes.find((node): node is Extract<typeof node, { kind: T }> => node.kind === kind);
}

export function materializeEarn11CapsuleCandidate(
  genome: StrategyGenome,
): Result<StrategyGenomeCapsuleCandidate, StrategyGenomeFailure> {
  const validated = validateEarn11StrategyGenome(genome);
  if (!validated.ok) {
    return validated;
  }
  const feature = findNode(validated.value, 'FEATURE');
  const signal = findNode(validated.value, 'SIGNAL');
  const sizing = findNode(validated.value, 'SIZING');
  const risk = findNode(validated.value, 'RISK');
  const exit = findNode(validated.value, 'EXIT');
  const execution = findNode(validated.value, 'EXECUTION');
  const regimeGate = findNode(validated.value, 'REGIME_GATE');
  if (!feature || !signal || !sizing || !risk || !exit || !execution) {
    return err({
      code: 'MISSING_REQUIRED_NODE',
      message: 'EARN11 materialization requires FEATURE, SIGNAL, SIZING, RISK, EXIT, and EXECUTION nodes',
    });
  }

  const signalThreshold =
    signal.thresholdParam in validated.value.parameters
      ? validated.value.parameters[signal.thresholdParam]
      : (signal.params.minConfidenceBps ?? null);

  const material: StrategyCapsuleMaterial = Object.freeze({
    description: Object.freeze({
      strategyName: validated.value.name,
      hypothesis: validated.value.hypothesis,
      economicRationale: `EARN11 research template ${String(validated.value.parameters.earn11TemplateFamily)}`,
      intendedEdge: 'Research-only earnings event hypothesis — not a proven strategy.',
      expectedOperatingRegime: regimeGate
        ? regimeGate.permittedRegimes.join(', ')
        : 'EARNINGS_EVENT_WINDOWS',
      knownFailureModes: Object.freeze([
        'Overnight gap misspecified',
        'Close-to-close fantasy fill bias',
        'Post-print revision lookahead',
        'Options implied move stale into print',
      ]),
    }),
    instrumentUniverse: Object.freeze({
      supportedInstrumentClasses: Object.freeze(['EQUITY']),
      instrumentIds: Object.freeze([]),
      universeSelectionRules: Object.freeze(['EARN11_EVENT_UNIVERSE']),
      venues: Object.freeze([]),
      currencies: Object.freeze(['USD']),
      liquidityRequirements: Object.freeze(['EARNINGS_EVENT_LIQUIDITY']),
      eligibilityRestrictions: Object.freeze(['RESEARCH_ONLY', 'EARN11_TEMPLATE']),
    }),
    featureSpecification: Object.freeze({
      featureIds: Object.freeze(
        validated.value.nodes
          .filter((node) => node.kind === 'FEATURE')
          .map((node) => (node.kind === 'FEATURE' ? node.outputRef : '')),
      ),
      dataDependencies: Object.freeze(['helios.earn11.feature_manifest', 'aaf_v2.universal_fabric']),
      observationTypes: Object.freeze(['EARNINGS', 'OPTIONS', 'TRANSCRIPT', 'BAR']),
      lookbackWindows: Object.freeze(['event_window']),
      normalizationRules: Object.freeze(['pit_bound', 'aaf_v2_entitlement']),
      transformationVersions: Object.freeze([validated.value.lineage.featureManifestVersion]),
      sourceProviderRequirements: Object.freeze(['SIMULATION']),
      freshnessRequirements: Object.freeze(['KNOWABLE_AT_RESPECTED']),
    }),
    modelDependencies: Object.freeze({
      grok: Object.freeze([]),
      s3m: Object.freeze([]),
      quantitative: Object.freeze([]),
      deterministicRuleId: `earn11:${validated.value.genomeId}`,
      deterministicRuleVersion: validated.value.version,
      featureEngineVersion: validated.value.lineage.featureManifestVersion,
    }),
    decisionRule: Object.freeze({
      ruleType: 'EARN11_RESEARCH_TEMPLATE',
      entryRule: Object.freeze({
        feature: feature.catalogRef,
        condition: null,
        signal: signal.catalogRef,
        comparator: signal.comparator,
        threshold: signalThreshold,
        volThreshold: null,
        direction: signal.direction,
      }),
      noActionRule: Object.freeze({
        when: 'AAF V2 gate failure or event twin rejects fill path',
        action: 'NO_ACTION',
      }),
      exitRule: Object.freeze({
        catalogRef: exit.catalogRef,
        params: exit.params,
        signalInputRef: exit.signalInputRef,
      }),
      invalidationRule: Object.freeze({
        when: 'genome_hash_mismatch OR close_to_close_only_execution',
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
        aafV2Required: true,
      }),
    }),
    operatingAssumptions: Object.freeze({
      marketHours: Object.freeze(['REGULAR_SESSION', 'OVERNIGHT_GAP', 'OPEN_AUCTION']),
      minimumLiquidity: 'EARNINGS_EVENT_REDUCED',
      quoteRequirements: Object.freeze(['EVENT_TWIN']),
      spreadLimitsBps: 150,
      dataDelayAssumptionMs: 0,
      maximumObservationAgeMs: 3_600_000,
      orderTypeAssumptions: Object.freeze([String(execution.params.eventSimulationProfile ?? 'event_twin')]),
      executionModelAssumptions: Object.freeze([execution.catalogRef, 'overnight_gap', 'partial_fill']),
      accountSizeLimits: Object.freeze({ research: 'simulation_bound' }),
      capacityAssumptions: Object.freeze(['NON_LIVE', 'EVENT_GAP_AWARE']),
    }),
    costModel: Object.freeze({
      commissionMinorPerShare: '1',
      spreadBps: 25,
      slippageBps: 35,
      exchangeFeesBps: 0,
      fundingBorrowCostBps: 0,
      marketDataCostAllocation: 'research',
      inferenceResearchCostAllocation: 'earnings_intelligence',
      zeroCostForbidden: true,
    }),
    validity: Object.freeze({
      validFrom: null,
      expiresAt: null,
      regimeConstraints: regimeGate ? regimeGate.permittedRegimes : Object.freeze([]),
      invalidatingConditions: Object.freeze(['LIVE_EXECUTION_ATTEMPT', 'CLOSE_TO_CLOSE_ONLY_PROMOTION']),
      modelVersionCompatibility: Object.freeze([validated.value.lineage.featureManifestVersion]),
      dataVersionCompatibility: Object.freeze([validated.value.lineage.nodeCatalogVersion]),
    }),
    marketRegimePreferences: Object.freeze({
      permittedRegimes: regimeGate ? regimeGate.permittedRegimes : Object.freeze([]),
      prohibitedRegimes: regimeGate ? regimeGate.prohibitedRegimes : Object.freeze([]),
      preferredRegimes: Object.freeze([]),
    }),
    fixedQualifiedParameters: Object.freeze({
      maximumPortfolioAllocationPct: '0.50',
      maximumPositionSizeUnits: '0',
      maximumConcurrentPositions: 3,
      horizonDays: 5,
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
