import {
  HELIOS_NATIVE_PROACTIVE_RESEARCH_ENGINE_BLOCKED,
  HELIOS_NATIVE_PROACTIVE_RESEARCH_ENGINE_QUALIFIED,
} from './taxonomy.ts';

export type Native08ProactiveResearchQualificationChecks = {
  readonly marketEventToFeatureFabric: boolean;
  readonly featureFabricToMonitor: boolean;
  readonly monitorToTriggerOnlyResearch: boolean;
  readonly triggerToWorkOrderNotTrade: boolean;
  readonly workOrderToAgentResearch: boolean;
  readonly cooldownEnforced: boolean;
  readonly deduplicationEnforced: boolean;
  readonly triggerPersistence: boolean;
  readonly monitorStatePersisted: boolean;
  readonly restartRecovery: boolean;
  readonly monitorHistoryRecorded: boolean;
  readonly evidenceVaultRecords: boolean;
  readonly scheduleTickSupported: boolean;
  readonly eventSubscriptionSupported: boolean;
  readonly noCapitalMovementFromTrigger: boolean;
};

export type Native08ProactiveResearchQualificationResult = {
  readonly marker:
    | typeof HELIOS_NATIVE_PROACTIVE_RESEARCH_ENGINE_QUALIFIED
    | typeof HELIOS_NATIVE_PROACTIVE_RESEARCH_ENGINE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateNative08ProactiveResearchQualification(
  checks: Native08ProactiveResearchQualificationChecks,
): Native08ProactiveResearchQualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [
    keyof Native08ProactiveResearchQualificationChecks,
    boolean,
  ][]) {
    if (!passed) {
      blockers.push(String(key));
    }
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_NATIVE_PROACTIVE_RESEARCH_ENGINE_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_NATIVE_PROACTIVE_RESEARCH_ENGINE_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
