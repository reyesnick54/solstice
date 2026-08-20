import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import {
  certifyFloatValue,
  certifyLogisticsSandbox,
  certifySameControllerQuorum,
  certifySchemaDrift,
  deriveTonneKm,
  ingestLogisticsObservation,
  logisticsFactCannotAutoMint,
  logisticsObservationNeverMints,
  resetDeliveryDedup,
  reviewRestrictedMovement,
  storageFactCannotAutoMint,
} from './oracle/production/provider-families/logistics/index.ts';
import { runMoonReyLogisticsDataFabricDemo } from './oracle/production/provider-families/logistics/demo.ts';
import {
  COMPLETED_DELIVERY,
  DIGITAL_PHYSICAL_MERGE,
  DISTANCE_WITHOUT_MASS,
  DUPLICATE_CARRIER_DELIVERY,
  FLOAT_MASS_DISTANCE,
  GOODS_REPLAYED_AS_LOGISTICS,
  IMPOSSIBLE_MOVEMENT,
  IN_TRANSIT_DELIVERY,
  MASS_WITHOUT_DISTANCE,
  MULTI_LEG_SHIPMENT,
  NETWORK_ATTEMPT,
  OVERLAPPING_LEGS,
  RAW_GPS_LEAK,
  SAME_CONTROLLER_QUORUM,
  SCHEMA_DRIFT,
  STORAGE_MISSING_DURATION,
  VALID_TONNE_KM,
  WAREHOUSE_CAPACITY,
  WAREHOUSE_VOLUME_TIME,
  WHOLE_TRIP_PLUS_LEGS,
} from './oracle/production/provider-families/logistics/fixtures.ts';

