export { AAF04_COMPILER_VERSION } from './version.ts';
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
