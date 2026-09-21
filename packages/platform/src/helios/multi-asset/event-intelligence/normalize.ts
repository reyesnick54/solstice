/**
 * Normalize raw macro event inputs into canonical artifacts.
 */

import type { UtcInstant } from '@solstice/domain';
import {
  HELIOS_MACRO_EVENT_INTELLIGENCE_AUTHORITY,
  HELIOS_MACRO_EVENT_INTELLIGENCE_SCHEMA,
} from './taxonomy.ts';
import { computeSurprise } from './calculations.ts';
import type {
  IngestMacroEventInput,
  MacroEventArtifact,
  MacroEventSurprise,
} from './types.ts';

export function normalizeMacroEvent(
  input: IngestMacroEventInput,
  sealedAt: UtcInstant,
): { readonly artifact: MacroEventArtifact; readonly surprise: MacroEventSurprise | null } {
  if (input.knowledgeLayer === 'model_inference' || input.knowledgeLayer === 'agent_hypothesis') {
    throw new Error('INFERENCE_CANNOT_BE_INGESTED_AS_FACT');
  }

  const expectedValues = Object.freeze([...(input.expectedValues ?? [])]);
  const actualValues = Object.freeze([...(input.actualValues ?? [])]);

  for (const value of [...expectedValues, ...actualValues]) {
    if (value.layer === 'model_inference' || value.layer === 'agent_hypothesis') {
      throw new Error('INFERENCE_VALUE_CANNOT_BE_CANONICAL_FACT');
    }
  }

  const primaryMetric = expectedValues[0]?.metricId ?? actualValues[0]?.metricId ?? null;
  const surprise = primaryMetric
    ? computeSurprise({
        metricId: primaryMetric,
        expected: expectedValues,
        actual: actualValues,
        computedAt: sealedAt,
      })
    : null;

  const artifact: MacroEventArtifact = Object.freeze({
    schema: HELIOS_MACRO_EVENT_INTELLIGENCE_SCHEMA,
    authority: HELIOS_MACRO_EVENT_INTELLIGENCE_AUTHORITY,
    eventId: input.eventId,
    eventType: input.eventType,
    domain: input.domain,
    title: input.title,
    description: input.description,
    jurisdiction: input.jurisdiction,
    region: input.region ?? null,
    affectedAssetClasses: Object.freeze([...input.affectedAssetClasses]),
    affectedInstrumentIds: Object.freeze([...(input.affectedInstrumentIds ?? [])]),
    scheduledTime: input.scheduledTime ?? null,
    observedTime: input.observedTime ?? null,
    arrivalTime: input.arrivalTime,
    knowableAt: input.knowableAt,
    source: input.source,
    provenance: Object.freeze({ ...input.provenance }),
    confidence: input.confidence,
    expectedValues,
    actualValues,
    surprise,
    evidenceRefs: Object.freeze([...(input.evidenceRefs ?? [])]),
    relevanceWindow: Object.freeze({ ...input.relevanceWindow }),
    knowledgeLayer: input.knowledgeLayer,
    grantsExecutionAuthority: false,
    grantsFinancialMutation: false,
  });

  return Object.freeze({ artifact, surprise });
}

export function mergeLateArrivingActual(input: {
  readonly existing: MacroEventArtifact;
  readonly actualValues: readonly import('./types.ts').MacroEventValueObservation[];
  readonly knowableAt: UtcInstant;
  readonly arrivalTime: UtcInstant;
  readonly sealedAt: UtcInstant;
}): MacroEventArtifact {
  const mergedActual = Object.freeze([
    ...input.existing.actualValues.filter(
      (v) => !input.actualValues.some((n) => n.metricId === v.metricId && n.sourceId === v.sourceId),
    ),
    ...input.actualValues,
  ]);

  const primaryMetric = input.existing.expectedValues[0]?.metricId ?? mergedActual[0]?.metricId ?? null;
  const surprise = primaryMetric
    ? computeSurprise({
        metricId: primaryMetric,
        expected: input.existing.expectedValues,
        actual: mergedActual,
        computedAt: input.sealedAt,
      })
    : input.existing.surprise;

  return Object.freeze({
    ...input.existing,
    actualValues: mergedActual,
    knowableAt: input.knowableAt,
    arrivalTime: input.arrivalTime,
    surprise,
  });
}
