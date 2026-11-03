/**
 * AAF02 qualification gate.
 */

export const HELIOS_AAF02_EVIDENCE_TIME_FEATURE_FABRIC_QUALIFIED =
  'HELIOS_AAF02_EVIDENCE_TIME_FEATURE_FABRIC_QUALIFIED' as const;

export const HELIOS_AAF02_EVIDENCE_TIME_FEATURE_FABRIC_BLOCKED =
  'HELIOS_AAF02_EVIDENCE_TIME_FEATURE_FABRIC_BLOCKED' as const;

export type Aaf02QualificationChecks = {
  readonly q2FilingBlockedBeforePublication: boolean;
  readonly macroRevisionPreservesHistory: boolean;
  readonly futureObservationRejected: boolean;
  readonly delayedMarketKnowabilityPreserved: boolean;
  readonly staleProducesDegradedFeature: boolean;
  readonly restrictedEntitlementPropagates: boolean;
  readonly restartPreservesIdentity: boolean;
  readonly recomputationDeterministic: boolean;
  readonly transformationVersionNewLineage: boolean;
  readonly noCustomerFinancialAuthority: boolean;
};

export type Aaf02QualificationResult = {
  readonly marker:
    | typeof HELIOS_AAF02_EVIDENCE_TIME_FEATURE_FABRIC_QUALIFIED
    | typeof HELIOS_AAF02_EVIDENCE_TIME_FEATURE_FABRIC_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateAaf02Qualification(checks: Aaf02QualificationChecks): Aaf02QualificationResult {
  const blockers: string[] = [];
  if (!checks.q2FilingBlockedBeforePublication) blockers.push('q2_filing_before_publication');
  if (!checks.macroRevisionPreservesHistory) blockers.push('macro_revision_history');
  if (!checks.futureObservationRejected) blockers.push('future_observation');
  if (!checks.delayedMarketKnowabilityPreserved) blockers.push('delayed_market_knowability');
  if (!checks.staleProducesDegradedFeature) blockers.push('stale_degraded');
  if (!checks.restrictedEntitlementPropagates) blockers.push('restricted_entitlement');
  if (!checks.restartPreservesIdentity) blockers.push('restart_identity');
  if (!checks.recomputationDeterministic) blockers.push('recomputation_deterministic');
  if (!checks.transformationVersionNewLineage) blockers.push('transformation_lineage');
  if (!checks.noCustomerFinancialAuthority) blockers.push('no_financial_authority');

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_AAF02_EVIDENCE_TIME_FEATURE_FABRIC_QUALIFIED
      : HELIOS_AAF02_EVIDENCE_TIME_FEATURE_FABRIC_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
