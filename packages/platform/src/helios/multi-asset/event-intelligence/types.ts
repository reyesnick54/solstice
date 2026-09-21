/**
 * HELIOS Multi-Asset M14 — macro and event intelligence types.
 *
 * Preserves distinction between source facts, structured observations,
 * model inferences, and agent hypotheses. Research only — not execution authority.
 */

import type { UtcInstant } from '@solstice/domain';
import type {
  EventImpactSeverity,
  EventRelevanceState,
  HELIOS_MACRO_EVENT_INTELLIGENCE_AUTHORITY,
  HELIOS_MACRO_EVENT_INTELLIGENCE_SCHEMA,
  ImpactDirectionHypothesis,
  KnowledgeLayer,
  MacroEventDomain,
  MacroEventModelRoute,
  MacroEventType,
} from './taxonomy.ts';

export type MacroEventProvenance = {
  readonly providerId: string;
  readonly sourceId: string;
  readonly sourceUrl: string | null;
  readonly rawPayloadHash: string;
  readonly upstreamSourceRef: string | null;
  readonly ingestionId: string;
};

export type MacroEventEvidenceRef = {
  readonly evidenceId: string;
  readonly layer: KnowledgeLayer;
  readonly sourceId: string | null;
  readonly arrivalTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly excerptHash: string | null;
};

export type MacroEventValueObservation = {
  readonly metricId: string;
  readonly unit: string;
  readonly valueMinorUnits: bigint | null;
  readonly valueText: string | null;
  readonly layer: KnowledgeLayer;
  readonly sourceId: string;
  readonly knowableAt: UtcInstant;
};

export type MacroEventSurprise = {
  readonly metricId: string;
  readonly expected: MacroEventValueObservation | null;
  readonly actual: MacroEventValueObservation | null;
  readonly surpriseMinorUnits: bigint | null;
  readonly surpriseText: string | null;
  readonly calculable: boolean;
  readonly computedAt: UtcInstant;
  readonly layer: 'structured_observation';
};

export type MacroEventRelevanceWindow = {
  readonly preEventMinutes: number;
  readonly postEventMinutes: number;
  readonly expiresAt: UtcInstant;
};

/** Canonical macro/market-moving event artifact. */
export type MacroEventArtifact = {
  readonly schema: typeof HELIOS_MACRO_EVENT_INTELLIGENCE_SCHEMA;
  readonly authority: typeof HELIOS_MACRO_EVENT_INTELLIGENCE_AUTHORITY;
  readonly eventId: string;
  readonly eventType: MacroEventType;
  readonly domain: MacroEventDomain;
  readonly title: string;
  readonly description: string;
  readonly jurisdiction: string;
  readonly region: string | null;
  readonly affectedAssetClasses: readonly string[];
  readonly affectedInstrumentIds: readonly string[];
  readonly scheduledTime: UtcInstant | null;
  readonly observedTime: UtcInstant | null;
  readonly arrivalTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly source: string;
  readonly provenance: MacroEventProvenance;
  readonly confidence: string;
  readonly expectedValues: readonly MacroEventValueObservation[];
  readonly actualValues: readonly MacroEventValueObservation[];
  readonly surprise: MacroEventSurprise | null;
  readonly evidenceRefs: readonly MacroEventEvidenceRef[];
  readonly relevanceWindow: MacroEventRelevanceWindow;
  readonly knowledgeLayer: KnowledgeLayer;
  readonly grantsExecutionAuthority: false;
  readonly grantsFinancialMutation: false;
};

export type SealedMacroEvent = {
  readonly artifact: MacroEventArtifact;
  readonly sealedAt: UtcInstant;
};

export type EventImpactEvidence = {
  readonly evidenceId: string;
  readonly layer: KnowledgeLayer;
  readonly statement: string;
  readonly supportsDirection: ImpactDirectionHypothesis | null;
};

