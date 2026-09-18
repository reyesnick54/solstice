export {
  HELIOS_H31_RESILIENCE_SCHEMA,
  RESILIENCE_FAILURE_DOMAINS,
  RESILIENCE_SEVERITIES,
  RESILIENCE_SCENARIO_TIERS,
  RESILIENCE_OUTCOMES,
  RESILIENCE_SCENARIO_CATALOG,
  scenarioDefinition,
  scenariosForTier,
  type ResilienceFailureDomain,
  type ResilienceOutcome,
  type ResilienceScenarioDefinition,
  type ResilienceScenarioId,
  type ResilienceScenarioTier,
  type ResilienceSeverity,
} from './taxonomy.ts';

export {
  HELIOS_RESILIENCE_INVARIANT_IDS,
  baselineResilienceInvariants,
  allInvariantsHeld,
  criticalInvariantBreaches,
  heldInvariant,
  breachedInvariant,
  type HeliosResilienceInvariantId,
  type HeliosResilienceInvariantResult,
} from './invariants.ts';

export {
  HELIOS_FAULT_INJECTION_ENV,
  assessFaultInjectionGate,
  assertFaultInjectionAllowed,
  createFault,
  createFaultInjector,
  payloadContainsSecrets,
  redactSecrets,
  type FaultInjectionGate,
  type FaultKind,
  type InjectedFault,
} from './fault-injection.ts';

export {
  runResilienceScenario,
  runResilienceScenarios,
  runAllResilienceScenarios,
} from './scenarios.ts';

export {
  buildResilienceQualificationReport,
  serializeResilienceReport,
  type ResilienceQualificationReport,
  type ResilienceScenarioReportRow,
} from './report.ts';

export {
  HELIOS_H31_ADVERSARIAL_RESILIENCE,
  HELIOS_RESILIENCE_QUALIFIED,
  HELIOS_RESILIENCE_BLOCKED,
  evaluateHeliosResilienceQualification,
  type HeliosResilienceQualificationResult,
} from './qualification.ts';
