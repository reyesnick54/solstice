/**
 * MD13 circuit state — fail closed when authoritative market state cannot be established.
 */

import type { MarketDataCircuitState } from './taxonomy.ts';

export type MarketDataTrustInputs = {
  readonly feedAAvailable: boolean;
  readonly feedBAvailable: boolean;
  readonly authoritativeSnapshotValid: boolean;
  readonly sequenceContiguous: boolean;
  readonly heartbeatFresh: boolean;
  readonly checksumValid: boolean;
  readonly clockSane: boolean;
};

export type MarketDataTrustEvaluation = {
  readonly circuit: MarketDataCircuitState;
  readonly reasons: readonly string[];
  readonly researchPaperExecutionAllowed: boolean;
};

export function evaluateMarketDataCircuit(input: MarketDataTrustInputs): MarketDataTrustEvaluation {
  const reasons: string[] = [];

  if (!input.clockSane) reasons.push('clock_not_sane');
  if (!input.checksumValid) reasons.push('checksum_invalid');
  if (!input.heartbeatFresh) reasons.push('heartbeat_stale');
  if (!input.sequenceContiguous) reasons.push('sequence_gap');
  if (!input.authoritativeSnapshotValid) reasons.push('snapshot_invalid');

  if (!input.feedAAvailable && !input.feedBAvailable) {
    reasons.push('both_feeds_down');
  } else if (!input.feedAAvailable || !input.feedBAvailable) {
    reasons.push('single_feed_only');
  }

  let circuit: MarketDataCircuitState = 'TRUSTED';
  if (
    !input.authoritativeSnapshotValid ||
    !input.sequenceContiguous ||
    !input.checksumValid ||
    (!input.feedAAvailable && !input.feedBAvailable) ||
    !input.clockSane
  ) {
    circuit = 'MARKET_DATA_UNTRUSTED';
  } else if (!input.feedAAvailable || !input.feedBAvailable || !input.heartbeatFresh) {
    circuit = 'DEGRADED';
  }

  const researchPaperExecutionAllowed = circuit === 'TRUSTED';

  return Object.freeze({
    circuit,
    reasons: Object.freeze(reasons),
    researchPaperExecutionAllowed,
  });
}

export type ResearchExecutionGateResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: 'MARKET_DATA_UNTRUSTED'; readonly reasons: readonly string[] };

export function gateResearchAndPaperExecution(
  evaluation: MarketDataTrustEvaluation,
): ResearchExecutionGateResult {
  if (evaluation.circuit === 'MARKET_DATA_UNTRUSTED' || !evaluation.researchPaperExecutionAllowed) {
    return Object.freeze({
      ok: false,
      code: 'MARKET_DATA_UNTRUSTED',
      reasons: evaluation.reasons,
    });
  }
  return Object.freeze({ ok: true });
}
