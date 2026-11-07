/**
 * HELIOS Market Data platform — feed integrity, macro reference, and MD14 qualification.
 */

export * from './md03/index.ts';
export * from './md06-instrument-master/index.ts';
export * from './md07-us-equity/index.ts';
export * from './md10/index.ts';

export {
  HELIOS_MARKET_DATA_FABRIC_SCHEMA,
  HELIOS_PRODUCTION_MARKET_DATA_V1_BLOCKED,
  HELIOS_PRODUCTION_MARKET_DATA_V1_QUALIFIED,
  MD_WORK_PACKAGES,
  PRODUCTION_MARKET_DATA_STATUSES,
  AAF_FEATURE_CERTIFICATION_BLOCK_STATES,
  MD14_ADVERSARIAL_SCENARIO_IDS,
  type MdWorkPackageId,
  type ProductionMarketDataStatus,
  type AafFeatureCertificationBlockState,
  type Md14AdversarialScenarioId,
} from './taxonomy.ts';

export { listMdWorkPackages, type MdWorkPackageRow } from './work-package-registry.ts';

export {
  mayAafCertifyMarketDataFeature,
  assertMarketDataFeatureEnvelopeComplete,
  aafSyncStateFromInputs,
  type MarketDataAafFeatureEnvelope,
} from './aaf-integration.ts';

export {
  describeMarketDataLiveShadowPosture,
  assertMarketDataLiveShadowSafe,
  type MarketDataLiveShadowPosture,
} from './live-shadow.ts';

export {
  decideProviderMarketDataStatus,
  fixtureSandboxProviderEvidence,
  type MarketDataProviderProductionEvidence,
  type ProviderQualificationDecision,
} from './provider-qualification.ts';

export {
  runMd14SyntheticE2ePipeline,
  MD14_E2E_PIPELINE_STAGES,
  type Md14E2ePipelineResult,
  type Md14E2ePipelineStage,
} from './e2e-pipeline.ts';

export {
  runMd14AdversarialScenario,
  runAllMd14AdversarialScenarios,
  type Md14AdversarialScenarioResult,
} from './adversarial-qualification.ts';

export {
  evaluateMarketDataFabricQualification,
  type MarketDataFabricQualificationInput,
  type MarketDataFabricQualificationResult,
} from './md14-qualification.ts';
