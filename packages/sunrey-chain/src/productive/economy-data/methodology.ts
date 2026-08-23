/**
 * Versioned Productive Value Methodology Registry.
 *
 * GPUV remains the canonical productive-value unit. Methodologies do
 * not hardcode MoonRey issuance ratios. Governance approval is
 * simulation-only.
 */

import { CANONICAL_GPUV, CANONICAL_GPUV_ID, type ProductiveEconomyCategory, type ProductiveValueMethodology } from './types.ts';

export const METHODOLOGY_REGISTRY_ID = 'sunrey.productive.value-methodology.v1' as const;

export function canonicalGpuvProductization() {
  return Object.freeze({
    unitId: CANONICAL_GPUV_ID,
    name: CANONICAL_GPUV.name,
    represents: 'PRODUCTIVE_ECONOMIC_VALUE_INPUT' as const,
    notAutomaticTokenAmount: true,
    notMoonReyQuantity: CANONICAL_GPUV.notMoonReyQuantity,
    notMarketPrice: CANONICAL_GPUV.notMarketPrice,
    notFiatValue: CANONICAL_GPUV.notFiatValue,
    productionAuthorized: false,
  });
}

export function simulationMethodology(
  category: ProductiveEconomyCategory,
  metric: string,
): ProductiveValueMethodology {
  return Object.freeze({
    methodologyId: `pvm.${category.toLowerCase()}.sim`,
    version: '1',
    category,
    eligibleMetrics: Object.freeze([metric]),
    normalization: 'sunrey.productive.economy-data.normalize.v1',
    qualityWeighting: 'VERIFIED_AND_FRESH_ONLY',
    confidence: 'ENGINEERING_SIMULATION',
    caps: 'NO_PRODUCTION_CAP_AUTHORIZED',
    conversionBasis: 'GPUV_INPUT_NOT_MOONREY_RATIO',
    governanceApproval: 'SIMULATION_ONLY',
    effectiveDateUtc: '2026-08-23T00:00:00.000Z',
    hardcodedIssuanceRatio: false,
    productionAuthorized: false,
  });
}

export class ProductiveValueMethodologyRegistry {
  readonly #byKey = new Map<string, ProductiveValueMethodology>();

  constructor(seed: readonly ProductiveValueMethodology[] = []) {
    for (const row of seed) {
      this.register(row);
    }
  }

  register(methodology: ProductiveValueMethodology): ProductiveValueMethodology {
    if (methodology.hardcodedIssuanceRatio) {
      throw new Error('methodology must not hardcode a MoonRey issuance ratio');
    }
    this.#byKey.set(`${methodology.methodologyId}:${methodology.version}`, methodology);
    return methodology;
  }

  get(methodologyId: string, version: string): ProductiveValueMethodology | undefined {
    return this.#byKey.get(`${methodologyId}:${version}`);
  }

  list(category?: ProductiveEconomyCategory): readonly ProductiveValueMethodology[] {
    const rows = [...this.#byKey.values()];
    return category ? rows.filter((row) => row.category === category) : rows;
  }

  productionAuthorizedCount(): 0 {
    return 0;
  }
}
