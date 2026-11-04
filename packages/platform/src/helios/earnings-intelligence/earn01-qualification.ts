import {
  HELIOS_EARN01_DOMAIN_BLOCKED,
  HELIOS_EARN01_DOMAIN_QUALIFIED,
} from './taxonomy.ts';

export type Earn01QualificationChecks = {
  readonly coreTypesDefined: boolean;
  readonly announcementStatesComplete: boolean;
  readonly sessionClassificationComplete: boolean;
  readonly knowableAtEnforced: boolean;
  readonly noExecutionAuthorityOnArtifacts: boolean;
  readonly extendsSecFundamentalsNotDuplicate: boolean;
  readonly extendsFeatureFabricNotDuplicate: boolean;
};

export type Earn01QualificationResult = {
  readonly marker: typeof HELIOS_EARN01_DOMAIN_QUALIFIED | typeof HELIOS_EARN01_DOMAIN_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateEarn01DomainQualification(
  checks: Earn01QualificationChecks,
): Earn01QualificationResult {
  const blockers: string[] = [];
  if (!checks.coreTypesDefined) blockers.push('core_types');
  if (!checks.announcementStatesComplete) blockers.push('announcement_states');
  if (!checks.sessionClassificationComplete) blockers.push('session_classification');
  if (!checks.knowableAtEnforced) blockers.push('knowable_at');
  if (!checks.noExecutionAuthorityOnArtifacts) blockers.push('execution_authority');
  if (!checks.extendsSecFundamentalsNotDuplicate) blockers.push('sec_fundamentals_extension');
  if (!checks.extendsFeatureFabricNotDuplicate) blockers.push('feature_fabric_extension');

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_EARN01_DOMAIN_QUALIFIED : HELIOS_EARN01_DOMAIN_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
