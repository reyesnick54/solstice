export {
  GROK_RESEARCH_SCHEMA_VERSION,
  ASSERTION_KINDS,
  RESEARCH_RECOMMENDATION_CLASSES,
  RESEARCH_COMPLETION_STATUSES,
  RESEARCH_PRIVACY_CLASSES,
  RESEARCH_TOOL_CATEGORIES,
  TOOL_AUTHORIZATION_OUTCOMES,
  HELIOS_H11_GROK_RESEARCH,
  type AssertionKind,
  type ResearchRecommendationClass,
  type ResearchCompletionStatus,
  type ResearchPrivacyClass,
  type ResearchToolCategory,
  type ToolAuthorizationOutcome,
} from './taxonomy.ts';

export type {
  ResearchEvidenceRef,
  ResearchAssertion,
  ResearchHypothesis,
  ResearchCandidateRef,
  GrokResearchUsage,
  GrokResearchResult,
  HeliosResearchTaskInput,
  ResearchToolRequest,
  ResearchToolCallRecord,
  ResearchLoopLimits,
  ResearchReasoningStep,
  GrokResearchFailure,
} from './types.ts';

export { buildPublicResearchContext, defaultPrivacyClassForTask } from './context-sanitizer.ts';
export type { SanitizedResearchContext } from './context-sanitizer.ts';

export {
  HeliosResearchToolRegistry,
  createDefaultResearchToolRegistry,
  type ResearchToolDefinition,
  type ResearchToolExecutor,
  type RegisteredResearchTool,
} from './tool-registry.ts';

export { authorizeResearchToolRequest, type ToolAuthorizationDecision } from './tool-authorizer.ts';
export { DEFAULT_RESEARCH_LOOP_LIMITS, STRICT_RESEARCH_LOOP_LIMITS } from './limits.ts';
export {
  evidenceRefFromToolCall,
  bindAssertionToEvidence,
  collectKnownEvidenceIds,
  modelCannotSelfVerify,
} from './evidence-binding.ts';
export {
  initialBudgetLedger,
  recordModelCall,
  recordToolCall,
  isBudgetExhausted,
  toResearchUsage,
  buildSpendRecords,
  type BudgetLedger,
} from './budget-accounting.ts';
export { PublicResearchCache, type PublicResearchCacheEntry } from './cache.ts';
export { InMemoryGrokResearchStore, type GrokResearchStoreSnapshot } from './store.ts';
export {
  SimulationResearchReasoningEngine,
  UnavailableGrokReasoningEngine,
  type ResearchReasoningEngine,
  type ReasoningEngineInput,
  type ReasoningEngineOutput,
} from './reasoning.ts';
export { buildGrokResearchResult, parseGrokResearchResult } from './parse.ts';
export { runBoundedResearchToolLoop, createToolRequest, type ToolLoopOutcome } from './tool-loop.ts';
export { GrokResearchRuntime, type GrokResearchRuntimePorts } from './runtime.ts';
export { routeResearchCandidatesToH09, type CandidateRoutingOutcome } from './candidate-routing.ts';
export {
  createGrokResearchTaskHandler,
  parseGrokResearchPayload,
  registerGrokResearchWorker,
  taskInputFromHeliosTask,
  type GrokResearchTaskPayload,
} from './worker.ts';
