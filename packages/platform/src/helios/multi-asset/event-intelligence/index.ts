/**
 * HELIOS Multi-Asset M14 — Macro and Event Intelligence Fabric.
 */

export {
  HELIOS_MACRO_EVENT_INTELLIGENCE_SCHEMA,
  HELIOS_MACRO_EVENT_INTELLIGENCE_AUTHORITY,
  MACRO_EVENT_TYPES,
  MACRO_EVENT_DOMAINS,
  KNOWLEDGE_LAYERS,
  IMPACT_DIRECTION_HYPOTHESES,
  EVENT_IMPACT_SEVERITIES,
  EVENT_RELEVANCE_STATES,
  MACRO_EVENT_MODEL_ROUTES,
  HELIOS_MULTI_ASSET_M14,
  type MacroEventType,
  type MacroEventDomain,
  type KnowledgeLayer,
  type ImpactDirectionHypothesis,
  type EventImpactSeverity,
  type EventRelevanceState,
  type MacroEventModelRoute,
} from './taxonomy.ts';

export type {
  MacroEventProvenance,
  MacroEventEvidenceRef,
  MacroEventValueObservation,
  MacroEventSurprise,
  MacroEventRelevanceWindow,
  MacroEventArtifact,
  SealedMacroEvent,
  EventImpactEvidence,
  MacroEventImpact,
  MacroEventInferenceProposal,
  EventBlackoutWindow,
  UpcomingEventQuery,
  UpcomingEventMatch,
  StrategyEventSafetyQuery,
  StrategyEventSafetyResult,
  MacroEventStoreSnapshot,
  IngestMacroEventInput,
  IngestMacroEventResult,
} from './types.ts';

export {
  computeSurprise,
  resolveEventRelevanceState,
  minutesUntilScheduled,
  isEventStale,
  isHighImpactDomain,
} from './calculations.ts';

export { normalizeMacroEvent, mergeLateArrivingActual } from './normalize.ts';

export {
  createMacroEventIntelligenceStore,
  type MacroEventIntelligenceStore,
} from './store.ts';

export {
  MacroEventIntelligenceFabric,
  createMacroEventIntelligenceFabric,
  type MacroEventIntelligenceFabricOptions,
} from './fabric.ts';

export { buildEventImpact, inferDirectionFromSurprise } from './impact.ts';

export {
  routeMacroEventModel,
  createInferenceProposal,
  assertNotInferenceAsFact,
} from './inference.ts';

export { deriveBlackoutWindow, isWithinBlackout } from './blackout.ts';

export {
  queryUpcomingEvents,
  assessStrategyEventSafety,
  detectConflictingSources,
} from './queries.ts';

export {
  cpiScheduledFixture,
  cpiObservedReleaseFixture,
  fomcPolicyFixture,
  eiaInventoryFixture,
  opecEventFixture,
  staleEventFixture,
} from './fixtures.ts';

export {
  HELIOS_MULTI_ASSET_M14_MACRO_EVENT_INTELLIGENCE_QUALIFIED,
  HELIOS_MULTI_ASSET_M14_MACRO_EVENT_INTELLIGENCE_BLOCKED,
  evaluateMacroEventIntelligenceQualification,
  type MacroEventIntelligenceQualificationChecks,
  type MacroEventIntelligenceQualificationResult,
} from './qualification.ts';
