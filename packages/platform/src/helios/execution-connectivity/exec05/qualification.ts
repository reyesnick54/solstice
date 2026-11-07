export const HELIOS_EXEC05_SMART_ROUTING_QUALIFIED = 'HELIOS_EXEC05_SMART_ROUTING_QUALIFIED' as const;
export const HELIOS_EXEC05_SMART_ROUTING_BLOCKED = 'HELIOS_EXEC05_SMART_ROUTING_BLOCKED' as const;

export type Exec05QualificationChecks = {
  readonly transparentScoreComponents: boolean;
  readonly noOpaqueMlScore: boolean;
  readonly minimizesImplementationCost: boolean;
  readonly rebateNotSoleSelector: boolean;
  readonly commercialPreferenceNotSoleSelector: boolean;
  readonly directedRoutingLabeled: boolean;
  readonly periodicReviewEvidence: boolean;
  readonly noExecutionAuthorityIssued: boolean;
};

export function evaluateExec05SmartRoutingQualification(checks: Exec05QualificationChecks): {
  readonly marker: typeof HELIOS_EXEC05_SMART_ROUTING_QUALIFIED | typeof HELIOS_EXEC05_SMART_ROUTING_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
} {
  const blockers = (Object.entries(checks) as [keyof Exec05QualificationChecks, boolean][])
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_EXEC05_SMART_ROUTING_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_EXEC05_SMART_ROUTING_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
