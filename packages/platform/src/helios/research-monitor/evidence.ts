import type { EvidenceVault } from '@solstice/evidence';
import type {
  HeliosResearchMonitorTriggerRecord,
  ResearchMonitorEvaluation,
  ResearchMonitorManifest,
} from './types.ts';

export function sealResearchMonitorManifest(
  vault: EvidenceVault | undefined,
  manifest: ResearchMonitorManifest,
): string | null {
  if (!vault) {
    return null;
  }
  const sealed = vault.seal('HELIOS_RESEARCH_MONITOR_MANIFEST', {
    manifestId: manifest.manifestId,
    monitorId: manifest.monitorId,
    definitionHash: manifest.definitionHash,
    expressionHash: manifest.expressionHash,
    featureRefs: manifest.featureRefs,
    grantsTradingAction: false,
    triggerAction: manifest.trigger.action,
  });
  return sealed?.evidenceId ?? null;
}

export function sealResearchMonitorEvaluation(
  vault: EvidenceVault | undefined,
  evaluation: ResearchMonitorEvaluation,
): string | null {
  if (!vault) {
    return null;
  }
  const sealed = vault.seal('HELIOS_RESEARCH_MONITOR_EVALUATION', {
    evaluationId: evaluation.evaluationId,
    monitorId: evaluation.monitorId,
    outcome: evaluation.outcome,
    conditionMet: evaluation.conditionMet,
    triggerEmitted: evaluation.triggerEmitted,
    blockReason: evaluation.blockReason,
    deterministic: true,
    grantsTradingAction: false,
  });
  return sealed?.evidenceId ?? null;
}

export function sealResearchMonitorTrigger(
  vault: EvidenceVault | undefined,
  trigger: HeliosResearchMonitorTriggerRecord,
): string | null {
  if (!vault) {
    return null;
  }
  const sealed = vault.seal('HELIOS_RESEARCH_MONITOR_TRIGGER', {
    triggerEventId: trigger.triggerEventId,
    monitorId: trigger.monitorId,
    action: trigger.action,
    researchTopic: trigger.researchTopic,
    fingerprint: trigger.fingerprint,
    budgetReservedMinor: trigger.budgetReservedMinor,
    grantsTradingAction: false,
  });
  return sealed?.evidenceId ?? null;
}
