/**
 * Privacy-safe HIN aggregate metrics. Individual sensitive records
 * are never returned through this surface.
 */

import type { HinContributionRecord, HinEconomicValueInput, HinAggregateMetrics } from './types.ts';
import type { HinProductCategory } from './categories.ts';
import { HIN_ECONOMIC_VALUE_INPUT_UNIT } from './types.ts';
import { HIN_PRODUCT_CATEGORIES } from './categories.ts';

export const HIN_K_ANONYMITY_THRESHOLD = 5 as const;

export function aggregateHinMetrics(input: {
  readonly records: readonly HinContributionRecord[];
  readonly valueInputs: readonly HinEconomicValueInput[];
  readonly jurisdictions: Readonly<Record<string, string>>;
}): HinAggregateMetrics {
  const verifiedSubjects = new Set(
    input.records.filter((row) => row.verification === 'SYSTEM_VERIFIED' || row.verification === 'SOURCE_VERIFIED').map((row) => row.subject),
  );
  const byCategory = new Map<HinProductCategory, number>();
  for (const category of HIN_PRODUCT_CATEGORIES) {
    byCategory.set(category, 0);
  }
  let qualitySum = 0n;
  let confidenceSum = 0n;
  let systemVerified = 0;
  for (const record of input.records) {
    byCategory.set(record.category, (byCategory.get(record.category) ?? 0) + 1);
    qualitySum += record.qualityBps;
    confidenceSum += record.confidenceBps;
    if (record.verification === 'SYSTEM_VERIFIED') {
      systemVerified += 1;
    }
  }
  const jurisdictionCounts = new Map<string, number>();
  for (const record of input.records) {
    const jurisdiction = input.jurisdictions[record.contributionId] ?? 'UNRESOLVED';
    jurisdictionCounts.set(jurisdiction, (jurisdictionCounts.get(jurisdiction) ?? 0) + 1);
  }
  const publishedGeography: { readonly jurisdiction: string; readonly count: number }[] = [];
  let suppressed = 0;
  for (const [jurisdiction, count] of [...jurisdictionCounts.entries()].sort()) {
    if (count >= HIN_K_ANONYMITY_THRESHOLD) {
      publishedGeography.push(Object.freeze({ jurisdiction, count }));
    } else {
      suppressed += 1;
    }
  }
  const totalValue = input.valueInputs.reduce((sum, row) => sum + row.normalizedValue, 0n);
  const count = input.records.length;
  const categoryRows = HIN_PRODUCT_CATEGORIES.map((category) =>
    Object.freeze({ category, count: byCategory.get(category) ?? 0 }),
  );
  return Object.freeze({
    schema: 'sunrey.hin.aggregate-metrics.v1',
    verifiedContributors: verifiedSubjects.size,
    contributionCategories: Object.freeze(categoryRows),
    contributionVolume: count,
    economicValueInputs: Object.freeze({
      count: input.valueInputs.length,
      totalNormalized: totalValue.toString(),
      denomination: HIN_ECONOMIC_VALUE_INPUT_UNIT,
      isMintAmount: false,
    }),
    geographicSummaries: Object.freeze(publishedGeography),
    categoryGrowth: Object.freeze(
      categoryRows.map((row) => Object.freeze({ category: row.category, prior: 0, current: row.count })),
    ),
    qualityMetrics: Object.freeze({
      meanQualityBps: count === 0 ? '0' : (qualitySum / BigInt(count)).toString(),
      meanConfidenceBps: count === 0 ? '0' : (confidenceSum / BigInt(count)).toString(),
      systemVerifiedShareBps: count === 0 ? '0' : ((BigInt(systemVerified) * 10_000n) / BigInt(count)).toString(),
    }),
    suppression: Object.freeze({
      kAnonymityThreshold: HIN_K_ANONYMITY_THRESHOLD,
      jurisdictionsSuppressed: suppressed,
      individualRecordsExposed: false,
    }),
    productionActivated: false,
  });
}
