import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import type { EvidenceVault } from '@solstice/evidence';
import type { ResearchMonitorTriggerEvent } from '../os07/research-monitor-contract.ts';
import type { ResearchSpendDecision } from '../../meta-allocator/taxonomy.ts';
import type { ResearchValueAssessment } from '../../meta-allocator/types.ts';
import type { ResearchTriggerRunId } from './ids.ts';
import type {
  ResearchTriggerConfidenceDelta,
  ResearchTriggerCostAccounting,
  ResearchTriggerEvidenceRecord,
  ResearchTriggerMeshAgentSummary,
} from './types.ts';

export class ResearchTriggerEvidence {
  sealTriggeredResearch(
    vault: EvidenceVault | undefined,
    input: {
      readonly runId: ResearchTriggerRunId;
      readonly trigger: ResearchMonitorTriggerEvent;
      readonly agentsRan: readonly ResearchTriggerMeshAgentSummary[];
      readonly sourcesUsed: readonly string[];
      readonly cost: ResearchTriggerCostAccounting;
      readonly confidenceBefore: ResearchMonitorTriggerEvent['confidenceBefore'];
      readonly confidenceAfter: ResearchMonitorTriggerEvent['confidenceBefore'];
      readonly voiAssessment: ResearchValueAssessment;
      readonly spendDecision: ResearchSpendDecision;
      readonly now: UtcInstant;
    },
  ): ResearchTriggerEvidenceRecord {
    const confidenceDelta = confidenceDeltaFor(input.confidenceBefore, input.confidenceAfter);
    const evidenceRecordId = `rtrev_${createHash('sha256').update(input.runId).digest('hex').slice(0, 20)}`;
    const sealedVaultEvidenceId = vault
      ? (vault.seal('HELIOS_OS08_TRIGGERED_RESEARCH', {
          runId: input.runId,
          triggerEventId: input.trigger.triggerEventId,
          monitorId: input.trigger.monitorId,
          whyTriggered: input.trigger.triggerExplanation,
          grantsFinancialEffect: false,
          postsJournal: false,
          agentsRan: input.agentsRan.map((row) => row.role),
          sourcesUsed: input.sourcesUsed,
          totalCostMicros: input.cost.totalCostMicros.toString(),
          confidenceDelta,
          spendDecision: input.spendDecision,
          voiTier: input.voiAssessment.informationValueTier,
        })?.evidenceId ?? null)
      : null;

    return Object.freeze({
      evidenceRecordId,
      runId: input.runId,
      triggerEventId: input.trigger.triggerEventId,
      whyTriggered: input.trigger.triggerExplanation,
      availableInformationSummary: input.trigger.availableInformation.summary,
      observationRef: input.trigger.observationRef,
      featureRef: input.trigger.featureRef,
      agentsRan: Object.freeze([...input.agentsRan]),
      sourcesUsed: Object.freeze([...input.sourcesUsed]),
      cost: input.cost,
      confidenceDelta,
      voiAssessment: input.voiAssessment,
      spendDecision: input.spendDecision,
      sealedVaultEvidenceId,
      recordedAt: input.now,
    });
  }
}

function confidenceDeltaFor(
  before: ResearchMonitorTriggerEvent['confidenceBefore'],
  after: ResearchMonitorTriggerEvent['confidenceBefore'],
): ResearchTriggerConfidenceDelta {
  const rank = (value: ResearchMonitorTriggerEvent['confidenceBefore']): number => {
    switch (value) {
      case 'CALIBRATED':
        return 2;
      case 'LOW_CONFIDENCE':
        return 1;
      default:
        return 0;
    }
  };
  const delta = rank(after) - rank(before);
  const deltaLabel =
    delta > 0 ? 'IMPROVED' : delta < 0 ? 'DEGRADED' : before === after ? 'UNCHANGED' : 'UNKNOWN';
  return Object.freeze({
    confidenceBefore: before,
    confidenceAfter: after,
    deltaLabel,
  });
}
