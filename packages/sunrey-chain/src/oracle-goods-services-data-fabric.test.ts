import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EconomicAssetRegistry } from '../../economic-asset-registry/src/index.ts';
import { schemaAllowsUnit, FACT_SCHEMAS } from './oracle/schemas.ts';
import { UNIT_CODES } from './oracle/types.ts';
import { convertExact } from './units/convert.ts';
import { ProductiveAttributionBook } from './productive/policy-governance/attribution-accounting/book.ts';
import { simulationAttributionDecision } from './productive/policy-governance/attribution-accounting/book.ts';
import { manufacturingObservation as attributionManufacturing } from './productive/policy-governance/attribution-accounting/fixtures.ts';
import {
  GoodsCommerceDataFabric,
  HUMAN_WORTH_SCORING,
  ORDER_EQUALS_OUTPUT,
  PAYMENT_EQUALS_PRODUCTIVE_OUTPUT,
  PRODUCTION_ACTIVE,
  REAL_PROVIDER_CONTACTED,
  evaluateAgricultureGoodsAttribution,
  evaluateGoodsCertificationCase,
  evaluateLogisticsGoodsDeliveryAttribution,
  evaluateManufacturingGoodsAttribution,
  goodsObservationNeverMints,
  ingestGoodsObservation,
  projectGoodsMetadata,
} from './oracle/production/provider-families/goods/index.ts';
import {
  AGRICULTURE_GOODS_BATCH,
  CANCELLED_UNFULFILLED_ORDER,
  CUSTOMER_PII_LEAK,
  IN_TRANSIT_DELIVERY,
  NETWORK_ATTEMPT,
  ORDER_AS_OUTPUT,
  PAYMENT_AS_OUTPUT,
  PAYMENT_CARD_LEAK,
  RETURNED_GOOD,
  SAME_CONTROLLER_QUORUM,
  SANDBOX_AG_EVENT,
  SANDBOX_CARRIER_EVENT,
  SANDBOX_MFG_EVENT,
  VALID_FINISHED_GOODS_BATCH,
  VALID_GOODS_DELIVERY,
} from './oracle/production/provider-families/goods/fixtures.ts';
import { runMoonReyGoodsServicesDataFabricDemo } from './oracle/production/provider-families/goods/demo.ts';
import {
  HUMAN_WORTH_SCORING as SERVICE_HUMAN_WORTH,
  INVOICE_EQUALS_COMPLETED_SERVICE,
  SERVICE_VALUE_FROM_INVOICE,
  historicalMachineHourPreserved,
  ingestServiceObservation,
  projectServiceMetadata,
  publicEvidenceHidesPayload,
  serviceObservationNeverMints,
} from './oracle/production/provider-families/services/index.ts';
import {
  BOOKING_AS_COMPLETION,
  DIGITAL_PAYLOAD_LEAK,
  DIGITAL_SERVICE_METER,
  HISTORICAL_MACHINE_HOUR,
  HOURS_FROM_INVOICE,
  HUMAN_WORTH_SCORE,
  INVOICE_AS_COMPLETION,
  MACHINE_H_AS_HUMAN_HOUR,
  VALID_TIME_SERVICE,
  VALID_UNITIZED_SERVICE,
} from './oracle/production/provider-families/services/fixtures.ts';

