/**
 * Intersegment revenue, transfer pricing, and elimination handling.
 */

import type { IntersegmentFlow } from './types.ts';

export type IntersegmentReconciliation = {
  readonly grossIntersegmentMinor: bigint;
  readonly eliminationTotalMinor: bigint;
  readonly netDoubleCountMinor: bigint;
  readonly flows: readonly IntersegmentFlow[];
};

export function reconcileIntersegmentFlows(
  flows: readonly IntersegmentFlow[],
): IntersegmentReconciliation {
  let gross = 0n;
  let eliminations = 0n;

  for (const flow of flows) {
    gross += flow.amountMinor;
    if (flow.eliminationApplied || flow.kind === 'ELIMINATION') {
      eliminations += flow.amountMinor;
    }
  }

  const netDoubleCount = gross > eliminations ? gross - eliminations : 0n;

  return Object.freeze({
    grossIntersegmentMinor: gross,
    eliminationTotalMinor: eliminations,
    netDoubleCountMinor: netDoubleCount,
    flows: Object.freeze([...flows]),
  });
}

export function perSegmentIntersegmentAdjustment(
  flows: readonly IntersegmentFlow[],
  stableSegmentKey: string,
): bigint {
  let adjustment = 0n;
  for (const flow of flows) {
    if (!flow.eliminationApplied && flow.kind !== 'ELIMINATION') {
      continue;
    }
    if (flow.fromStableSegmentKey === stableSegmentKey || flow.toStableSegmentKey === stableSegmentKey) {
      adjustment += flow.amountMinor;
    }
  }
  return adjustment;
}
