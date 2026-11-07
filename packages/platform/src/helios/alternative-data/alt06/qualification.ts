import { asUtcInstant } from '@solstice/domain';
import {
  assertPermittedProductDemandSource,
  matchSkuEntity,
  alt06DemoSkus,
} from '@solstice/external-data';

import { createAlt06ProductEntityGraph } from './entity-graph.ts';
import { createAlt06ProductDemandFabric } from './fabric.ts';
import {
  ALT06_DEMO_PRODUCT_NODE,
  ALT06_DEMO_SKU_CLASSIC,
  ALT06_DEMO_SKU_COMPETITOR,
  alt06DemoEntityGraphEdges,
  alt06DemoEntityGraphNodes,
  alt06DemoObservationBundle,
} from './fixtures.ts';
import {
  HELIOS_ALT06_PRODUCT_DEMAND_BLOCKED,
  HELIOS_ALT06_PRODUCT_DEMAND_QUALIFIED,
} from './taxonomy.ts';

export { HELIOS_ALT06_PRODUCT_DEMAND_QUALIFIED, HELIOS_ALT06_PRODUCT_DEMAND_BLOCKED };

export type Alt06QualificationChecks = {
  readonly licensedSourceOnly: boolean;
  readonly skuDeterministicMatch: boolean;
  readonly skuVariantMismatchRejected: boolean;
  readonly pointInTimePriceChange: boolean;
  readonly pricingPowerNotFromPriceAlone: boolean;
  readonly pricingPowerEmpiricalWhenCalibrated: boolean;
  readonly demandSupplyImbalanceCalibrated: boolean;
  readonly entityGraphResolvesToIssuer: boolean;
  readonly featureSurfaceComplete: boolean;
  readonly noExecutionAuthority: boolean;
};

export type Alt06QualificationResult = {
  readonly marker: typeof HELIOS_ALT06_PRODUCT_DEMAND_QUALIFIED | typeof HELIOS_ALT06_PRODUCT_DEMAND_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function runAlt06SelfChecks(): Alt06QualificationChecks {
  const fabric = createAlt06ProductDemandFabric();
  fabric.ingest(alt06DemoObservationBundle());

  const early = fabric.compileFeaturePlane({
    skuEntityId: ALT06_DEMO_SKU_CLASSIC,
    evaluationTime: asUtcInstant('2026-01-10T12:00:00.000Z'),
    competitorSkuIds: [ALT06_DEMO_SKU_COMPETITOR],
  });
  const late = fabric.compileFeaturePlane({
    skuEntityId: ALT06_DEMO_SKU_CLASSIC,
    evaluationTime: asUtcInstant('2026-01-25T12:00:00.000Z'),
    competitorSkuIds: [ALT06_DEMO_SKU_COMPETITOR],
  });

  const earlyChange = early.features.find((row) => row.featureId === 'alt06.price_change')?.valueMinor;
  const lateChange = late.features.find((row) => row.featureId === 'alt06.price_change')?.valueMinor;

  const licensed = assertPermittedProductDemandSource(alt06DemoObservationBundle()[0]!.provenance.provider).permitted;

  const catalog = alt06DemoSkus();
  const deterministic = matchSkuEntity({
    catalog,
    queryIdentifiers: [{ kind: 'gtin', value: '00012345678905' }],
  });
  const variantReject = matchSkuEntity({
    catalog,
    queryIdentifiers: [{ kind: 'gtin', value: '00012345678929' }],
    queryVariant: {
      packCount: '12',
      unitOfMeasure: null,
      flavorOrScent: null,
      sizeLabel: null,
      normalizedTitle: 'famous brand classic crisps 12oz 12pk',
    },
  });

  const graph = createAlt06ProductEntityGraph();
  for (const node of alt06DemoEntityGraphNodes()) {
    graph.upsertNode(node);
  }
  for (const edge of alt06DemoEntityGraphEdges()) {
    graph.appendEdge(edge);
  }
  const chain = graph.resolveCorporateChain({
    productNodeId: ALT06_DEMO_PRODUCT_NODE,
    asOf: asUtcInstant('2026-02-01T00:00:00.000Z'),
    knowableAtCutoff: asUtcInstant('2026-02-01T00:00:00.000Z'),
  });

  return Object.freeze({
    licensedSourceOnly: licensed,
    skuDeterministicMatch: deterministic.confidence === 'deterministic' && deterministic.skuEntityId === ALT06_DEMO_SKU_CLASSIC,
    skuVariantMismatchRejected: variantReject.confidence === 'rejected_variant_mismatch',
    pointInTimePriceChange: (earlyChange ?? 0n) === 0n && (lateChange ?? 0n) > 0n,
    pricingPowerNotFromPriceAlone: late.pricingPower?.signalKind !== 'price_increase_only_rejected',
    pricingPowerEmpiricalWhenCalibrated: late.pricingPower?.signalKind === 'empirical_pricing_power',
    demandSupplyImbalanceCalibrated:
      late.demandSupplyImbalance?.empiricallyCalibrated === true &&
      late.demandSupplyImbalance.imbalanceKind !== 'insufficient_calibration',
    entityGraphResolvesToIssuer: chain?.canonicalEntityId?.includes('0000320193') === true,
    featureSurfaceComplete: late.features.length === 11,
    noExecutionAuthority:
      late.grantsExecutionAuthority === false &&
      late.pricingPower?.grantsExecutionAuthority === false &&
      late.demandSupplyImbalance?.grantsExecutionAuthority === false,
  });
}

export function evaluateAlt06Qualification(
  checks: Alt06QualificationChecks = runAlt06SelfChecks(),
): Alt06QualificationResult {
  const blockers = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_ALT06_PRODUCT_DEMAND_QUALIFIED : HELIOS_ALT06_PRODUCT_DEMAND_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
