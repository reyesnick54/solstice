/**
 * HELIOS FORWARD ALPHA08 — forward data-snooping firewall evidence.
 */

import {
  buildForwardMultipleTestingState,
  computeStrategySelectionPenalty,
  runHansenSpaTest,
  runWhiteRealityCheck,
} from './stats.ts';
import {
  HELIOS_ALPHA08_DATA_SNOOPING_FIREWALL_BLOCKED,
  HELIOS_ALPHA08_DATA_SNOOPING_FIREWALL_QUALIFIED,
  HELIOS_ALPHA08_SCHEMA,
  ALPHA08_MINIMUM_FORWARD_PERIODS,
} from './taxonomy.ts';
import type { ForwardDataSnoopingFirewallEvidence, ForwardTrialCandidate } from './types.ts';

export function buildForwardDataSnoopingFirewallEvidence(input: {
  readonly candidates: readonly ForwardTrialCandidate[];
  readonly bootstrapReplications?: number;
  readonly bootstrapSeed?: number;
  readonly requireRealityCheckPass?: boolean;
}): ForwardDataSnoopingFirewallEvidence {
  const multipleTesting = buildForwardMultipleTestingState(input.candidates);
  const selectionPenalty = computeStrategySelectionPenalty({
    candidates: input.candidates,
    multipleTesting,
  });

  const realityCheck = runWhiteRealityCheck({
    candidates: input.candidates,
    bootstrapReplications: input.bootstrapReplications,
    seed: input.bootstrapSeed,
  });

  const spa = runHansenSpaTest({
    candidates: input.candidates,
    bootstrapReplications: input.bootstrapReplications,
    seed: input.bootstrapSeed,
  });

  const blockers: string[] = [];
  const longest = Math.max(0, ...input.candidates.map((c) => c.forwardExcessReturns.length));
  if (longest < ALPHA08_MINIMUM_FORWARD_PERIODS) {
    blockers.push(
      `forward track shorter than ${String(ALPHA08_MINIMUM_FORWARD_PERIODS)} periods`,
    );
  }
  if (selectionPenalty.deflatedSharpeRatio !== null && selectionPenalty.deflatedSharpeRatio <= 0) {
    blockers.push('deflated Sharpe ratio not positive after combined trial adjustment');
  }
  if (
    selectionPenalty.probabilityOfBacktestOverfitting !== null &&
    selectionPenalty.probabilityOfBacktestOverfitting > 0.5 + 1e-6
  ) {
    blockers.push('probability of backtest overfitting above 0.5');
  }
  if (input.requireRealityCheckPass !== false && realityCheck !== null && !realityCheck.nullRejectedAt05) {
    blockers.push('White reality check does not reject the null at 5%');
  }
  if (input.requireRealityCheckPass !== false && spa !== null && !spa.consistentSuperiorityClaimed) {
    blockers.push('Hansen SPA does not support consistent superior predictive ability at 5%');
  }

  const qualified = blockers.length === 0;

  return Object.freeze({
    schema: HELIOS_ALPHA08_SCHEMA,
    qualificationMarker: qualified
      ? HELIOS_ALPHA08_DATA_SNOOPING_FIREWALL_QUALIFIED
      : HELIOS_ALPHA08_DATA_SNOOPING_FIREWALL_BLOCKED,
    multipleTesting,
    selectionPenalty,
    realityCheck,
    spa,
    trialUniverseCandidateIds: Object.freeze(input.candidates.map((c) => c.candidateId)),
    blockers: Object.freeze([...blockers]),
  });
}
