import type { ContributionClass } from '../taxonomy.ts';
import type { ContributorRole } from './types.ts';

const RESEARCH_ROLES: readonly ContributorRole[] = Object.freeze([
  'AUTHOR',
  'CO_AUTHOR',
  'DATA_CONTRIBUTOR',
  'RESEARCH_ASSISTANT',
  'EDITOR',
  'REVIEWER',
]);

const CREATIVE_ROLES: readonly ContributorRole[] = Object.freeze(['AUTHOR', 'CO_AUTHOR', 'EDITOR', 'OTHER_GOVERNED_ROLE']);

export function rolesRequiredForClass(contributionClass: ContributionClass): boolean {
  return contributionClass === 'RESEARCH_PARTICIPATION' || contributionClass === 'CREATIVE_PRODUCTION';
}

export function permittedRolesForClass(contributionClass: ContributionClass): readonly ContributorRole[] {
  switch (contributionClass) {
    case 'RESEARCH_PARTICIPATION':
    case 'VERIFIED_KNOWLEDGE_CONTRIBUTION':
      return RESEARCH_ROLES;
    case 'CREATIVE_PRODUCTION':
    case 'CREATOR_ROYALTY_EVENT':
      return CREATIVE_ROLES;
    case 'HUMAN_SERVICE_DELIVERY':
      return Object.freeze(['SERVICE_PROVIDER', 'OTHER_GOVERNED_ROLE']);
    default:
      return Object.freeze(['OTHER_GOVERNED_ROLE']);
  }
}

export function validateContributorRole(contributionClass: ContributionClass, role: ContributorRole | undefined): boolean {
  if (!rolesRequiredForClass(contributionClass)) {
    return true;
  }
  if (!role) {
    return false;
  }
  return permittedRolesForClass(contributionClass).includes(role);
}

/**
 * Contribution fractions/roles are metadata only — no valuation weights invented.
 */
export function contributorRoleLabel(role: ContributorRole): string {
  return role;
}
