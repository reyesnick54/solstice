export {
  HELIOS_OS02_EXECUTION_TWIN,
  EXECUTION_TWIN_ENVIRONMENTS,
  EXECUTION_TWIN_ENVIRONMENT_ALIASES,
  EXECUTION_TWIN_PROVIDER_KINDS,
  EXECUTION_TWIN_RUN_STATES,
  EXECUTION_TWIN_EVENT_KINDS,
  EXECUTION_TWIN_ORDER_STATES,
  EXECUTION_TWIN_ASSUMPTION_CATEGORIES,
  resolveExecutionTwinEnvironment,
  defaultProviderKindForEnvironment,
  environmentPermitsProviderSubmit,
  type ExecutionTwinEnvironmentKind,
  type ExecutionTwinProviderKind,
  type ExecutionTwinRunState,
  type ExecutionTwinEventKind,
  type ExecutionTwinOrderState,
  type ExecutionTwinAssumptionCategory,
} from './taxonomy.ts';

export type {
  ExecutionTwinFeatureManifest,
  ExecutionTwinAssumption,
  ExecutionTwinEnvironment,
  ExecutionTwinEvent,
  ExecutionTwinOrderTransition,
  ExecutionTwinRunManifest,
  ExecutionTwinOutcome,
  ExecutionTwinGateDecision,
  ExecutionTwinRiskPort,
  ExecutionTwinCompliancePort,
  ExecutionTwinAuthorityPort,
  ExecutionTwinMandatePort,
  ExecutionTwinIntegrationPorts,
  ExecutionTwinRunInput,
  ExecutionTwinStoreSnapshot,
  ExecutionTwinRuntimeOptions,
} from './types.ts';

export { ExecutionTwinClock } from './clock.ts';
export { buildExecutionTwinEnvironment } from './environment.ts';
export {
  createExecutionTwinProvider,
  externalOperationIdForStep,
  assertEnvironmentProviderParity,
  historicalReplayPortFrom,
  HistoricalReplayProviderPort,
  type ExecutionTwinProvider,
} from './providers.ts';
export { buildExecutionTwinRunManifest, executionConfigDigest, strategyCapsuleUnchangedAcrossManifests } from './manifest.ts';
export { computeOutcomeFingerprint, buildExecutionTwinOutcome, digestPayload, gateDecisionDigest } from './outcome.ts';
export { InMemoryExecutionTwinStore } from './store.ts';
export { ExecutionTwinRuntime } from './runtime.ts';
export {
  EXECUTION_TWIN_FIXTURE_NOW,
  fixtureStrategyCapsule,
  fixtureFeatureManifest,
  fixtureRoutingRequest,
  fixtureExecutionTwinRunInput,
  deterministicRiskPort,
  defaultExecutionTwinPorts,
} from './fixtures.ts';
export {
  HELIOS_OS02_EXECUTION_TWIN_QUALIFIED,
  HELIOS_OS02_EXECUTION_TWIN_BLOCKED,
  evaluateOs02ExecutionTwinQualification,
  type Os02ExecutionTwinQualificationChecks,
  type Os02ExecutionTwinQualificationResult,
} from './qualification.ts';
export {
  HELIOS_ALPHA01_EXECUTION_TWIN_FORWARD_BRIDGE_SCHEMA,
  forwardAlphaLaneExecutionTwinEnvironment,
  bindForwardAlphaLaneToExecutionTwin,
  type Alpha01ExecutionTwinForwardBinding,
} from './alpha01-forward-evidence-bridge.ts';

/** OS03 — institutional paper execution and order-book simulation. */
export * as heliosExecutionSimulation from './simulation/index.ts';
export * from './simulation/index.ts';

/** NATIVE03 — native BYTEX deterministic trading runtime (TypeScript port, study-only upstream). */
export * as heliosNativeBytexRuntime from './bytex-native/index.ts';
export * from './bytex-native/index.ts';
