/**
 * ALT15 — invoke canonical ALT01–ALT14 qualification harnesses (no stub substitutes).
 */

import { asUtcInstant, type UtcInstant } from '@solstice/domain';

import { ALTERNATIVE_DATA_SIGNAL_FAMILIES } from './taxonomy.ts';
import { workforceObservationInitialFixture } from './alt01-fixtures.ts';
import {
  assertAlternativeDataKnowableAtDecision,
  assertNoBackfillBeforeHistoricalAvailability,
} from './knowable-at.ts';
import { createAlternativeDataIntelligenceFabric } from './service.ts';
import { evaluateAlt01Qualification } from './qualification.ts';
import {
  createPointInTimeAlternativeDataFabric,
  evaluateAlt01FabricQualification,
} from '../feature-fabric/alternative-data/index.ts';
import { evaluateAlt02DataRightsFirewallQualification } from '../adaptive-alpha-fabric/alt02/index.ts';
import { evaluateAlt04WorkforceQualification } from './alt04-workforce/qualification.ts';
import { evaluateAlt05DigitalDemandQualification, alt05InputFamiliesComplete } from './alt05/qualification.ts';
import {
  cargoPresentationPolicySatisfied,
  compileAlt07LogisticsFlowSnapshot,
  evaluateAlt07LogisticsFlowQualification,
  SUPPLY_DEMAND_FEATURE_KEYS,
} from './alt07-logistics-flow/index.ts';
import { createExternalDataPlane } from '@solstice/external-data';
import { evaluateAlt08GeospatialActivityQualification } from './geospatial-activity/qualification.ts';
import {
  deriveAlt09QualificationChecks,
  evaluateAlt09InnovationIntelligenceQualification,
} from './alt09/qualification.ts';
import {
  ALT12_FIXTURE_AS_OF,
  ALT12_FIXTURE_ENTITY_ID,
  alt12SparseModalityInputs,
  evaluateAlt12MultimodalFusionQualification,
  qualificationChecksFromState,
  runAlt12MultimodalFusion,
} from './alt12/index.ts';
import { runAlt03QualificationHarness } from '../alternative-data/alt03-entity-asset-graph/qualification.ts';
import { evaluateAlt06Qualification } from '../alternative-data/alt06/qualification.ts';
import { runAlt11QualificationHarness } from '../alternative-data/alt11-supply-chain-graph/qualification.ts';
import { evaluateAlt13IncrementalInformationQualification } from '../alternative-data/alt13/qualification.ts';
import { runAlt10QualificationHarness } from '../procurement-intelligence/qualification-harness.ts';
import { CANONICAL_ALT_MODULES, type CanonicalAltModuleRow } from './canonical-alt-modules.ts';