/** Research-only impact object — direction is hypothesis, not financial authority. */
export type MacroEventImpact = {
  readonly impactId: string;
  readonly eventId: string;
  readonly affectedInstrumentIds: readonly string[];
  readonly affectedAssetClasses: readonly string[];
  readonly directionHypothesis: ImpactDirectionHypothesis;
  readonly uncertainty: string;
  readonly severity: EventImpactSeverity;
  readonly supportingEvidence: readonly EventImpactEvidence[];
  readonly contradictoryEvidence: readonly EventImpactEvidence[];
  readonly invalidatingConditions: readonly string[];
  readonly knowledgeLayer: KnowledgeLayer;
  readonly modelRoute: MacroEventModelRoute | null;
  readonly evaluatedAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
  readonly grantsFinancialMutation: false;
};

export type MacroEventInferenceProposal = {
  readonly proposalId: string;
  readonly eventId: string;
  readonly statement: string;
  readonly knowledgeLayer: 'model_inference' | 'agent_hypothesis';
  readonly modelRoute: MacroEventModelRoute;
  readonly citedEvidenceIds: readonly string[];
  readonly unsupported: boolean;
  readonly evaluatedAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
};

export type EventBlackoutWindow = {
  readonly blackoutId: string;
  readonly eventId: string;
  readonly domain: MacroEventDomain;
  readonly severity: EventImpactSeverity;
  readonly startsAt: UtcInstant;
  readonly endsAt: UtcInstant;
  readonly strategyAllowed: boolean;
  readonly reason: string;
};

export type UpcomingEventQuery = {
  readonly asOf: UtcInstant;
  readonly horizonMinutes: number;
  readonly minSeverity?: EventImpactSeverity;
  readonly domains?: readonly MacroEventDomain[];
  readonly instrumentId?: string;
};

export type UpcomingEventMatch = {
  readonly event: MacroEventArtifact;
  readonly relevanceState: EventRelevanceState;
  readonly minutesUntilScheduled: number | null;
  readonly highImpact: boolean;
};

export type StrategyEventSafetyQuery = {
  readonly strategyId: string;
  readonly asOf: UtcInstant;
  readonly instrumentIds: readonly string[];
};

export type StrategyEventSafetyResult = {
  readonly strategyId: string;
  readonly allowed: boolean;
  readonly approachingHighImpactEvent: boolean;
  readonly activeBlackouts: readonly EventBlackoutWindow[];
  readonly upcomingEvents: readonly UpcomingEventMatch[];
  readonly reason: string;
};

export type MacroEventStoreSnapshot = {
  readonly events: readonly SealedMacroEvent[];
  readonly impacts: readonly MacroEventImpact[];
  readonly proposals: readonly MacroEventInferenceProposal[];
  readonly blackouts: readonly EventBlackoutWindow[];
};

export type IngestMacroEventInput = {
  readonly eventId: string;
  readonly eventType: MacroEventType;
  readonly domain: MacroEventDomain;
  readonly title: string;
  readonly description: string;
  readonly jurisdiction: string;
  readonly region?: string | null;
  readonly affectedAssetClasses: readonly string[];
  readonly affectedInstrumentIds?: readonly string[];
  readonly scheduledTime?: UtcInstant | null;
  readonly observedTime?: UtcInstant | null;
  readonly arrivalTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly source: string;
  readonly provenance: MacroEventProvenance;
  readonly confidence: string;
  readonly expectedValues?: readonly MacroEventValueObservation[];
  readonly actualValues?: readonly MacroEventValueObservation[];
  readonly evidenceRefs?: readonly MacroEventEvidenceRef[];
  readonly relevanceWindow: MacroEventRelevanceWindow;
  readonly knowledgeLayer: KnowledgeLayer;
};

export type IngestMacroEventResult =
  | { readonly ok: true; readonly sealed: SealedMacroEvent; readonly surprise: MacroEventSurprise | null }
  | { readonly ok: false; readonly reason: string };
