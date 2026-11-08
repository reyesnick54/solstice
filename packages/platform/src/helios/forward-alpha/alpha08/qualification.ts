/**
 * HELIOS FORWARD ALPHA08 — qualification gate.
 */

import { buildForwardDataSnoopingFirewallEvidence } from './evidence.ts';
import {
  HELIOS_ALPHA08_DATA_SNOOPING_FIREWALL_BLOCKED,
  HELIOS_ALPHA08_DATA_SNOOPING_FIREWALL_QUALIFIED,
} from './taxonomy.ts';
import type { ForwardDataSnoopingFirewallEvidence, ForwardTrialCandidate } from './types.ts';

export type Alpha08QualificationResult = {
  readonly qualified: boolean;
  readonly marker:
    | typeof HELIOS_ALPHA08_DATA_SNOOPING_FIREWALL_QUALIFIED
    | typeof HELIOS_ALPHA08_DATA_SNOOPING_FIREWALL_BLOCKED;
  readonly evidence: ForwardDataSnoopingFirewallEvidence;
};

/**
 * Evaluates the forward monitoring universe against a predeclared benchmark embedded in excess returns.
 * Every registered candidate is included; losers are not dropped from evidence.
 */
export function evaluateAlpha08DataSnoopingFirewallQualification(input: {
  readonly candidates: readonly ForwardTrialCandidate[];
  readonly bootstrapReplications?: number;
  readonly bootstrapSeed?: number;
  readonly requireRealityCheckPass?: boolean;
}): Alpha08QualificationResult {
  const evidence = buildForwardDataSnoopingFirewallEvidence(input);
  const qualified =
    evidence.qualificationMarker === HELIOS_ALPHA08_DATA_SNOOPING_FIREWALL_QUALIFIED;
  return Object.freeze({
    qualified,
    marker: evidence.qualificationMarker,
    evidence,
  });
}
