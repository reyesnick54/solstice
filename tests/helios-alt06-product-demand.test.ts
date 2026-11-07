/**
 * HELIOS ALT06 — product, pricing, and availability intelligence.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/index.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  assertPermittedProductDemandSource,
  matchSkuEntity,
  alt06DemoSkus,
} from '../packages/external-data/src/product-demand/index.ts';
import {
  HELIOS_ALT06_PRODUCT_DEMAND_QUALIFIED,
  ALT06_DEMO_SKU_CLASSIC,
  ALT06_DEMO_SKU_COMPETITOR,
  createAlt06ProductDemandFabric,
  createAlt06ProductEntityGraph,
  evaluateAlt06Qualification,
  alt06DemoEntityGraphEdges,
  alt06DemoEntityGraphNodes,
  alt06DemoObservationBundle,
  ALT06_DEMO_PRODUCT_NODE,
  runAlt06SelfChecks,
} from '../packages/platform/src/helios/alternative-data/alt06/index.ts';

describe('HELIOS ALT06 product demand intelligence', () => {
  it('simulation posture', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('rejects unauthorized retail scraping sources', () => {
    const verdict = assertPermittedProductDemandSource({
      providerId: 'scraper',
      feedId: 'retail_html',
      capability: 'scrape',
      providerKind: 'simulation_fixture',
      sourcePermitClass: 'unauthorized_retail_scrape',
    });
    assert.equal(verdict.permitted, false);
  });

  it('does not match unrelated product variants', () => {
    const reject = matchSkuEntity({
      catalog: alt06DemoSkus(),
      queryIdentifiers: [{ kind: 'gtin', value: '00012345678929' }],
      queryVariant: {
        packCount: '12',
        unitOfMeasure: null,
        flavorOrScent: null,
        sizeLabel: null,
        normalizedTitle: 'famous brand classic crisps 12oz 12pk',
      },
    });
    assert.equal(reject.confidence, 'rejected_variant_mismatch');
  });

  it('point-in-time feature plane hides future price revisions', () => {
    const fabric = createAlt06ProductDemandFabric();
    fabric.ingest(alt06DemoObservationBundle());

    const beforeSecondPrice = fabric.compileFeaturePlane({
      skuEntityId: ALT06_DEMO_SKU_CLASSIC,
      evaluationTime: asUtcInstant('2026-01-12T12:00:00.000Z'),
      competitorSkuIds: [ALT06_DEMO_SKU_COMPETITOR],
    });
    const afterSecondPrice = fabric.compileFeaturePlane({
      skuEntityId: ALT06_DEMO_SKU_CLASSIC,
      evaluationTime: asUtcInstant('2026-01-18T12:00:00.000Z'),
      competitorSkuIds: [ALT06_DEMO_SKU_COMPETITOR],
    });

    const beforeLevel = beforeSecondPrice.features.find((row) => row.featureId === 'alt06.price_level');
    const afterLevel = afterSecondPrice.features.find((row) => row.featureId === 'alt06.price_level');
    assert.equal(beforeLevel?.valueMinor, 349n);
    assert.equal(afterLevel?.valueMinor, 379n);
  });

  it('pricing power requires multi-factor evidence', () => {
    const fabric = createAlt06ProductDemandFabric();
    fabric.ingest(alt06DemoObservationBundle());
    const plane = fabric.compileFeaturePlane({
      skuEntityId: ALT06_DEMO_SKU_CLASSIC,
      evaluationTime: asUtcInstant('2026-01-20T12:00:00.000Z'),
      competitorSkuIds: [ALT06_DEMO_SKU_COMPETITOR],
    });
    assert.ok(plane.pricingPower);
    assert.notEqual(plane.pricingPower.signalKind, 'price_increase_only_rejected');
    assert.equal(plane.pricingPower.grantsExecutionAuthority, false);
  });

  it('resolves PRODUCT → BRAND → SUBSIDIARY → PUBLIC COMPANY temporally', () => {
    const graph = createAlt06ProductEntityGraph();
    for (const node of alt06DemoEntityGraphNodes()) {
      graph.upsertNode(node);
    }
    for (const edge of alt06DemoEntityGraphEdges()) {
      graph.appendEdge(edge);
    }
    const chain = graph.resolveCorporateChain({
      productNodeId: ALT06_DEMO_PRODUCT_NODE,
      asOf: asUtcInstant('2026-03-01T00:00:00.000Z'),
      knowableAtCutoff: asUtcInstant('2026-03-01T00:00:00.000Z'),
    });
    assert.ok(chain?.canonicalEntityId?.includes('0000320193'));
  });

  it('qualifies HELIOS_ALT06_PRODUCT_DEMAND_QUALIFIED', () => {
    const checks = runAlt06SelfChecks();
    const result = evaluateAlt06Qualification(checks);
    assert.equal(result.qualified, true, result.blockers.join('; '));
    assert.equal(result.marker, HELIOS_ALT06_PRODUCT_DEMAND_QUALIFIED);
  });
});
