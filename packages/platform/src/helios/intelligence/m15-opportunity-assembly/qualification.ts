export const HELIOS_MULTI_ASSET_M15_OPPORTUNITY_ASSEMBLY_QUALIFIED =
  'HELIOS_MULTI_ASSET_M15_OPPORTUNITY_ASSEMBLY_QUALIFIED' as const;
export const HELIOS_MULTI_ASSET_M15_OPPORTUNITY_ASSEMBLY_BLOCKED =
  'HELIOS_MULTI_ASSET_M15_OPPORTUNITY_ASSEMBLY_BLOCKED' as const;

export type M15QualificationChecks = {
  readonly multiSourceAssembly: boolean;
  readonly workOrderBound: boolean;
  readonly envelopeValidated: boolean;
  readonly expiredRejected: boolean;
  readonly noExecutionAuthority: boolean;
};

export type M15QualificationResult = {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_M15_OPPORTUNITY_ASSEMBLY_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_M15_OPPORTUNITY_ASSEMBLY_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateM15Qualification(checks: M15QualificationChecks): M15QualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [keyof M15QualificationChecks, boolean][]) {
    if (!passed) blockers.push(String(key));
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_MULTI_ASSET_M15_OPPORTUNITY_ASSEMBLY_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_MULTI_ASSET_M15_OPPORTUNITY_ASSEMBLY_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
