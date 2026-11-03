export { AAF04_COMPILER_VERSION } from './version.ts';
export type {
  CorporateActionRevisionRow,
  TemporalFeatureDefinition,
  TemporalObservation,
  TickerSymbolRow,
  UniverseMembershipRow,
} from '../temporal-types.ts';
export {
  LEAKAGE_REASON_CODES,
  assertCorporateActionKnowable,
  assertFutureConstituentLeak,
  assertObservationKnowable,
  assertTickerKnowable,
  assertUniverseMembershipKnowable,
  detectRestatementLeak,
  isKnowableAtDecision,
  isUniverseMemberAt,
  type LeakageReasonCode,
  type LeakageViolation,
} from './leakage.ts';
export {
  asOfJoinOnSourceEvent,
  filterKnowableObservations,
  selectAsOfLatest,
  selectAsOfSeries,
  type AsOfSelection,
} from './as-of.ts';
export { crossSectionalRankBps, laggedValueMinor, rollingSumMinor } from './rolling.ts';
export {
  asPointInTimeDatasetManifestId,
  assertManifestReproducible,
  freezePointInTimeDatasetManifest,
  type CompilerFailure,
  type PointInTimeDatasetManifest,
  type PointInTimeDatasetManifestId,
} from './manifest.ts';
export {
  compileFeatureVector,
  compilePointInTimeDatasetManifest,
  reproduceVectorsFromManifest,
  type CompileFeatureVectorInput,
  type CompiledFeatureValue,
  type CompiledFeatureVector,
  type FeatureCompilerContext,
} from './compile.ts';
export {
  evaluateAaf04Qualification,
  HELIOS_AAF04_POINT_IN_TIME_COMPILER_BLOCKED,
  HELIOS_AAF04_POINT_IN_TIME_COMPILER_QUALIFIED,
  type Aaf04QualificationChecks,
  type Aaf04QualificationResult,
} from './qualification.ts';
export { AAFV2_03_COMPILER_VERSION } from './v2-version.ts';
export {
  AAFV2_03_LEAKAGE_REASON_CODES,
  legacyCodeToAafv203,
  mapLegacyLeakageToAafv203,
  scanPointInTimeLeakage,
  toLeakageViolationV2,
  type Aafv203LeakageReasonCode,
  type LeakageViolationV2,
} from './leakage-scanner.ts';
export {
  freezeAafv203PointInTimeDatasetManifest,
  recomputeAafv203ManifestHash,
  type FreezeAafv203ManifestInput,
} from './v2-manifest.ts';
export {
  INFORMATION_TIME_POLICY_DEFAULT,
  REVISION_SELECTION_POLICIES,
  TEMPORAL_JOIN_POLICIES,
  revisionPolicyFromSelection,
  type Aafv203CompilerFailure,
  type DatasetQualification,
  type InformationTimePolicy,
  type PointInTimeDataset,
  type PointInTimeDatasetRequest,
  type RevisionSelectionPolicy,
  type TemporalJoinPolicy,
  type UniverseMemberRef,
  type UniverseSnapshot,
} from './v2-types.ts';
export {
  PointInTimeDatasetCompiler,
  createPointInTimeDatasetCompiler,
} from './dataset-compiler.ts';
export {
  STRATEGY_GENOME_PIT_COMPILER_REQUIRED,
  acceptPointInTimeDatasetManifest,
  isAafv203PointInTimeManifest,
  legacyCapsuleEvaluationDatasetAdapter,
  pitManifestMatchesEvaluationId,
  pitManifestMatchesStrategyGenome,
  requireCompiledPointInTimeDataset,
  resolvePointInTimeVectorsForEvaluation,
  type PointInTimeFeatureEvaluationAttachment,
  type StrategyGenomeDatasetGateFailure,
} from './strategy-lab-bridge.ts';
export {
  evaluateAafv203Qualification,
  HELIOS_AAFV2_03_POINT_IN_TIME_COMPILER_BLOCKED,
  HELIOS_AAFV2_03_POINT_IN_TIME_COMPILER_QUALIFIED,
  type Aafv203QualificationChecks,
  type Aafv203QualificationResult,
} from './v2-qualification.ts';
