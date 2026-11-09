export {
  AUTONOMOUS_SHADOW_LAB_ARCHITECTURE_QUALIFIED,
  HELIOS_AUTONOMOUS_SHADOW_LAB_SCHEMA,
  HELIOS_AUTONOMOUS_SHADOW_LAB_V1_BLOCKED,
  HELIOS_AUTONOMOUS_SHADOW_LAB_V1_QUALIFIED,
  SHADOW_LAB_CHAOS_SCENARIOS,
  SHADOW_LAB_LONG_RUN_STEPS,
  SHADOW_LAB_WORK_PACKAGES,
  type ShadowLabChaosScenario,
  type ShadowLabLongRunStep,
  type ShadowLabWorkPackageId,
} from './taxonomy.ts';

export type {
  AutonomousShadowLabQualificationInput,
  AutonomousShadowLabQualificationResult,
} from './alpha25-qualification.ts';

export {
  evaluateAutonomousShadowLabQualification,
} from './alpha25-qualification.ts';

export { CANONICAL_SHADOW_MODULES } from './canonical-shadow-modules.ts';
export type { CanonicalShadowQualificationRow } from './canonical-stack-qualification.ts';
export { runCanonicalShadowStackQualification } from './canonical-stack-qualification.ts';
export {
  regenerateShadowLabReports,
  type ShadowLabSubprocessGateResults,
} from './report-writer.ts';

export {
  buildShadowLabWorkPackageRegistry,
  shadowLabWorkPackageBlockers,
  shadowLabWorkPackagesQualified,
} from './work-package-registry.ts';

export { evaluateShadowLabRealityGate } from './reality-gate.ts';
export { runShadowLabLongRun } from './simulation/long-run-harness.ts';
export { runShadowLabChaosHarness } from './chaos/resilience-harness.ts';

export { HELIOS_ALPHA16_CURRENT_MAIN, ALPHA16_PREREQUISITE_MARKER } from './alpha16-current-main.ts';
export { HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATION } from './alpha17-campaign-orchestration.ts';
export { HELIOS_ALPHA18_FORWARD_DATA_ADMISSION } from './alpha18-forward-data-admission.ts';
export { HELIOS_ALPHA19_OUTCOME_MATURITY } from './alpha19-outcome-maturity.ts';
export { HELIOS_ALPHA20_EXPERIMENTAL_COHORTS } from './alpha20-experimental-cohorts.ts';
export { HELIOS_ALPHA21_CONTINUOUS_SHADOW_PORTFOLIO } from './alpha21-continuous-shadow-portfolio.ts';
export { HELIOS_ALPHA22_CONTROL_ROOM, projectControlRoom } from './alpha22-control-room.ts';
export { HELIOS_ALPHA23_AUTOMATIC_DEMOTION } from './alpha23-automatic-demotion.ts';
export { HELIOS_ALPHA24_RECURRING_EVIDENCE_REPORTS } from './alpha24-recurring-evidence-reports.ts';

export {
  HELIOS_DURABLE_SHADOW_LAB_RUNTIME_SCHEMA,
  HELIOS_DURABLE_SHADOW_LAB_RUNTIME_V1_BLOCKED,
  HELIOS_DURABLE_SHADOW_LAB_RUNTIME_V1_QUALIFIED,
  HeliosDurableShadowLabRuntimeService,
  InMemoryShadowLabDurableStore,
  buildShadowLabRuntimeHealth,
  buildShadowLabRuntimeReadiness,
  evaluateDurableShadowLabRuntimeQualification,
  runAllRestartCrashPoints,
  runShadowLabRestartHarness,
  createShadowLabHttpRuntime,
  serveShadowLabHttpRuntime,
  type DurableShadowLabRuntimeQualificationResult,
  type ShadowLabDurableStore,
  type ShadowLabRestartHarnessResult,
  SHADOW_LAB_RESTART_CRASH_POINTS,
} from './ops01/index.ts';
