/**
 * Read-only Consumer BFF adapter for the Productive Economy Data Platform.
 * Orchestration only. Does not mint or change methodology.
 */

import {
  categoryBreakdown,
  createProductiveEconomyDataPlatform,
  lovableProductiveEconomyContract,
  metricHistory,
  moonreyEconomicInputSummary,
  sourceFreshnessSummary,
  type ProductiveEconomyDataPlatform,
} from '../../../../packages/sunrey-chain/src/productive/economy-data/index.ts';

export type ProductiveEconomySurface = {
  readonly overview: () => ReturnType<typeof lovableProductiveEconomyContract>;
  readonly categories: () => ReturnType<typeof categoryBreakdown>;
  readonly history: (category?: string) => ReturnType<typeof metricHistory>;
  readonly sources: () => ReturnType<typeof sourceFreshnessSummary>;
  readonly moonreyInput: () => ReturnType<typeof moonreyEconomicInputSummary>;
};

export function createProductiveEconomySurface(
  platform: ProductiveEconomyDataPlatform = createProductiveEconomyDataPlatform(),
): ProductiveEconomySurface {
  return Object.freeze({
    overview() {
      return lovableProductiveEconomyContract(platform);
    },
    categories() {
      return categoryBreakdown(platform);
    },
    history(category?: string) {
      return metricHistory(platform, category);
    },
    sources() {
      return sourceFreshnessSummary(platform);
    },
    moonreyInput() {
      return moonreyEconomicInputSummary(platform);
    },
  });
}