describe('CHUNK-132 logistics, freight, delivery, and storage data fabric', () => {
  beforeEach(() => {
    resetDeliveryDedup();
  });

  it('1. valid tonne-km', () => {
    const result = ingestLogisticsObservation(VALID_TONNE_KM);
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.accepted, true);
    assert.equal(result.value.publicEvidence?.unit, 'tonne_km');
    assert.equal(result.value.publicEvidence?.mantissa, '500');
    assert.equal(result.value.freightReceipts[0]?.floatingPointUsed, false);
  });

  it('2. mass-distance exact derivation', () => {
    const receipt = deriveTonneKm(
      { mantissa: '2500', scale: 0, unit: 'kg' },
      { mantissa: '200', scale: 0, unit: 'km' },
      undefined,
    );
    if (!receipt.ok) {
      throw new Error(receipt.error.detail);
    }
    assert.equal(receipt.value.tonneKm.unitId, 'tonne_km');
    assert.equal(receipt.value.tonneKm.mantissa, 500n);
    assert.equal(receipt.value.tonneKm.denominator, 1n);
    assert.equal(receipt.value.exact, true);
    assert.equal(receipt.value.floatingPointUsed, false);
  });

  it('3. distance-only rejected', () => {
    const result = ingestLogisticsObservation(DISTANCE_WITHOUT_MASS);
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.accepted, false);
    assert.equal(result.value.refusal?.code, 'DISTANCE_WITHOUT_MASS');
  });

  it('4. mass-only rejected', () => {
    const result = ingestLogisticsObservation(MASS_WITHOUT_DISTANCE);
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.accepted, false);
    assert.equal(result.value.refusal?.code, 'MASS_WITHOUT_DISTANCE');
  });

  it('5. multi-leg attribution', () => {
    const result = ingestLogisticsObservation(MULTI_LEG_SHIPMENT);
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.accepted, true);
    assert.equal(result.value.events.length, 2);
    assert.equal(result.value.freightReceipts.length, 2);
    assert.equal(result.value.events[0]?.parentEventRefs.length, 1);
  });

  it('6. whole route + legs cannot over-attribute', () => {
    const result = ingestLogisticsObservation(WHOLE_TRIP_PLUS_LEGS);
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.accepted, false);
    assert.equal(result.value.refusal?.code, 'WHOLE_TRIP_AND_LEGS_DOUBLE_COUNT');
  });

  it('7. delivery completion', () => {
    const result = ingestLogisticsObservation(COMPLETED_DELIVERY);
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.accepted, true);
    assert.equal(result.value.publicEvidence?.claimType, 'DELIVERY');
    assert.equal(result.value.publicEvidence?.containsSignatureImage, false);
  });

  it('8. in-transit not completed', () => {
    const result = ingestLogisticsObservation(IN_TRANSIT_DELIVERY);
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.accepted, false);
    assert.equal(result.value.refusal?.code, 'DELIVERY_NOT_COMPLETED');
  });

  it('9. duplicate delivery deduplicated', () => {
    const first = ingestLogisticsObservation(COMPLETED_DELIVERY);
    const second = ingestLogisticsObservation(DUPLICATE_CARRIER_DELIVERY);
    assert.equal(first.ok && first.value.accepted, true);
    if (!second.ok) {
      throw new Error(second.error.detail);
    }
    assert.equal(second.value.accepted, false);
    assert.equal(second.value.refusal?.code, 'DUPLICATE_DELIVERY');
  });

  it('10. manufacturing goods distinct from logistics', () => {
    const result = ingestLogisticsObservation(GOODS_REPLAYED_AS_LOGISTICS);
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.accepted, false);
    assert.equal(result.value.refusal?.code, 'GOODS_OUTPUT_REPLAYED_AS_LOGISTICS');
    assert.equal(result.value.goodsProductionRecountedAsLogistics, false);
  });

  it('11. warehouse capacity not realized service', () => {
    const result = ingestLogisticsObservation(WAREHOUSE_CAPACITY);
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.accepted, true);
    assert.equal(result.value.publicEvidence?.realizationState, 'CAPACITY');
    assert.equal(result.value.publicEvidence?.unit, 'm3');
    assert.equal(result.value.warehouseCapacityEqualsStorageService, false);
  });

  it('12. storage with duration', () => {
    const result = ingestLogisticsObservation(WAREHOUSE_VOLUME_TIME);
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.accepted, true);
    assert.equal(result.value.publicEvidence?.unit, 'm3_hour');
    assert.equal(result.value.publicEvidence?.mantissa, '20');
    assert.equal(result.value.publicEvidence?.realizationState, 'REALIZED');
  });

  it('13. storage without duration rejected', () => {
    const result = ingestLogisticsObservation(STORAGE_MISSING_DURATION);
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.accepted, false);
    assert.equal(result.value.refusal?.code, 'DURATION_REQUIRED');
  });

  it('14. raw GPS absent from public evidence', () => {
    const leak = ingestLogisticsObservation(RAW_GPS_LEAK);
    assert.equal(leak.ok && leak.value.accepted, false);
    if (!leak.ok) {
      throw new Error(leak.error.detail);
    }
    assert.equal(leak.value.refusal?.code, 'RAW_GPS_PUBLIC_FORBIDDEN');
    const valid = ingestLogisticsObservation(VALID_TONNE_KM);
    assert.equal(valid.ok && valid.value.accepted, true);
    if (!valid.ok) {
      throw new Error(valid.error.detail);
    }
    assert.equal(valid.value.publicEvidence?.containsRawGps, false);
    assert.equal(valid.value.rawGpsPublic, false);
  });

  it('15. impossible movement flagged', () => {
    const result = ingestLogisticsObservation(IMPOSSIBLE_MOVEMENT);
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.accepted, true);
    assert.equal(result.value.movement.reviewRequired, true);
    assert.ok(result.value.movement.flags.includes('IMPOSSIBLE_SPEED'));
    assert.equal(result.value.movement.securityGradeAntiSpoofing, false);
    const review = reviewRestrictedMovement(IMPOSSIBLE_MOVEMENT.restrictedTelematics);
    assert.equal(review.securityGradeAntiSpoofing, false);
  });

  it('16. digital/physical storage not physically merged', () => {
    const result = ingestLogisticsObservation(DIGITAL_PHYSICAL_MERGE);
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.accepted, false);
    assert.equal(result.value.refusal?.code, 'DIGITAL_PHYSICAL_STORAGE_MERGED');
  });

  it('17. no real network calls', () => {
    const result = ingestLogisticsObservation(NETWORK_ATTEMPT);
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.accepted, false);
    assert.equal(result.value.refusal?.code, 'NETWORK_FORBIDDEN');
    assert.equal(result.value.networkCalls, 0);
    assert.equal(result.value.realCarrierContacted, false);
  });

  it('18. logistics fact cannot auto-mint', () => {
    const result = ingestLogisticsObservation(VALID_TONNE_KM);
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.logisticsFactAutoMints, false);
    assert.equal(result.value.productionActive, false);
    assert.equal(logisticsFactCannotAutoMint(), false);
    assert.equal(logisticsObservationNeverMints(result.value), true);
    for (const event of result.value.events) {
      assert.equal(event.authorizesMoonReyIssuance, false);
      assert.equal(event.productionActive, false);
    }
  });

  it('19. storage fact cannot auto-mint', () => {
    const result = ingestLogisticsObservation(WAREHOUSE_VOLUME_TIME);
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.storageFactAutoMints, false);
    assert.equal(storageFactCannotAutoMint(), false);
    for (const event of result.value.events) {
      assert.equal(event.authorizesMoonReyIssuance, false);
    }
  });

  it('rejects overlapping independently realized legs', () => {
    const result = ingestLogisticsObservation(OVERLAPPING_LEGS);
    assert.equal(result.ok && result.value.accepted, false);
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.refusal?.code, 'OVERLAPPING_LEGS');
  });

  it('rejects same-controller fake quorum', () => {
    const result = ingestLogisticsObservation(SAME_CONTROLLER_QUORUM);
    assert.equal(result.ok && result.value.accepted, false);
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.refusal?.code, 'SAME_CONTROLLER_FAKE_QUORUM');
  });

  it('rejects float mass/distance', () => {
    const result = ingestLogisticsObservation(FLOAT_MASS_DISTANCE);
    assert.equal(result.ok && result.value.accepted, false);
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.refusal?.code, 'FLOAT_QUANTITY_FORBIDDEN');
  });

  it('rejects schema drift', () => {
    const result = ingestLogisticsObservation(SCHEMA_DRIFT);
    assert.equal(result.ok && result.value.accepted, false);
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.refusal?.code, 'SCHEMA_DRIFT');
  });

  it('certifies logistics sandbox and fails adversarial certification cases', () => {
    const valid = certifyLogisticsSandbox();
    assert.equal(valid.record.status, 'TESTNET_ADMISSIBLE');
    assert.equal(valid.record.productionAuthorized, false);
    assert.equal(certifySameControllerQuorum().record.independenceResults.fakeQuorum, true);
    assert.equal(certifySchemaDrift().record.status, 'CONFORMANCE_FAILED');
    assert.equal(certifyFloatValue().record.status, 'CONFORMANCE_FAILED');
  });

  it('demo keeps manufacturing distinct from logistics and storage', () => {
    resetDeliveryDedup();
    const report = runMoonReyLogisticsDataFabricDemo();
    assert.equal(report.manufacturingQuantity, 40n);
    assert.equal(report.logisticsTonneKm, '500');
    assert.equal(report.legs, 2);
    assert.equal(report.deliveryAccepted, true);
    assert.equal(report.storageUnit, 'm3_hour');
    assert.equal(report.goodsRecounted, false);
  });
});
