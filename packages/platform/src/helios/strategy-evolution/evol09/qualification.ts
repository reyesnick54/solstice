/**
 * HELIOS EVOL09 — qualification gate for the multiple-testing firewall.
 */

import { buildStrategyDiscoveryEvidence } from './evidence.ts';
import {
  HELIOS_EVOL09_MULTIPLE_TESTING_FIREWALL_BLOCKED,
  HELIOS_EVOL09_MULTIPLE_TESTING_FIREWALL_QUALIFIED,
} from './taxonomy.ts';
import type { EvolutionTrialRecord, FamilyWiseResearchBudget, StrategyDiscoveryEvidence } from './types.ts';

export type Evol09QualificationResult = {
  readonly qualified: boolean;
  readonly marker:
    | typeof HELIOS_EVOL09_MULTIPLE_TESTING_FIREWALL_QUALIFIED
    | typeof HELIOS_EVOL09_MULTIPLE_TESTING_FIREWALL_BLOCKED;
  readonly evidence: StrategyDiscoveryEvidence;
};

/**
 * @param trials — every genome evaluation that ran (including failed or aborted).
 */
export function evaluateEvol09MultipleTestingFirewallQualification(input: {
  readonly trials: readonly EvolutionTrialRecord[];
  readonly budget: FamilyWiseResearchBudget;
}): Evol09QualificationResult {
  const evidence = buildStrategyDiscoveryEvidence({
    trials: input.trials,
    budget: input.budget,
  });
  const qualified = evidence.qualificationMarker === HELIOS_EVOL09_MULTIPLE_TESTING_FIREWALL_QUALIFIED;
  return Object.freeze({
    qualified,
    marker: evidence.qualificationMarker,
    evidence,
  });
}
