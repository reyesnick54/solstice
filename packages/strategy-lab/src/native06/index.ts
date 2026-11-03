export {
  NATIVE06_STRATEGY_GENOME_SCHEMA,
  BYTEX_STRATEGY_DOCUMENT_SCHEMA_VERSION,
  asNative06StrategyGenomeId,
  asNative06StrategyGenomeVersion,
} from './ids.ts';
export type { Native06StrategyGenomeId, Native06StrategyGenomeVersion } from './ids.ts';

export {
  NATIVE06_NODE_KINDS,
} from './types.ts';
export type {
  Native06NodeKind,
  Native06StrategyGenome,
  Native06StrategyNode,
  BytexStrategyDocument,
  Native06GenomeFailure,
  Native06GenomeFailureCode,
} from './types.ts';

export {
  NATIVE06_NODE_CATALOG_VERSION,
  NATIVE06_FEATURE_MANIFEST_VERSION,
  NATIVE06_NODE_CATALOG,
  BYTEX_NODE_TYPE_TO_CATALOG_REF,
  native06CatalogDefinitionFor,
  catalogRefForBytexNodeType,
} from './catalog.ts';

export { validateBytexStrategyDocument } from './schema.ts';
export {
  translateBytexDocumentToNative06Genome,
  translateBytexDocumentJson,
  asNative06GenomeIdFromBytexDocument,
} from './bytex-document.ts';

export { computeNative06GenomeHash, attachNative06GenomeHash, lineageWithoutGenomeHash } from './hash.ts';
export { validateNative06StrategyGenome } from './validate.ts';
export {
  NATIVE06_GENOME_CAPSULE_CANDIDATE_SCHEMA,
  materializeNative06CapsuleCandidate,
} from './materialize.ts';
export type { Native06StrategyCapsuleCandidate } from './materialize.ts';
export {
  NATIVE06_COMPILER_STAGES,
  NATIVE06_COMPILER_FORBIDDEN_STAGES,
  compileNative06StrategyGenome,
} from './pipeline.ts';
export type {
  Native06CompilerStage,
  Native06StrategyCompilerPlan,
  Native06CompilerTargetStage,
} from './pipeline.ts';
export {
  HELIOS_NATIVE_STRATEGY_GENOME_BYTEX_QUALIFIED,
  HELIOS_NATIVE_STRATEGY_GENOME_BYTEX_BLOCKED,
  evaluateNative06BytexQualification,
} from './qualification.ts';
export type { Native06BytexQualificationChecks, Native06BytexQualificationResult } from './qualification.ts';
export { buildNative06EmaCrossGenomeFromVendorFixture, loadBytexEmaCrossDocumentJson } from './fixtures.ts';
