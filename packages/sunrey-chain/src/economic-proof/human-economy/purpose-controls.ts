import type { HumanEconomyPurposeCode } from './taxonomy.ts';
import { HUMAN_ECONOMY_PURPOSE_NON_IMPLICATIONS } from './taxonomy.ts';

/**
 * Purpose A does not automatically authorize purpose B.
 * Returns true when the requested purpose would be improperly implied
 * from the authorized purpose alone.
 */
export function isPurposeImpliedNotPermitted(
  authorizedPurpose: HumanEconomyPurposeCode,
  requestedPurpose: HumanEconomyPurposeCode,
): boolean {
  if (authorizedPurpose === requestedPurpose) {
    return false;
  }

  return HUMAN_ECONOMY_PURPOSE_NON_IMPLICATIONS.some(
    ([from, to]) => from === authorizedPurpose && to === requestedPurpose,
  );
}

export function purposesAreDistinct(
  left: HumanEconomyPurposeCode,
  right: HumanEconomyPurposeCode,
): boolean {
  return left !== right;
}

export function researchCannotBecomeMonetary(
  authorizedPurpose: HumanEconomyPurposeCode,
  requestedPurpose: HumanEconomyPurposeCode,
): boolean {
  return authorizedPurpose === 'RESEARCH_USE' && requestedPurpose === 'MONETARY_PROPOSAL';
}

export function agentCannotBecomeDatasetMonetization(
  authorizedPurpose: HumanEconomyPurposeCode,
  requestedPurpose: HumanEconomyPurposeCode,
): boolean {
  return (
    authorizedPurpose === 'PERSONAL_AGENT_USE'
    && (requestedPurpose === 'ECONOMIC_VALUATION' || requestedPurpose === 'MONETARY_PROPOSAL')
  );
}
