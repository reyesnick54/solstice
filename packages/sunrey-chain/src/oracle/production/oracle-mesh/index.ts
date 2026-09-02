/**
 * MoonRey Productive Oracle Mesh — public interface.
 *
 * An oracle is an information source. It is NOT a monetary authority.
 */

export {
  ORACLE_MESH_CAPABILITY,
  ORACLE_MESH_MINTS_MOONREY,
  ORACLE_MESH_SCHEMA,
  ORACLE_MESH_IS_NOT_MONETARY_AUTHORITY,
  MARKET_REFERENCE_IS_NOT_PRODUCTION_PROOF,
  CONFIGURED_PROVIDER_IS_NOT_AUTOMATICALLY_TRUSTED,
  SINGLE_SOURCE_IS_NOT_CONSENSUS,
  PRODUCTIVE_MESH_DOMAINS,
  PRODUCTIVE_ORACLE_SOURCE_CLASSES,
  ORACLE_DISAGREEMENT_LEVELS,
  ORACLE_MESH_RESULTS,
  ORACLE_MESH_EXPLANATION_CODES,
} from './types.ts';

export type {
  MeshFixtureScenario,
  MeshFixturePack,
  OracleConflictReport,
  OracleDisagreementLevel,
  OracleMeshExplanationCode,
  OracleMeshResult,
  ProductiveCandidateEvent,
  ProductiveMeshAsset,
  ProductiveMeshDomain,
  ProductiveOracleEvaluation,
  ProductiveOracleSourceClass,
  ProductiveSourceRecord,
  ProductiveVerificationPolicy,
  ProviderLineage,
  ToleranceAssessment,
} from './types.ts';

export {
  DIRECT_PRODUCTION_SOURCE_CLASSES,
  CORROBORATIVE_SOURCE_CLASSES,
  REFERENCE_ONLY_SOURCE_CLASSES,
  isProductiveOracleSourceClass,
  isDirectProductionEvidence,
  isReferenceOnlySource,
  marketReferenceCannotSubstituteForProduction,
  rejectWrongSourceClass,
} from './source-classes.ts';

export { DOMAIN_TOPOLOGIES, topologyFor } from './topologies.ts';

export {
  adaptProductiveSourceRecord,
  deriveObservationId,
} from './adapter.ts';
export type { AdapterRejection, AdapterResult } from './adapter.ts';

export {
  analyzeProductiveIndependence,
  copiedSourcesDoNotCountIndependently,
  independenceKeyFor,
  providerLineageFromRecord,
  resolveUltimateOrigin,
} from './independence.ts';
export type { IndependenceAnalysis, IndependenceWitness } from './independence.ts';

export {
  PRODUCTIVE_VERIFICATION_POLICY_VERSION,
  DOMAIN_VERIFICATION_POLICIES,
  ENERGY_VERIFICATION_POLICY,
  COMPUTE_VERIFICATION_POLICY,
  MANUFACTURING_VERIFICATION_POLICY,
  AGRICULTURE_VERIFICATION_POLICY,
  LOGISTICS_VERIFICATION_POLICY,
  WATER_VERIFICATION_POLICY,
  RESOURCES_VERIFICATION_POLICY,
  policyForDomain,
  sourceClassSatisfiesPolicy,
  hasRequiredDirectEvidence,
  topologyAlignsWithPolicy,
} from './policies.ts';

export {
  assessTolerance,
  classifyDisagreement,
  detectOutlierProviders,
  disagreementBlocksVerification,
  disagreementRequiresManualReview,
  medianBigInt,
  spreadBps,
} from './conflict.ts';

export {
  assessSourceFailures,
  failureResult,
  systemContinuesDespiteOutage,
} from './failure.ts';
export type { FailureAssessment, SourceAvailability } from './failure.ts';

export {
  createReplayLedger,
  observationIdentityKey,
  repeatedPollingDoesNotCreateRepeatedProduction,
} from './replay.ts';
export type { ObservationIdentityMaterial, ReplayLedger } from './replay.ts';

export {
  evaluateProductiveOracleMesh,
  oracleMeshOutputCannotMint,
} from './evaluation.ts';
export type { MeshEvaluationInput, MeshEvaluationOutput } from './evaluation.ts';

export {
  buildProductiveOracleEvaluation,
  evaluationFeedsInformationConsensus,
} from './receipt.ts';

export {
  ALL_MESH_DOMAINS,
  ALL_MESH_SCENARIOS,
  MESH_FIXTURE_NOW_UTC,
  allMeshFixtures,
  marketReferenceOnlyFixture,
  meshFixturePack,
  wrongSourceClassFixture,
} from './fixtures.ts';
