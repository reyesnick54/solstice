import type { EvidenceVault } from '@solstice/evidence';
import type { ProactivePipelineRecord } from './types.ts';

export function sealProactivePipelineRecord(
  vault: EvidenceVault | undefined,
  record: ProactivePipelineRecord,
): string | null {
  if (!vault) {
    return null;
  }
  const sealed = vault.seal('HELIOS_PROACTIVE_RESEARCH_PIPELINE', {
    recordId: record.recordId,
    kind: record.kind,
    stage: record.stage,
    monitorId: record.monitorId,
    eventId: record.eventId,
    triggerEventId: record.triggerEventId,
    runId: record.runId,
    detail: record.detail,
    grantsTradingAction: false,
    authorizesFinancialExecution: false,
  });
  return sealed?.evidenceId ?? null;
}
