/**
 * Segment contribution and concentration metrics.
 */

import type { SegmentContributionMap, SegmentValuation, SegmentValueConcentration } from './types.ts';

const BPS = 10_000;

export function buildSegmentContributionMap(valuations: readonly SegmentValuation[]): SegmentContributionMap {
  let total = 0n;
  for (const row of valuations) {
    total += row.enterpriseValueMinor;
  }

  const contributions: Record<
    string,
    {
      readonly stableSegmentKey: string;
      readonly enterpriseValueMinor: bigint;
      readonly shareOfTotalBps: number;
      readonly method: SegmentValuation['method'];
    }
  > = {};

  for (const row of valuations) {
    const share =
      total > 0n ? Math.round((Number(row.enterpriseValueMinor) / Number(total)) * BPS) : 0;
    contributions[row.stableSegmentKey] = Object.freeze({
      stableSegmentKey: row.stableSegmentKey,
      enterpriseValueMinor: row.enterpriseValueMinor,
      shareOfTotalBps: share,
      method: row.method,
    });
  }

  return Object.freeze({
    contributions: Object.freeze(contributions),
    totalEnterpriseValueMinor: total,
  });
}

export function computeSegmentValueConcentration(map: SegmentContributionMap): SegmentValueConcentration {
  const shares = Object.values(map.contributions).map((row) => row.shareOfTotalBps);
  if (shares.length === 0) {
    return Object.freeze({
      hhiBps: 0,
      largestSegmentKey: null,
      largestShareBps: 0,
      topTwoShareBps: 0,
    });
  }

  const sorted = [...Object.values(map.contributions)].sort(
    (a, b) => b.shareOfTotalBps - a.shareOfTotalBps,
  );
  const hhi = shares.reduce((acc, s) => acc + s * s, 0);

  return Object.freeze({
    hhiBps: hhi,
    largestSegmentKey: sorted[0]!.stableSegmentKey,
    largestShareBps: sorted[0]!.shareOfTotalBps,
    topTwoShareBps: (sorted[0]?.shareOfTotalBps ?? 0) + (sorted[1]?.shareOfTotalBps ?? 0),
  });
}
