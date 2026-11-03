/**
 * OS07 Research Monitor → OS08 trigger contract (integration boundary only).
 * Monitors emit bounded trigger events; OS08 routes them into HELIOS research work orders.
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';

export const TRIGGER_SPECIALIST_CLASSES = [
  'TECHNICAL',
  'FUNDAMENTAL',
  'EARNINGS',
  'MACRO',
  'NEWS',
  'OPTIONS',
  'FLOW',
  'CRYPTO_ONCHAIN',
  'ALTERNATIVE_DATA',
  'RISK',
  'ADVERSARIAL_CRITIC',
] as const;

export type TriggerSpecialistClass = (typeof TRIGGER_SPECIALIST_CLASSES)[number];

export const RESEARCH_MONITOR_TRIGGER_REASONS = [
  'THRESHOLD_CROSSED',
  'PATTERN_DETECTED',
  'FRESHNESS_RECOVERED',
  'ANOMALY_SCORE',
  'SCHEDULED_REEVAL',
  'MANUAL_OPERATOR',
] as const;

export type ResearchMonitorTriggerReason = (typeof RESEARCH_MONITOR_TRIGGER_REASONS)[number];

export type ResearchMonitorAvailableInformation = {
  readonly observationRefs: readonly string[];
  readonly featureRefs: readonly string[];
  readonly evidenceQuality: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
  readonly dataAvailable: boolean;
  readonly summary: string;
  readonly capturedAt: UtcInstant;
};

/** Emitted by OS07 when a monitor definition fires. */
export type ResearchMonitorTriggerEvent = {
  readonly triggerEventId: string;
  readonly idempotencyKey: string;
  readonly dedupeFingerprint: string;
  readonly monitorId: string;
  readonly monitorVersion: string;
  readonly customerId: string;
  readonly subjectId: string;
  readonly triggerReason: ResearchMonitorTriggerReason;
  readonly triggerExplanation: string;
  readonly observationRef: string | null;
  readonly featureRef: string | null;
  readonly availableInformation: ResearchMonitorAvailableInformation;
  readonly requestedSpecialistClasses: readonly TriggerSpecialistClass[];
  readonly requestedBudgetMinor: string;
  readonly requestedBudgetCurrency: string;
  readonly cooldownKey: string;
  readonly cooldownSeconds: number;
  readonly confidenceBefore: 'CALIBRATED' | 'LOW_CONFIDENCE' | 'UNKNOWN';
  readonly opportunityKind?:
    | 'CASH_YIELD'
    | 'RELATIVE_VALUE'
    | 'MACRO_HEDGE'
    | 'DIRECTIONAL_EQUITY'
    | 'GENERIC';
  readonly emittedAt: UtcInstant;
};
