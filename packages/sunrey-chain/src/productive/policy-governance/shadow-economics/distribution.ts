/**
 * Simulation distributional analysis. Not a market forecast.
 */

import type { MoonReyShadowScenario } from './types.ts';
import type {
  ConcentrationShare,
  DistributionBucket,
  MoonReyShadowDistributionReport,
  MoonReyValuePathComparison,
} from './types.ts';

export function buildDistributionReport(
  comparisons: readonly MoonReyValuePathComparison[],
  scenarios: readonly MoonReyShadowScenario[],
): MoonReyShadowDistributionReport {
  const byId = new Map(scenarios.map((scenario) => [scenario.scenarioId, scenario]));
  const byCategory = buckets();
  const byObject = buckets();
  const byController = buckets();
  const byGeography = buckets();
  const bySource = buckets();
  const byClaim = buckets();
  const byRealization = buckets();

  for (const comparison of comparisons) {
    const scenario = byId.get(comparison.scenarioId);
    if (!scenario) {
      continue;
    }
    add(byCategory, comparison.category, comparison);
    add(byObject, scenario.objectId, comparison);
    add(byController, scenario.controllerId, comparison);
    add(byGeography, scenario.geographyId, comparison);
    add(bySource, scenario.sourceProviderClass, comparison);
    add(byClaim, comparison.claimType, comparison);
    add(byRealization, scenario.realizationState, comparison);
  }

  const v2ByController = totals(byController);
  const v2ByObject = totals(byObject);
  const v2ByCategory = totals(byCategory);

  return Object.freeze({
    classification: 'ENGINEERING_ECONOMIC_SIMULATION',
    marketForecast: false,
    byCategory: freezeBuckets(byCategory),
    byObject: freezeBuckets(byObject),
    byController: freezeBuckets(byController),
    byGeography: freezeBuckets(byGeography),
    bySourceProviderClass: freezeBuckets(bySource),
    byClaimType: freezeBuckets(byClaim),
    byRealizationState: freezeBuckets(byRealization),
    topControllerConcentration: topShares(v2ByController, 3),
    topObjectConcentration: topShares(v2ByObject, 3),
    topCategoryConcentration: topShares(v2ByCategory, 3),
  });
}

function buckets(): Map<string, { v1: bigint; v2: bigint; count: number; unvaluedV1: number; unvaluedV2: number }> {
  return new Map();
}

function add(
  map: Map<string, { v1: bigint; v2: bigint; count: number; unvaluedV1: number; unvaluedV2: number }>,
  key: string,
  comparison: MoonReyValuePathComparison,
): void {
  const current = map.get(key) ?? { v1: 0n, v2: 0n, count: 0, unvaluedV1: 0, unvaluedV2: 0 };
  current.count += 1;
  if (comparison.v1Valued && comparison.v1Quantity !== null) {
    current.v1 += comparison.v1Quantity;
  } else {
    current.unvaluedV1 += 1;
  }
  if (comparison.v2Valued && comparison.v2MoonReyCandidateQuantity !== null) {
    current.v2 += comparison.v2MoonReyCandidateQuantity;
  } else {
    current.unvaluedV2 += 1;
  }
  map.set(key, current);
}

function freezeBuckets(
  map: Map<string, { v1: bigint; v2: bigint; count: number; unvaluedV1: number; unvaluedV2: number }>,
): readonly DistributionBucket[] {
  return Object.freeze(
    [...map.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) =>
        Object.freeze({
          key,
          v1Quantity: value.v1,
          v2CandidateQuantity: value.v2,
          count: value.count,
          unvaluedV1: value.unvaluedV1,
          unvaluedV2: value.unvaluedV2,
        }),
      ),
  );
}

function totals(map: Map<string, { v2: bigint }>): Readonly<Record<string, bigint>> {
  return Object.fromEntries([...map.entries()].map(([key, value]) => [key, value.v2]));
}

function topShares(byKey: Readonly<Record<string, bigint>>, limit: number): readonly ConcentrationShare[] {
  const total = Object.values(byKey).reduce((sum, value) => sum + value, 0n);
  return Object.freeze(
    Object.entries(byKey)
      .sort((left, right) => (right[1] > left[1] ? 1 : right[1] < left[1] ? -1 : left[0].localeCompare(right[0])))
      .slice(0, limit)
      .map(([key, quantity]) =>
        Object.freeze({
          key,
          quantity,
          shareBps: total === 0n ? 0n : (quantity * 10_000n) / total,
        }),
      ),
  );
}
