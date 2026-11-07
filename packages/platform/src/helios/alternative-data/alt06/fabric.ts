import type { UtcInstant } from '@solstice/domain';
import {
  assertPermittedProductDemandSource,
  partitionProductDemandObservations,
  type Alt06ProductDemandObservation,
} from '@solstice/external-data';

import { alt06DefaultEmpiricalCalibration } from './calibration.ts';
import { computeAlt06Features } from './features.ts';
import { deriveDemandSupplyImbalanceState, derivePricingPowerSignal } from './signals.ts';
import { HELIOS_ALT06_PRODUCT_DEMAND_PLANE_SCHEMA } from './taxonomy.ts';
import type { Alt06ObservationStoreSnapshot, Alt06ProductDemandFeaturePlane } from './types.ts';

export type Alt06ProductDemandFabricOptions = {
  readonly calibration?: ReturnType<typeof alt06DefaultEmpiricalCalibration>;
};

export class Alt06ProductDemandFabric {
  readonly #calibration: ReturnType<typeof alt06DefaultEmpiricalCalibration>;
  readonly #observations: Alt06ProductDemandObservation[] = [];

  constructor(options: Alt06ProductDemandFabricOptions = {}) {
    this.#calibration = options.calibration ?? alt06DefaultEmpiricalCalibration();
  }

  ingest(rows: readonly Alt06ProductDemandObservation[]): void {
    for (const row of rows) {
      const verdict = assertPermittedProductDemandSource(row.provenance.provider);
      if (!verdict.permitted) {
        throw new Error(`alt06_source_refused:${verdict.reason}`);
      }
      this.#observations.push(row);
    }
  }

  snapshot(): Alt06ObservationStoreSnapshot {
    const bundle = partitionProductDemandObservations(this.#observations);
    return Object.freeze({
      skus: bundle.skus,
      prices: bundle.prices,
      availability: bundle.availability,
      promotions: bundle.promotions,
      assortments: bundle.assortments,
    });
  }

  compileFeaturePlane(input: {
    readonly skuEntityId: string;
    readonly evaluationTime: UtcInstant;
    readonly competitorSkuIds?: readonly string[];
    readonly categorySkuIds?: readonly string[];
  }): Alt06ProductDemandFeaturePlane {
    const store = this.snapshot();
    const competitorSkuIds = input.competitorSkuIds ?? [];
    const categorySkuIds =
      input.categorySkuIds ??
      store.skus
        .filter((row) => row.categoryId === store.skus.find((sku) => sku.skuEntityId === input.skuEntityId)?.categoryId)
        .map((row) => row.skuEntityId);

    const features = computeAlt06Features({
      skuEntityId: input.skuEntityId,
      evaluationTime: input.evaluationTime,
      prices: store.prices,
      availability: store.availability,
      promotions: store.promotions,
      assortments: store.assortments,
      competitorSkuIds,
      categorySkuIds,
    });

    const pricingPower = derivePricingPowerSignal({
      skuEntityId: input.skuEntityId,
      evaluationTime: input.evaluationTime,
      features,
      prices: store.prices,
      availability: store.availability,
      promotions: store.promotions,
      calibration: this.#calibration,
    });

    const demandSupplyImbalance = deriveDemandSupplyImbalanceState({
      skuEntityId: input.skuEntityId,
      evaluationTime: input.evaluationTime,
      features,
      promotions: store.promotions,
      calibration: this.#calibration,
    });

    return Object.freeze({
      schema: HELIOS_ALT06_PRODUCT_DEMAND_PLANE_SCHEMA,
      evaluationTime: input.evaluationTime,
      skuEntityId: input.skuEntityId,
      features,
      pricingPower,
      demandSupplyImbalance,
      calibration: this.#calibration,
      grantsExecutionAuthority: false,
    });
  }
}

export function createAlt06ProductDemandFabric(
  options?: Alt06ProductDemandFabricOptions,
): Alt06ProductDemandFabric {
  return new Alt06ProductDemandFabric(options);
}
