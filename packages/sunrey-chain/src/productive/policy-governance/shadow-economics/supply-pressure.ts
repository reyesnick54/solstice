/**
 * V1 vs V2 candidate issuance-pressure comparison.
 *
 * Extends Chunk 74 supply-pressure simulations with a shadow V2
 * candidate series. Reports ranges, not promises. Does not project
 * future prices and does not mutate canonical supply.
 */

import { GOVERNED_PRODUCTIVE_VALUE_SIMULATION_V2, LEGACY_ENGINEERING_SIMULATION_V1 } from './identities.ts';
import type {
  MoonReyPathSupplyPressure,
  MoonReyShadowSupplyPressureReport,
  MoonReyValuePathComparison,
} from './types.ts';

export function compareShadowSupplyPressure(
  comparisons: readonly MoonReyValuePathComparison[],
): MoonReyShadowSupplyPressureReport {
  return Object.freeze({
    classification: 'ENGINEERING_ECONOMIC_SIMULATION',
    v1: pressure(LEGACY_ENGINEERING_SIMULATION_V1, comparisons.map((row) => [row.category, row.v1Valued ? row.v1Quantity : null])),
    v2: pressure(
      GOVERNED_PRODUCTIVE_VALUE_SIMULATION_V2,
      comparisons.map((row) => [row.category, row.v2Valued ? row.v2MoonReyCandidateQuantity : null]),
    ),
    rangeNote: 'Ranges are simulation observations, not promises.',
    canonicalSupplyMutated: false,
  });
}

function pressure(
  path: typeof LEGACY_ENGINEERING_SIMULATION_V1 | typeof GOVERNED_PRODUCTIVE_VALUE_SIMULATION_V2,
  rows: readonly (readonly [string, bigint | null])[],
): MoonReyPathSupplyPressure {
  const byCategory: Record<string, bigint> = {};
  const valued: bigint[] = [];
  for (const [category, quantity] of rows) {
    if (quantity === null) {
      continue;
    }
    byCategory[category] = (byCategory[category] ?? 0n) + quantity;
    valued.push(quantity);
  }
  const candidateIssuance = valued.reduce((sum, value) => sum + value, 0n);
  return Object.freeze({
    path,
    candidateIssuance,
    minCandidate: valued.length === 0 ? 0n : valued.reduce((min, value) => (value < min ? value : min)),
    maxCandidate: valued.length === 0 ? 0n : valued.reduce((max, value) => (value > max ? value : max)),
    byCategory: Object.freeze(byCategory),
    supplyMutated: false,
    futurePriceProjection: false,
  });
}
