import type { UtcInstant } from '@solstice/domain';
import type {
  ResearchMonitorTriggerEvent,
  ResearchMonitorTriggerReason,
  TriggerSpecialistClass,
} from '../../open-source-integration/os07/research-monitor-contract.ts';
import type {
  HeliosResearchMonitorTriggerRecord,
  ResearchMonitorDefinition,
  ResearchMonitorEvaluation,
} from '../types.ts';

const AGENT_CLASS_TO_SPECIALIST: Readonly<Record<string, TriggerSpecialistClass>> = Object.freeze({
  MACRO: 'MACRO',
  EQUITY_SPECIALIST: 'FUNDAMENTAL',
  TECHNICAL: 'TECHNICAL',
  OPTIONS: 'OPTIONS',
  FLOW: 'FLOW',
  NEWS: 'NEWS',
  RISK: 'RISK',
  ADVERSARIAL_CRITIC: 'ADVERSARIAL_CRITIC',
  CRYPTO: 'CRYPTO_ONCHAIN',
  ALT_DATA: 'ALTERNATIVE_DATA',
});

function mapSpecialistClasses(allowedAgentClasses: readonly string[]): readonly TriggerSpecialistClass[] {
  const out = new Set<TriggerSpecialistClass>();
  for (const cls of allowedAgentClasses) {
    const mapped = AGENT_CLASS_TO_SPECIALIST[cls];
    if (mapped) {
      out.add(mapped);
    }
  }
  if (out.size === 0) {
    out.add('FUNDAMENTAL');
  }
  if (!out.has('ADVERSARIAL_CRITIC')) {
    out.add('ADVERSARIAL_CRITIC');
  }
  return Object.freeze([...out]);
}

function primaryFeatureRef(evaluation: ResearchMonitorEvaluation): string | null {
  const ok = evaluation.featureDiagnostics.find((row) => row.ok);
  return ok?.featureId ?? evaluation.featureDiagnostics[0]?.featureId ?? null;
}

function observationRef(evaluation: ResearchMonitorEvaluation): string | null {
  for (const diagnostic of evaluation.featureDiagnostics) {
    if (diagnostic.ok) {
      return `obs/${evaluation.monitorId}/${diagnostic.featureId}`;
    }
  }
  return null;
}

export function buildIntegrationTriggerEvent(input: {
  readonly definition: ResearchMonitorDefinition;
  readonly evaluation: ResearchMonitorEvaluation;
  readonly triggerRecord: HeliosResearchMonitorTriggerRecord;
  readonly customerId: string;
  readonly subjectId: string;
  readonly emittedAt: UtcInstant;
  readonly triggerReason?: ResearchMonitorTriggerReason;
}): ResearchMonitorTriggerEvent {
  const { definition, evaluation, triggerRecord, customerId, subjectId, emittedAt } = input;
  const triggerReason = input.triggerReason ?? 'THRESHOLD_CROSSED';
  const featureRef = primaryFeatureRef(evaluation);
  const obsRef = observationRef(evaluation);
  const cooldownSeconds = Math.max(1, Math.floor(definition.cooldownMs / 1000));
  const versionLabel = `${definition.version.major}.${definition.version.minor}.${definition.version.patch}`;

  return Object.freeze({
    triggerEventId: triggerRecord.triggerEventId,
    idempotencyKey:
      definition.trigger.idempotencyKey ??
      `proactive:${definition.monitorId}:${triggerRecord.fingerprint}`,
    dedupeFingerprint: triggerRecord.fingerprint,
    monitorId: definition.monitorId,
    monitorVersion: versionLabel,
    customerId,
    subjectId,
    triggerReason,
    triggerExplanation: definition.condition.description ?? triggerRecord.researchTopic,
    observationRef: obsRef,
    featureRef,
    availableInformation: Object.freeze({
      observationRefs: Object.freeze(obsRef ? [obsRef] : []),
      featureRefs: Object.freeze(featureRef ? [featureRef] : []),
      evidenceQuality: evaluation.outcome === 'TRIGGERED' ? 'MEDIUM' : 'INSUFFICIENT',
      dataAvailable: evaluation.featureDiagnostics.some((row) => row.ok),
      summary: `Monitor ${definition.name} condition met`,
      capturedAt: emittedAt,
    }),
    requestedSpecialistClasses: mapSpecialistClasses(definition.allowedAgentClasses),
    requestedBudgetMinor: definition.researchBudgetMinor,
    requestedBudgetCurrency: 'USD',
    cooldownKey: `cooldown:${definition.monitorId}:${subjectId}`,
    cooldownSeconds,
    confidenceBefore: 'LOW_CONFIDENCE',
    opportunityKind: 'GENERIC',
    emittedAt,
  });
}
