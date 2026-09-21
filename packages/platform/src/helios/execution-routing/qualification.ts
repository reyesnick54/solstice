export const HELIOS_MULTI_ASSET_M23_EXECUTION_ROUTING_QUALIFIED =
  'HELIOS_MULTI_ASSET_M23_EXECUTION_ROUTING_QUALIFIED' as const;

export const HELIOS_MULTI_ASSET_M23_EXECUTION_ROUTING_BLOCKED =
  'HELIOS_MULTI_ASSET_M23_EXECUTION_ROUTING_BLOCKED' as const;

export type M23QualificationChecks = {
  readonly eligibleEquityProvider: boolean;
  readonly eligibleCryptoProvider: boolean;
  readonly futuresProviderUnavailable: boolean;
  readonly providerDegradedHandled: boolean;
  readonly unsupportedInstrumentRejected: boolean;
  readonly unsupportedJurisdictionRejected: boolean;
  readonly unsupportedOrderTypeRejected: boolean;
  readonly accountNotFundedRejected: boolean;
  readonly accountNotCertifiedRejected: boolean;
  readonly sandboxProviderSelected: boolean;
  readonly noRouteFailsClosed: boolean;
  readonly deterministicSelection: boolean;
  readonly providerFailover: boolean;
  readonly evidenceLineage: boolean;
  readonly restartPersistence: boolean;
  readonly noExecutionAuthorityIssued: boolean;
  readonly productionDisabled: boolean;
  readonly extendsCanonicalProviders: boolean;
};

export function evaluateM23ExecutionRoutingQualification(checks: M23QualificationChecks): {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_M23_EXECUTION_ROUTING_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_M23_EXECUTION_ROUTING_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
} {
  const entries = Object.entries(checks) as [keyof M23QualificationChecks, boolean][];
  const blockers = entries.filter(([, passed]) => !passed).map(([key]) => key);
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_MULTI_ASSET_M23_EXECUTION_ROUTING_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_MULTI_ASSET_M23_EXECUTION_ROUTING_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
