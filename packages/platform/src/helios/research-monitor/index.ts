/**
 * HELIOS OS07 — Research Monitor DSL (OpenChart Tea/trigger/monitor inspired).
 * Detects conditions on canonical HELIOS features and requests research only.
 */

export {
  RESEARCH_MONITOR_SCHEMA_VERSION,
  RESEARCH_MONITOR_TRIGGER_ACTIONS,
  HELIOS_CANONICAL_FEATURE_KINDS,
  RESEARCH_MONITOR_PRIORITIES,
  STALE_FEATURE_POLICIES,
  RESEARCH_MONITOR_RUNTIME_STATUSES,
  RESEARCH_MONITOR_EVAL_OUTCOMES,
  RESEARCH_MONITOR_BLOCK_REASONS,
  RESEARCH_MONITOR_BINARY_OPS,
  RESEARCH_MONITOR_MAX_EXPRESSION_DEPTH,
  RESEARCH_MONITOR_MAX_EXPRESSION_NODES,
  HELIOS_OS07_RESEARCH_MONITOR_DSL,
  HELIOS_OS07_RESEARCH_MONITOR_DSL_QUALIFIED,
  HELIOS_OS07_RESEARCH_MONITOR_DSL_BLOCKED,
  type ResearchMonitorTriggerAction,
  type HeliosCanonicalFeatureKind,
  type ResearchMonitorPriority,
  type StaleFeaturePolicy,
  type ResearchMonitorRuntimeStatus,
  type ResearchMonitorEvalOutcome,
  type ResearchMonitorBlockReason,
  type ResearchMonitorBinaryOp,
} from './taxonomy.ts';

export {
  asResearchMonitorId,
  asResearchMonitorManifestId,
  asResearchMonitorEvaluationId,
  asResearchMonitorTriggerEventId,
  researchMonitorEvaluationIdFor,
  researchMonitorTriggerEventIdFor,
  type ResearchMonitorId,
  type ResearchMonitorManifestId,
  type ResearchMonitorEvaluationId,
  type ResearchMonitorTriggerEventId,
} from './ids.ts';

export type {
  ResearchMonitorVersion,
  ResearchMonitorExpression,
  ResearchMonitorCondition,
  ResearchMonitorTrigger,
  PointInTimeFeatureRequirement,
  ResearchMonitorDefinition,
  ResearchMonitorManifest,
  CanonicalFeatureObservation,
  FeatureResolutionDiagnostic,
  ResearchMonitorState,
  HeliosResearchMonitorTriggerRecord,
  ResearchMonitorEvaluation,
  ResearchMonitorStoreSnapshot,
  AafFeatureFabricPort,
  HeliosObservationFabricPort,
  H20ResearchBudgetPort,
  ResearchMonitorEvaluateInput,
  CompileResearchMonitorResult,
} from './types.ts';

export { validateResearchMonitorExpression, collectFeatureRefs, isValidFeatureId } from './expression.ts';
export { compileResearchMonitorDefinition } from './compiler.ts';
export { evaluateResearchMonitorExpression, type ExpressionEvalContext } from './evaluate-expression.ts';
export { diagnoseFeatureObservation, buildFeatureValueMap, resolveFeaturePolicyBlock } from './feature-policy.ts';
export { createH20ResearchBudgetPort } from './h20-budget.ts';
export { InMemoryResearchMonitorStore } from './store.ts';
export { HeliosResearchMonitorService, type HeliosResearchMonitorServiceOptions } from './service.ts';
export {
  sealResearchMonitorManifest,
  sealResearchMonitorEvaluation,
  sealResearchMonitorTrigger,
} from './evidence.ts';
export {
  FIXTURE_MONITOR_NOW,
  semiconductorVolatilityDislocationDefinition,
  semiconductorVolatilityDislocationExpression,
  triggeredSemiconductorFeatureSet,
  staleNvdaVolFeatureSet,
  futureNvdaVolFeatureSet,
  missingBreadthFeatureSet,
} from './fixtures.ts';
export {
  evaluateOs07ResearchMonitorQualification,
  type Os07ResearchMonitorQualificationChecks,
  type Os07ResearchMonitorQualificationResult,
} from './qualification.ts';
export {
  buildProactiveInvestigationFromTrigger,
  type SerisProactiveInvestigation,
} from './seris-proactive-bridge.ts';
export {
  SerisResearchAutopilotLoop,
  type SerisMarketObservationPort,
  type SerisResearchAutopilotSchedule,
  type SerisResearchAutopilotTick,
} from './seris-research-autopilot-loop.ts';
export {
  evaluateResearchMonitorNative12Qualification,
  type ResearchMonitorNative12QualificationChecks,
  type ResearchMonitorNative12QualificationResult,
} from './native12-qualification.ts';
