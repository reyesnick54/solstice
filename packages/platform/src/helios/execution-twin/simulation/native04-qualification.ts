/**
 * HELIOS NATIVE04 — BYTEX-assimilated matching engine qualification.
 */

export const HELIOS_NATIVE_MATCHING_ENGINE_QUALIFIED = 'HELIOS_NATIVE_MATCHING_ENGINE_QUALIFIED' as const;
export const HELIOS_NATIVE_MATCHING_ENGINE_BLOCKED = 'HELIOS_NATIVE_MATCHING_ENGINE_BLOCKED' as const;

export type Native04QualificationChecks = {
  readonly orderBookPartialFill: boolean;
  readonly quoteMatching: boolean;
  readonly tradeMatching: boolean;
  readonly barFidelityExplicit: boolean;
  readonly barNotEquivalentToOrderBook: boolean;
  readonly postOnlyReject: boolean;
  readonly reduceOnlyReject: boolean;
  readonly replaceLatencyModeled: boolean;
  readonly bookDepthLimit: boolean;
  readonly queueApproximation: boolean;
  readonly makerTakerFees: boolean;
  readonly slippageImpact: boolean;
  readonly fundingMarginLiquidation: boolean;
  readonly fillEvidenceNative04: boolean;
  readonly deterministicParity: boolean;
  readonly adversarialStaleBook: boolean;
  readonly simulationPosture: boolean;
};

export type Native04QualificationResult = {
  readonly marker: typeof HELIOS_NATIVE_MATCHING_ENGINE_QUALIFIED | typeof HELIOS_NATIVE_MATCHING_ENGINE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

const LABELS: Record<keyof Native04QualificationChecks, string> = {
  orderBookPartialFill: 'ORDER_BOOK partial fill on thin liquidity',
  quoteMatching: 'QUOTE fidelity matching',
  tradeMatching: 'TRADE fidelity matching',
  barFidelityExplicit: 'BAR fidelity declared on bar fills',
  barNotEquivalentToOrderBook: 'BAR not claimed equivalent to ORDER_BOOK',
  postOnlyReject: 'POST_ONLY rejects would-take',
  reduceOnlyReject: 'REDUCE_ONLY rejects position increase',
  replaceLatencyModeled: 'replace latency defers amend',
  bookDepthLimit: 'book depth limit bounds walk',
  queueApproximation: 'queue-ahead fraction limits maker fill',
  makerTakerFees: 'maker/taker fee split',
  slippageImpact: 'taker impact slippage',
  fundingMarginLiquidation: 'funding, margin, liquidation',
  fillEvidenceNative04: 'fill evidence bundle (NATIVE04 fields)',
  deterministicParity: 'deterministic parity replay',
  adversarialStaleBook: 'stale book produces no fill',
  simulationPosture: 'simulation posture preserved',
};

export function evaluateNative04MatchingEngineQualification(
  checks: Native04QualificationChecks,
): Native04QualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [keyof Native04QualificationChecks, boolean][]) {
    if (!passed) {
      blockers.push(LABELS[key]);
    }
  }
  if (blockers.length === 0) {
    return Object.freeze({
      marker: HELIOS_NATIVE_MATCHING_ENGINE_QUALIFIED,
      qualified: true,
      blockers: Object.freeze([]),
    });
  }
  return Object.freeze({
    marker: HELIOS_NATIVE_MATCHING_ENGINE_BLOCKED,
    qualified: false,
    blockers: Object.freeze(blockers),
  });
}
