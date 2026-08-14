/**
 * Safe operational metrics. Labels are enumerations only — never PII.
 */
export type ComplianceMetrics = {
  screenings: number;
  screeningsByType: Readonly<Record<string, number>>;
  screeningsByOutcome: Readonly<Record<string, number>>;
  alerts: number;
  casesOpen: number;
  casesBacklog: number;
  providersUnavailable: number;
  lastLatencyMs: number;
};

export function snapshotMetrics(input: {
  readonly screeningTypes: readonly string[];
  readonly screeningOutcomes: readonly string[];
  readonly alertCount: number;
  readonly openCases: number;
  readonly unavailableProviders: number;
  readonly lastLatencyMs: number;
}): ComplianceMetrics {
  const byType: Record<string, number> = {};
  for (const type of input.screeningTypes) {
    byType[type] = (byType[type] ?? 0) + 1;
  }
  const byOutcome: Record<string, number> = {};
  for (const outcome of input.screeningOutcomes) {
    byOutcome[outcome] = (byOutcome[outcome] ?? 0) + 1;
  }
  return Object.freeze({
    screenings: input.screeningTypes.length,
    screeningsByType: Object.freeze(byType),
    screeningsByOutcome: Object.freeze(byOutcome),
    alerts: input.alertCount,
    casesOpen: input.openCases,
    casesBacklog: input.openCases,
    providersUnavailable: input.unavailableProviders,
    lastLatencyMs: input.lastLatencyMs,
  });
}
