export const HELIOS_EXEC01_CONNECTIVITY_DOMAIN_QUALIFIED =
  'HELIOS_EXEC01_CONNECTIVITY_DOMAIN_QUALIFIED' as const;

export const HELIOS_EXEC01_CONNECTIVITY_DOMAIN_BLOCKED = 'HELIOS_EXEC01_CONNECTIVITY_DOMAIN_BLOCKED' as const;

export type Exec01QualificationChecks = {
  readonly canonicalTypesDeclared: boolean;
  readonly connectivityStatesDeclared: boolean;
  readonly paperBrokerIntact: boolean;
  readonly noStateImpliesLegalAuthorization: boolean;
  readonly liveInvestmentExecutionFalse: boolean;
  readonly noParallelBrokerPackages: boolean;
  readonly extendsCanonicalOwners: boolean;
  readonly ownerAuditComplete: boolean;
  readonly h23BridgePresent: boolean;
  readonly grantsExecutionAuthorityFalse: boolean;
};

export type Exec01QualificationResult = {
  readonly marker:
    | typeof HELIOS_EXEC01_CONNECTIVITY_DOMAIN_QUALIFIED
    | typeof HELIOS_EXEC01_CONNECTIVITY_DOMAIN_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateExec01Qualification(checks: Exec01QualificationChecks): Exec01QualificationResult {
  const blockers: string[] = [];
  if (!checks.canonicalTypesDeclared) blockers.push('canonical_types');
  if (!checks.connectivityStatesDeclared) blockers.push('connectivity_states');
  if (!checks.paperBrokerIntact) blockers.push('paper_broker');
  if (!checks.noStateImpliesLegalAuthorization) blockers.push('legal_authorization_disclaimer');
  if (!checks.liveInvestmentExecutionFalse) blockers.push('live_investment_execution');
  if (!checks.noParallelBrokerPackages) blockers.push('parallel_packages');
  if (!checks.extendsCanonicalOwners) blockers.push('canonical_owners');
  if (!checks.ownerAuditComplete) blockers.push('owner_audit');
  if (!checks.h23BridgePresent) blockers.push('h23_bridge');
  if (!checks.grantsExecutionAuthorityFalse) blockers.push('execution_authority');

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_EXEC01_CONNECTIVITY_DOMAIN_QUALIFIED : HELIOS_EXEC01_CONNECTIVITY_DOMAIN_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