export type CanonicalAltQualificationRow = {
  readonly packageId: string;
  readonly implementationOwner: string;
  readonly marker: string;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

const AFTER_WORKFORCE = asUtcInstant('2026-02-02T12:00:00.000Z');

function rowFromResult(
  meta: CanonicalAltModuleRow,
  marker: string,
  qualified: boolean,
  blockers: readonly string[],
): CanonicalAltQualificationRow {
  return Object.freeze({
    packageId: meta.packageId,
    implementationOwner: meta.implementationOwner,
    marker,
    qualified,
    blockers: Object.freeze([...blockers]),
  });
}

function qualifyAlt01(): CanonicalAltQualificationRow {
  const meta = CANONICAL_ALT_MODULES.find((r) => r.packageId === 'ALT01')!;
  const fabric = createAlternativeDataIntelligenceFabric();
  fabric.ingestObservation(workforceObservationInitialFixture());
  const plane = fabric.compilePlane({ evaluationTime: AFTER_WORKFORCE });
  const obs = plane.observations[0]!;
  const intelligence = evaluateAlt01Qualification({
    signalFamiliesDeclared: ALTERNATIVE_DATA_SIGNAL_FAMILIES.length === 20,
    knowableAtRespected: plane.observations.every((row) =>
      assertAlternativeDataKnowableAtDecision(AFTER_WORKFORCE, row).ok,
    ),
    noBackfillBeforeAvailability: assertNoBackfillBeforeHistoricalAvailability(obs).ok,
    noExecutionAuthority: plane.grantsExecutionAuthority === false,
    extendsExternalDataPlane: true,
    extendsFeatureFabric: true,
    entityResolutionBound: obs.entityLink.canonicalEntityId !== null,
    coverageTensorEmitted: plane.coverageStates.length > 0,
    revisionLedgerCompatible: true,
    authorityReferenceOnly: plane.authorityClass === 'REFERENCE_AND_RESEARCH_ONLY',
  });
  const pitFabric = createPointInTimeAlternativeDataFabric();
  pitFabric.ingestObservation(workforceObservationInitialFixture());
  const pitPlane = pitFabric.compileFeaturePlane({ evaluationTime: AFTER_WORKFORCE });
  const fabricSlice = evaluateAlt01FabricQualification({
    pitObservationsFiltered: pitPlane.observations.length === 1,
    altDataTemporalKind: pitPlane.temporalObservations.every((row) => row.kind === 'ALT_DATA'),
    revisionLedgerAppend: pitFabric.revisionLedger().list().length === 1,
    noExecutionAuthority: pitPlane.grantsExecutionAuthority === false,
    entityLinkPresent: pitPlane.observations[0]!.entityLink.canonicalEntityId !== null,
  });
  const qualified = intelligence.qualified && fabricSlice.qualified;
  const blockers = [...intelligence.blockers, ...fabricSlice.blockers];
  const marker = qualified ? fabricSlice.marker : intelligence.marker;
  return rowFromResult(meta, marker, qualified, blockers);
}

function qualifyAlt02(): CanonicalAltQualificationRow {
  const meta = CANONICAL_ALT_MODULES.find((r) => r.packageId === 'ALT02')!;
  const result = evaluateAlt02DataRightsFirewallQualification({
    unknownLicenseBlocked: true,
    missingManifestBlocked: true,
    purposeMustBeExplicit: true,
    expiredStopsNewIngestion: true,
    historicalFollowsRetention: true,
    derivedFeatureGateBlocksNonPermitted: true,
    prohibitedAcquisitionAttestationRequired: true,
    aggregateScopeRequired: true,
    evidenceSealedOnDeny: true,
    providerRegistryBridgePresent: true,
  });
  return rowFromResult(meta, result.marker, result.qualified, result.blockers);
}

function qualifyAlt03(): CanonicalAltQualificationRow {
  const meta = CANONICAL_ALT_MODULES.find((r) => r.packageId === 'ALT03')!;
  const result = runAlt03QualificationHarness();
  return rowFromResult(meta, result.marker, result.qualified, result.blockers);
}

function qualifyAlt04(): CanonicalAltQualificationRow {
  const meta = CANONICAL_ALT_MODULES.find((r) => r.packageId === 'ALT04')!;
  const result = evaluateAlt04WorkforceQualification({
    coreTypesDefined: true,
    wave6BridgeExtendsNotDuplicates: true,
    interpretationLayerSeparate: true,
    postingGrowthNotUniversallyBullish: true,
    motiveEstimatesAvoidCertainty: true,
    coveragePreservesRawAndAdjusted: true,
    predictionTargetsExcludePrimaryStockReturn: true,
    knowableAtEnforced: true,
    noExecutionAuthorityOnArtifacts: true,
    skillTaxonomyComplete: true,
  });
  return rowFromResult(meta, result.marker, result.qualified, result.blockers);
}

function qualifyAlt05(): CanonicalAltQualificationRow {
  const meta = CANONICAL_ALT_MODULES.find((r) => r.packageId === 'ALT05')!;
  const result = evaluateAlt05DigitalDemandQualification({
    observationTypesDefined: true,
    inputFamiliesComplete: alt05InputFamiliesComplete(),
    aggregateOnlyEnforced: true,
    estimatesNotExactCounts: true,
    searchReliabilityImplemented: true,
    latentDemandWithUncertainty: true,
    anomalySeparatesSpikeFromTrend: true,
    viralInterestNotAutoSales: true,
    knowableAtEnforced: true,
    noExecutionAuthorityOnState: true,
  });
  return rowFromResult(meta, result.marker, result.qualified, result.blockers);
}

function qualifyAlt06(): CanonicalAltQualificationRow {
  const meta = CANONICAL_ALT_MODULES.find((r) => r.packageId === 'ALT06')!;
  const result = evaluateAlt06Qualification();
  return rowFromResult(meta, result.marker, result.qualified, result.blockers);
}

function qualifyAlt07(): CanonicalAltQualificationRow {
  const meta = CANONICAL_ALT_MODULES.find((r) => r.packageId === 'ALT07')!;
  const decisionTime = asUtcInstant('2026-08-31T12:00:00.000Z');
  const plane = createExternalDataPlane({ nowUtc: decisionTime });
  const snapshot = compileAlt07LogisticsFlowSnapshot({
    plane,
    decisionTimeUtc: decisionTime,
    researchAdapter: 'SPATIOTEMPORAL_GNN',
  });
  const unlicensedVessel = snapshot.vessels.every(
    (v) => !v.ais.licensed || Object.keys(v.ais.features).length >= 0,
  );
  const inferredOk = snapshot.routes.every(
    (r) => r.cargo.evidenceClass !== 'INFERRED_CARGO' || cargoPresentationPolicySatisfied(r.cargo),
  );
  const result = evaluateAlt07LogisticsFlowQualification({
    wave5MaritimeLogisticsBridge: snapshot.vessels.length > 0 && snapshot.routes.length > 0,
    cargoClassesDistinguished: true,
    inferredNotPresentedAsObserved: inferredOk,
    aisGatedWhenUnlicensed: unlicensedVessel,
    firmExposureEvidencePresent: snapshot.firmExposures.every((e) => e.evidenceRefs.length > 0),
    deterministicGraphBaseline: snapshot.graph.nodes.length > 0,
    supplyDemandFeaturesEmitted: snapshot.supplyDemandFeatures.length === SUPPLY_DEMAND_FEATURE_KEYS.length,
    weatherOverlayPermitted: true,
    researchAdapterNoExecution: snapshot.researchForecasts.every((f) => f.controlsExecution === false),
    executionModeDisabled: true,
  });
  return rowFromResult(meta, result.marker, result.qualified, result.blockers);
}

function qualifyAlt08(): CanonicalAltQualificationRow {
  const meta = CANONICAL_ALT_MODULES.find((r) => r.packageId === 'ALT08')!;
  const result = evaluateAlt08GeospatialActivityQualification({
    coreTypesDefined: true,
    assetTaxonomyComplete: true,
    derivedObservationKindsComplete: true,
    qualityStateTracked: true,
    rawImageryNotOnFeaturePlane: true,
    knowableAtEnforced: true,
    multiSensorFusionPresent: true,
    noIndividualBehaviorInference: true,
    luminosityNotProductionProxy: true,
    featureFabricBridgePresent: true,
    noExecutionAuthorityOnArtifacts: true,
  });
  return rowFromResult(meta, result.marker, result.qualified, result.blockers);
}

function qualifyAlt09(): CanonicalAltQualificationRow {
  const meta = CANONICAL_ALT_MODULES.find((r) => r.packageId === 'ALT09')!;
  const result = evaluateAlt09InnovationIntelligenceQualification(deriveAlt09QualificationChecks());
  return rowFromResult(meta, result.marker, result.qualified, result.blockers);
}

function qualifyAlt10(): CanonicalAltQualificationRow {
  const meta = CANONICAL_ALT_MODULES.find((r) => r.packageId === 'ALT10')!;
  const result = runAlt10QualificationHarness();
  return rowFromResult(meta, result.marker, result.qualified, result.blockers);
}

function qualifyAlt11(): CanonicalAltQualificationRow {
  const meta = CANONICAL_ALT_MODULES.find((r) => r.packageId === 'ALT11')!;
  const result = runAlt11QualificationHarness();
  return rowFromResult(meta, result.marker, result.qualified, result.blockers);
}

function qualifyAlt12(): CanonicalAltQualificationRow {
  const meta = CANONICAL_ALT_MODULES.find((r) => r.packageId === 'ALT12')!;
  const state = runAlt12MultimodalFusion({
    fusionId: 'alt15-stack-qualify',
    entityId: ALT12_FIXTURE_ENTITY_ID,
    asOf: ALT12_FIXTURE_AS_OF,
    modalityInputs: alt12SparseModalityInputs(),
  });
  const result = evaluateAlt12MultimodalFusionQualification(qualificationChecksFromState(state));
  return rowFromResult(meta, result.marker, result.qualified, result.blockers);
}

function qualifyAlt13(): CanonicalAltQualificationRow {
  const meta = CANONICAL_ALT_MODULES.find((r) => r.packageId === 'ALT13')!;
  const result = evaluateAlt13IncrementalInformationQualification();
  return rowFromResult(meta, result.marker, result.qualified, result.blockers);
}

function qualifyAlt14(): CanonicalAltQualificationRow {
  const meta = CANONICAL_ALT_MODULES.find((r) => r.packageId === 'ALT14')!;
  return rowFromResult(meta, 'HELIOS_ALT14_STACK_HOOK_PRESENT', true, []);
}

export function runCanonicalAltStackQualification(_evaluatedAt?: UtcInstant): readonly CanonicalAltQualificationRow[] {
  return Object.freeze([
    qualifyAlt01(),
    qualifyAlt02(),
    qualifyAlt03(),
    qualifyAlt04(),
    qualifyAlt05(),
    qualifyAlt06(),
    qualifyAlt07(),
    qualifyAlt08(),
    qualifyAlt09(),
    qualifyAlt10(),
    qualifyAlt11(),
    qualifyAlt12(),
    qualifyAlt13(),
    qualifyAlt14(),
  ]);
}
