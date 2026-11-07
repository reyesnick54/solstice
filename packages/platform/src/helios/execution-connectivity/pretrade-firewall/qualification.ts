export const HELIOS_EXEC04_PRETRADE_FIREWALL_QUALIFIED = 'HELIOS_EXEC04_PRETRADE_FIREWALL_QUALIFIED' as const;
export const HELIOS_EXEC04_PRETRADE_FIREWALL_BLOCKED = 'HELIOS_EXEC04_PRETRADE_FIREWALL_BLOCKED' as const;

export type Exec04QualificationChecks = {
  readonly ownershipMandateEnvelopeKernel: boolean;
  readonly marketAccessAndSession: boolean;
  readonly marketDataAuthoritativeFresh: boolean;
  readonly capitalReservationEnforced: boolean;
  readonly effectiveBrokerSunreyLimits: boolean;
  readonly brokerRejectionAuthoritative: boolean;
  readonly defaultStructuredProductBlocks: boolean;
  readonly riskEngineConsultedNotDuplicated: boolean;
  readonly duplicateOrderDetection: boolean;
  readonly priceCollarAndFatFinger: boolean;
  readonly reviewRequiredPath: boolean;
  readonly deterministicEvaluation: boolean;
  readonly noExecutionAuthorityIssued: boolean;
  readonly simulationPosture: boolean;
  readonly extendsCanonicalAuthorities: boolean;
};

export function evaluateExec04PreTradeFirewallQualification(checks: Exec04QualificationChecks): {
  readonly marker: typeof HELIOS_EXEC04_PRETRADE_FIREWALL_QUALIFIED | typeof HELIOS_EXEC04_PRETRADE_FIREWALL_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
} {
  const blockers = (Object.entries(checks) as [keyof Exec04QualificationChecks, boolean][])
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_EXEC04_PRETRADE_FIREWALL_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_EXEC04_PRETRADE_FIREWALL_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
