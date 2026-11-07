/**
 * HELIOS EXEC06 qualification gate.
 */

export const HELIOS_EXEC06_EXECUTION_ALGOS_QUALIFIED = 'HELIOS_EXEC06_EXECUTION_ALGOS_QUALIFIED' as const;

export const HELIOS_EXEC06_EXECUTION_ALGOS_BLOCKED = 'HELIOS_EXEC06_EXECUTION_ALGOS_BLOCKED' as const;

export type Exec06QualificationChecks = {
  readonly parentChildTypes: boolean;
  readonly marketAlgorithm: boolean;
  readonly limitAlgorithm: boolean;
  readonly passiveLimitAlgorithm: boolean;
  readonly aggressiveLimitAlgorithm: boolean;
  readonly twapSlicing: boolean;
  readonly vwapSlicing: boolean;
  readonly povParticipationCap: boolean;
  readonly arrivalPriceSchedule: boolean;
  readonly implementationShortfallSchedule: boolean;
  readonly boundsParentQuantity: boolean;
  readonly boundsSideInstrumentCustomer: boolean;
  readonly boundsNotional: boolean;
  readonly boundsValidityEnvelope: boolean;
  readonly boundsLimitPrices: boolean;
  readonly participationCeiling: boolean;
  readonly riskNotOverridden: boolean;
  readonly cancelReplaceWithinBounds: boolean;
  readonly untrustedPausesChildGeneration: boolean;
  readonly untrustedCancelChildrenPolicy: boolean;
  readonly untrustedCancelOnlyPolicy: boolean;
  readonly noExecutionAuthority: boolean;
  readonly simulationPosture: boolean;
};

export type Exec06QualificationResult = {
  readonly marker:
    | typeof HELIOS_EXEC06_EXECUTION_ALGOS_QUALIFIED
    | typeof HELIOS_EXEC06_EXECUTION_ALGOS_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateExec06ExecutionAlgosQualification(
  checks: Exec06QualificationChecks,
): Exec06QualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [keyof Exec06QualificationChecks, boolean][]) {
    if (!passed) {
      blockers.push(String(key));
    }
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_EXEC06_EXECUTION_ALGOS_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_EXEC06_EXECUTION_ALGOS_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
