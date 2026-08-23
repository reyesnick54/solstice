/**
 * Deterministic outlier detection. AI may triage. AI cannot convert an
 * anomalous observation into verified economic truth.
 */

export const AI_CANNOT_VERIFY_OUTLIER = true as const;

export type OutlierDecision = {
  readonly outlier: boolean;
  readonly method: 'MEDIAN_ABS_DEVIATION' | 'INSUFFICIENT_PEERS';
  readonly median: bigint | null;
  readonly deviation: bigint | null;
  readonly threshold: bigint;
  readonly aiPromotedToVerified: false;
};

export function detectOutlier(input: {
  readonly value: bigint;
  readonly peers: readonly bigint[];
  readonly maxDeviationBps?: bigint;
}): OutlierDecision {
  if (input.peers.length < 2) {
    return Object.freeze({
      outlier: false,
      method: 'INSUFFICIENT_PEERS',
      median: null,
      deviation: null,
      threshold: 0n,
      aiPromotedToVerified: false,
    });
  }
  const sorted = [...input.peers, input.value].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0n;
  const deviation = input.value > median ? input.value - median : median - input.value;
  const maxBps = input.maxDeviationBps ?? 2_500n;
  const threshold = (median * maxBps) / 10_000n;
  return Object.freeze({
    outlier: median > 0n && deviation > threshold,
    method: 'MEDIAN_ABS_DEVIATION',
    median,
    deviation,
    threshold,
    aiPromotedToVerified: false,
  });
}

export function refuseAiOutlierPromotion(): { readonly ok: false; readonly code: 'AI_CANNOT_VERIFY_OUTLIER' } {
  return { ok: false, code: 'AI_CANNOT_VERIFY_OUTLIER' };
}
