import {
  HELIOS_OS07_RESEARCH_MONITOR_DSL_BLOCKED,
  HELIOS_OS07_RESEARCH_MONITOR_DSL_QUALIFIED,
} from './taxonomy.ts';

export type Os07ResearchMonitorQualificationChecks = {
  readonly staleFeatureBlocked: boolean;
  readonly futureFeatureBlocked: boolean;
  readonly missingFeatureBlocked: boolean;
  readonly cooldownEnforced: boolean;
  readonly duplicateTriggerBlocked: boolean;
  readonly restartPersistenceWorks: boolean;
  readonly expirationEnforced: boolean;
  readonly researchBudgetExhaustionBlocked: boolean;
  readonly onlyRequestResearchAction: boolean;
  readonly deterministicCompiler: boolean;
  readonly noEvalOrDynamicExecution: boolean;
};

export type Os07ResearchMonitorQualificationResult = {
  readonly marker:
    | typeof HELIOS_OS07_RESEARCH_MONITOR_DSL_QUALIFIED
    | typeof HELIOS_OS07_RESEARCH_MONITOR_DSL_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateOs07ResearchMonitorQualification(
  checks: Os07ResearchMonitorQualificationChecks,
): Os07ResearchMonitorQualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [keyof Os07ResearchMonitorQualificationChecks, boolean][]) {
    if (!passed) {
      blockers.push(String(key));
    }
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_OS07_RESEARCH_MONITOR_DSL_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_OS07_RESEARCH_MONITOR_DSL_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
