export {
  HELIOS_ENGINEERING_BASELINE_SCHEMA,
  HELIOS_ENGINEERING_BASELINE_V2_QUALIFIED,
  HELIOS_ENGINEERING_BASELINE_V2_BLOCKED,
  HEALTH06_PROGRAM,
  ENGINEERING_BASELINE_SCORECARD_DIMENSIONS,
  type EngineeringBaselineScorecardDimension,
  type EngineeringBaselineGateId,
} from './taxonomy.ts';

export {
  HELIOS_STRICT_TYPECHECK_PATH_FRAGMENTS,
  lineMatchesHeliosStrictScope,
  evaluateHeliosStrictScopedTypecheck,
} from './typecheck-scope.ts';

export {
  buildEngineeringBaselineScorecard,
  type EngineeringBaselineGateResult,
  type EngineeringBaselineScorecardRow,
} from './gates.ts';

export {
  evaluateEngineeringBaselineQualification,
  type EngineeringBaselineQualificationInput,
  type EngineeringBaselineQualificationResult,
} from './qualification.ts';

export { renderEngineeringBaselineMarkdown } from './report.ts';

export {
  HELIOS_STRICT_TYPECHECK_QUALIFIED,
  HELIOS_STRICT_TYPECHECK_BLOCKED,
  HELIOS_STRICT_TYPECHECK_SCOPE,
  type HeliosStrictTypecheckMarker,
  type HeliosStrictTypecheckScopePath,
} from './strict-typecheck-qualification.ts';

export {
  HELIOS_ARCHITECTURE_CLEAN_QUALIFIED,
  HELIOS_ARCHITECTURE_CLEAN_BLOCKED,
  assessHeliosArchitectureCleanQualification,
  type HeliosArchitectureCleanMarker,
  type HeliosArchitectureCleanQualification,
} from './architecture-clean-qualification.ts';

export {
  HEALTH08_PROGRAM,
  HELIOS_RESTART_RECOVERY_QUALIFIED,
  HELIOS_RESTART_RECOVERY_BLOCKED,
  evaluateHeliosRestartRecoveryQualification,
  type HeliosRestartRecoveryMarker,
  type HeliosDrHarnessReport,
  type HeliosRestartRecoveryQualification,
} from './restart-recovery-qualification.ts';