describe('CHUNK-137 goods, commerce, and service delivery data fabric', () => {
  it('1. valid goods output', () => {
    const result = ingestGoodsObservation(VALID_FINISHED_GOODS_BATCH);
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.value.publicEvidence.factType, 'GOODS_OUTPUT');
    assert.equal(result.value.publicEvidence.mantissa, '100');
    assert.equal(result.value.mintsMoonRey, false);
  });

  it('2. valid goods delivery', () => {
    const result = ingestGoodsObservation(VALID_GOODS_DELIVERY);
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.value.publicEvidence.factType, 'GOODS_DELIVERY');
    assert.equal(result.value.publicEvidence.claimType, 'DELIVERY');
  });

  it('3. order is not goods output', () => {
    const result = ingestGoodsObservation(ORDER_AS_OUTPUT);
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.error.code, 'ORDER_IS_NOT_OUTPUT');
    assert.equal(ORDER_EQUALS_OUTPUT, false);
  });

  it('4. invoice is not service completion', () => {
    const result = ingestServiceObservation(INVOICE_AS_COMPLETION);
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.error.code, 'INVOICE_IS_NOT_COMPLETION');
    assert.equal(INVOICE_EQUALS_COMPLETED_SERVICE, false);
  });

  it('5. payment is not output', () => {
    const goods = ingestGoodsObservation(PAYMENT_AS_OUTPUT);
    assert.equal(goods.ok, false);
    if (!goods.ok) {
      assert.equal(goods.error.code, 'PAYMENT_IS_NOT_OUTPUT');
    }
    assert.equal(PAYMENT_EQUALS_PRODUCTIVE_OUTPUT, false);
  });

  it('6. manufacturing → goods attribution is not a double count', () => {
    const result = evaluateManufacturingGoodsAttribution(SANDBOX_MFG_EVENT, VALID_FINISHED_GOODS_BATCH);
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    const full = result.value.decisions.filter((row) => row.decision === 'FULL_ATTRIBUTION').length;
    assert.equal(full <= 1, true);
    assert.equal(result.value.authorizesIssuance, false);
  });

  it('7. agriculture → goods attribution is not a double count', () => {
    const result = evaluateAgricultureGoodsAttribution(SANDBOX_AG_EVENT, AGRICULTURE_GOODS_BATCH);
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    const full = result.value.decisions.filter((row) => row.decision === 'FULL_ATTRIBUTION').length;
    assert.equal(full <= 1, true);
  });

  it('8. logistics → goods-delivery attribution is not a double count', () => {
    const same = evaluateLogisticsGoodsDeliveryAttribution(SANDBOX_CARRIER_EVENT, VALID_GOODS_DELIVERY, false);
    assert.equal(same.ok, true);
    if (same.ok) {
      const full = same.value.decisions.filter((row) => row.decision === 'FULL_ATTRIBUTION').length;
      assert.equal(full <= 1, true);
    }
    const distinct = evaluateLogisticsGoodsDeliveryAttribution(SANDBOX_CARRIER_EVENT, VALID_GOODS_DELIVERY, true);
    assert.equal(distinct.ok, true);
  });

  it('9. valid unitized service', () => {
    const result = ingestServiceObservation(VALID_UNITIZED_SERVICE);
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.value.publicEvidence.unit, 'units_produced');
    assert.equal(result.value.publicEvidence.serviceKind, 'UNITIZED');
  });

  it('10. valid time service', () => {
    const result = ingestServiceObservation(VALID_TIME_SERVICE);
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.value.publicEvidence.unit, 'service_hour');
    assert.equal(result.value.publicEvidence.durationSeconds, 10_800n);
  });

  it('11. service_hour exact handling', () => {
    assert.equal(UNIT_CODES.includes('service_hour'), true);
    assert.equal(schemaAllowsUnit('SERVICE_DELIVERY', 'service_hour'), true);
    const converted = convertExact({
      source: { mantissa: 2n, scale: 0, numerator: 1n, denominator: 1n, unitId: 'service_hour' },
      targetUnitId: 'service_hour',
      context: { factType: 'SERVICE_DELIVERY', productiveCategory: 'SERVICES' },
    });
    assert.equal(converted.ok, true);
    if (converted.ok) {
      assert.equal(converted.value.targetQuantity.mantissa, 2n);
      assert.equal(converted.value.exact, true);
      assert.equal(converted.value.roundingApplied, false);
    }
    const asMachine = convertExact({
      source: { mantissa: 2n, scale: 0, numerator: 1n, denominator: 1n, unitId: 'service_hour' },
      targetUnitId: 'machine_h',
    });
    assert.equal(asMachine.ok, false);
  });

  it('12. historical machine_h semantics preserved', () => {
    assert.equal(schemaAllowsUnit('SERVICE_DELIVERY', 'machine_h'), true);
    assert.deepEqual(FACT_SCHEMAS.SERVICE_DELIVERY.allowedUnits.includes('machine_h'), true);
    const result = ingestServiceObservation(HISTORICAL_MACHINE_HOUR);
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.value.publicEvidence.unit, 'machine_h');
    assert.equal(historicalMachineHourPreserved(HISTORICAL_MACHINE_HOUR), true);
    const misuse = ingestServiceObservation(MACHINE_H_AS_HUMAN_HOUR);
    assert.equal(misuse.ok, false);
    if (!misuse.ok) {
      assert.equal(misuse.error.code, 'MACHINE_H_IS_NOT_SERVICE_HOUR');
    }
  });

  it('13. cancelled unfulfilled order creates no output', () => {
    const result = ingestGoodsObservation(CANCELLED_UNFULFILLED_ORDER);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'CANCELLED_BEFORE_REALIZATION');
    }
  });

  it('14. return preserves history', () => {
    const fabric = new GoodsCommerceDataFabric();
    const original = fabric.ingest(VALID_FINISHED_GOODS_BATCH);
    assert.equal(original.ok, true);
    const returned = fabric.ingest(RETURNED_GOOD);
    assert.equal(returned.ok, true);
    if (!returned.ok) {
      return;
    }
    assert.equal(returned.value.returnRecord?.historicEvidencePreserved, true);
    assert.equal(returned.value.returnRecord?.historicEventDeleted, false);
    assert.equal(fabric.observations().length, 2);
  });

  it('15. return does not auto-clawback monetary state', () => {
    const fabric = new GoodsCommerceDataFabric();
    fabric.ingest(VALID_FINISHED_GOODS_BATCH);
    const returned = fabric.ingest(RETURNED_GOOD);
    assert.equal(returned.ok, true);
    if (!returned.ok) {
      return;
    }
    assert.equal(returned.value.returnRecord?.clawbackExecuted, false);
    assert.equal(returned.value.returnRecord?.monetaryAdjustmentReviewRequired, true);

    const book = new ProductiveAttributionBook();
    const observation = attributionManufacturing({
      claimId: 'claim.book.goods',
      contributionId: 'vpc.book.goods',
      category: 'GOODS',
    });
    const reserved = book.reserve({
      observation,
      decision: simulationAttributionDecision(observation, {
        attributionDecisionId: 'dec.goods.return',
        allocatedShare: 1_000_000n,
      }),
      expectedPolicyVersion: 1,
    });
    assert.equal(reserved.ok, true);
    if (!reserved.ok) {
      return;
    }
    book.finalize(reserved.value.entryId);
    book.noteIssuanceStatus(reserved.value.entryId, 'SETTLED');
    const correction = book.correct({
      targetEntryId: reserved.value.entryId,
      reason: 'GOODS_RETURN_AFTER_SETTLEMENT',
      evidenceIds: ['return:obs.goods.output.valid'],
      supersede: false,
    });
    assert.equal(correction.ok, false);
    if (!correction.ok) {
      assert.equal(correction.code, 'MONETARY_ADJUSTMENT_REVIEW_REQUIRED');
    }
  });

  it('16. digital service hides payload', () => {
    const valid = ingestServiceObservation(DIGITAL_SERVICE_METER);
    assert.equal(valid.ok, true);
    if (valid.ok) {
      assert.equal(publicEvidenceHidesPayload(valid.value.publicEvidence), true);
    }
    const leaked = ingestServiceObservation(DIGITAL_PAYLOAD_LEAK);
    assert.equal(leaked.ok, false);
    if (!leaked.ok) {
      assert.equal(leaked.error.code, 'PAYLOAD_FORBIDDEN');
    }
  });

  it('17. customer PII absent', () => {
    const leaked = ingestGoodsObservation(CUSTOMER_PII_LEAK);
    assert.equal(leaked.ok, false);
    if (!leaked.ok) {
      assert.equal(leaked.error.code, 'CUSTOMER_PII_FORBIDDEN');
    }
    const card = ingestGoodsObservation(PAYMENT_CARD_LEAK);
    assert.equal(card.ok, false);
    if (!card.ok) {
      assert.equal(card.error.code, 'PAYMENT_CREDENTIAL_FORBIDDEN');
    }
    const valid = ingestGoodsObservation(VALID_GOODS_DELIVERY);
    assert.equal(valid.ok, true);
    if (valid.ok) {
      assert.equal(valid.value.publicEvidence.containsCustomerPii, false);
      assert.equal(JSON.stringify(valid.value.publicEvidence).includes('Ada'), false);
    }
  });

  it('18. same-controller fake quorum', () => {
    const result = ingestGoodsObservation(SAME_CONTROLLER_QUORUM);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'SAME_CONTROLLER_FAKE_QUORUM');
    }
  });

  it('19. human-worth scoring absent', () => {
    assert.equal(HUMAN_WORTH_SCORING, false);
    assert.equal(SERVICE_HUMAN_WORTH, false);
    const scored = ingestServiceObservation(HUMAN_WORTH_SCORE);
    assert.equal(scored.ok, false);
    if (!scored.ok) {
      assert.equal(scored.error.code, 'HUMAN_WORTH_SCORING_FORBIDDEN');
    }
  });

  it('20. no real external calls', () => {
    assert.equal(REAL_PROVIDER_CONTACTED, false);
    const networked = ingestGoodsObservation(NETWORK_ATTEMPT);
    assert.equal(networked.ok, false);
    if (!networked.ok) {
      assert.equal(networked.error.code, 'NETWORK_FORBIDDEN');
    }
  });

  it('21. fact cannot auto-mint', () => {
    const goods = ingestGoodsObservation(VALID_FINISHED_GOODS_BATCH);
    assert.equal(goods.ok, true);
    if (goods.ok) {
      assert.equal(goodsObservationNeverMints(goods.value), true);
      assert.equal(goods.value.mintsMoonRey, false);
    }
    const service = ingestServiceObservation(VALID_UNITIZED_SERVICE);
    assert.equal(service.ok, true);
    if (service.ok) {
      assert.equal(serviceObservationNeverMints(service.value), true);
      assert.equal(service.value.mintsMoonRey, false);
    }
    assert.equal(PRODUCTION_ACTIVE, false);
  });

  it('22. service value is not derived from invoice amount', () => {
    assert.equal(SERVICE_VALUE_FROM_INVOICE, false);
    const inferred = ingestServiceObservation(HOURS_FROM_INVOICE);
    assert.equal(inferred.ok, false);
    if (!inferred.ok) {
      assert.equal(inferred.error.code, 'HOURS_INFERRED_FROM_INVOICE');
    }
  });

  it('in-transit is not goods delivery', () => {
    const result = ingestGoodsObservation(IN_TRANSIT_DELIVERY);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'DELIVERY_NOT_COMPLETED');
    }
  });

  it('booking is not completed service', () => {
    const result = ingestServiceObservation(BOOKING_AS_COMPLETION);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'BOOKING_IS_NOT_COMPLETION');
    }
  });

  it('projects goods and service metadata without raw content', () => {
    const goods = ingestGoodsObservation(VALID_FINISHED_GOODS_BATCH);
    const service = ingestServiceObservation(VALID_UNITIZED_SERVICE);
    assert.equal(goods.ok && service.ok, true);
    if (!goods.ok || !service.ok) {
      return;
    }
    const registry = new EconomicAssetRegistry();
    const goodsAsset = projectGoodsMetadata(registry, goods.value.publicEvidence);
    const serviceAsset = projectServiceMetadata(registry, service.value.publicEvidence);
    assert.equal(goodsAsset.ok, true);
    assert.equal(serviceAsset.ok, true);
    if (goodsAsset.ok) {
      assert.equal(goodsAsset.value.economicCategory, 'GOODS');
      assert.equal(JSON.stringify(goodsAsset.value).includes('Ada'), false);
    }
    if (serviceAsset.ok) {
      assert.equal(serviceAsset.value.economicCategory, 'SERVICES');
    }
  });

  it('certification cases hold', () => {
    assert.equal(evaluateGoodsCertificationCase('finished-goods-batch').ok, true);
    assert.equal(evaluateGoodsCertificationCase('order-treated-as-output').ok, false);
    assert.equal(evaluateGoodsCertificationCase('same-controller-fake-quorum').ok, false);
  });

  it('demo prints the required refusals', () => {
    const demo = runMoonReyGoodsServicesDataFabricDemo();
    assert.equal(demo.goodsAccepted, true);
    assert.equal(demo.serviceCompleted, true);
    assert.equal(demo.bookingAccepted, false);
    assert.equal(demo.invoiceAccepted, false);
    assert.equal(demo.manufacturingGoodsFullCredits <= 1, true);
    assert.equal(ORDER_EQUALS_OUTPUT, false);
    assert.equal(INVOICE_EQUALS_COMPLETED_SERVICE, false);
    assert.equal(PAYMENT_EQUALS_PRODUCTIVE_OUTPUT, false);
    assert.equal(HUMAN_WORTH_SCORING, false);
    assert.equal(REAL_PROVIDER_CONTACTED, false);
    assert.equal(PRODUCTION_ACTIVE, false);
  });
});
