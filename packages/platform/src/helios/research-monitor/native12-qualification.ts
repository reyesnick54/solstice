import {
  HELIOS_NATIVE_SERIS_STRATEGY_AUTOPILOT_BLOCKED,
  HELIOS_NATIVE_SERIS_STRATEGY_AUTOPILOT_QUALIFIED,
} from '@solstice/strategy-lab';

export type ResearchMonitorNative12QualificationChecks = {
  readonly proactiveInvestigationBridge: boolean;
  readonly researchAutopilotLoop: boolean;
  readonly monitorTriggersResearchOnly: boolean;
  readonly autopilotNeverRequestsFundMovement: boolean;
  readonly simulationMarketObservationOnly: boolean;
};

export type ResearchMonitorNative12QualificationResult = {
  readonly marker:
    | typeof HELIOS_NATIVE_SERIS_STRATEGY_AUTOPILOT_QUALIFIED
    | typeof HELIOS_NATIVE_SERIS_STRATEGY_AUTOPILOT_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateResearchMonitorNative12Qualification(
  checks: ResearchMonitorNative12QualificationChecks,
): ResearchMonitorNative12QualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [
    keyof ResearchMonitorNative12QualificationChecks,
    boolean,
  ][]) {
    if (!passed) {
      blockers.push(String(key));
    }
  }
  return Object.freeze({
    marker:
      blockers.length === 0
        ? HELIOS_NATIVE_SERIS_STRATEGY_AUTOPILOT_QUALIFIED
        : HELIOS_NATIVE_SERIS_STRATEGY_AUTOPILOT_BLOCKED,
    qualified: blockers.length === 0,
    blockers: Object.freeze(blockers),
  });
}
