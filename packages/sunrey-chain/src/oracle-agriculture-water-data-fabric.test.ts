import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EconomicAssetRegistry } from '../../economic-asset-registry/src/index.ts';
import { liveMainnetConnectivityEnabled } from './oracle/production/runtime-types.ts';
import { FakeExternalHttpTransport } from './oracle/production/transport.ts';
import { mappingById } from './oracle/source-taxonomy/registry.ts';
import { validateSourceFactClaimMapping } from './oracle/source-taxonomy/validator.ts';
import {
  agricultureFactCannotAutoMint,
  agricultureProductionIsActive,
  agricultureRealProviderContacted,
  agricultureRecord,
  certifyAgricultureSandbox,
  classifyAgricultureIndependence,
  cumulativeHarvestPair,
  dairyMassRecord,
  evaluateAgricultureAdversary,
  evaluateAgricultureClaimPath,
  evaluateHarvestRights,
  farmSystemRecord,
  forecastYieldRecord,
  FORECAST_YIELD_EQUALS_OUTPUT,
  grainScaleRecord,
  harvestTelemetryRecord,
  identifyHarvestEvents,
  inferLegalOwnerFromOperator,
  ingestAgricultureRecord,
  ingestAgricultureRecords,
  inventoryMovementRecord,
  LEGAL_OWNERSHIP_INFERRED,
  linkHarvestToGoods,
  linkHarvestToInventory,
  linkHarvestToProcessing,
  linkIrrigationToHarvest,
  normalizeHarvestMass,
  plantedFieldRecord,
  PLANTED_AREA_EQUALS_OUTPUT,
  processedFlourRecord,
  projectAgricultureMetadata,
  qualityDoesNotChangePhysicalQuantity,
  qualityLeavesQuantityUnchanged,
  quantityToGrams,
  refuseDuplicateHarvestMass,
  runAgricultureWaterDataFabricDemo,
  simulationAgriculturePolicy,
  tonneHarvestRecord,
} from './oracle/production/provider-families/agriculture/index.ts';
import {
  certifyWaterSandbox,
  classifyWaterIndependence,
  cumulativeWaterPair,
  evaluateWaterAdversary,
  evaluateWaterClaimPath,
  evaluateWaterRights,
  identifyWaterProductionEvents,
  inferWaterLegalOwnerFromOperator,
  ingestWaterRecord,
  irrigationConsumptionEqualsWaterProduction,
  irrigationConsumptionRecord,
  IRRIGATION_CONSUMPTION_EQUALS_WATER_PRODUCTION,
  literProductionRecord,
  linkWaterProductionToIrrigation,
  normalizeWaterVolume,
  projectWaterMetadata,
  reservoirAvailabilityRecord,
  simulationWaterPolicy,
  treatmentMeterRecord,
  waterAvailabilityEqualsProduction,
  WATER_AVAILABILITY_EQUALS_PRODUCTION,
  waterFactCannotAutoMint,
  waterProductionIsActive,
  waterQualityDoesNotChangePhysicalQuantity,
  waterQualityLeavesQuantityUnchanged,
  waterRealProviderContacted,
  waterRecord,
  wellRecord,
} from './oracle/production/provider-families/water/index.ts';

const NOW = 1_700_000_000n;

describe('CHUNK-134 agriculture / food data fabric', () => {
  it('1. accepts valid harvest output', () => {
    const ingested = ingestAgricultureRecord(farmSystemRecord(NOW), NOW);
    assert.equal(ingested.ok, true);
    if (!ingested.ok) {
      throw new Error(ingested.error.detail);
    }
    assert.equal(ingested.value.observation.factType, 'AGRICULTURAL_OUTPUT');
    assert.equal(ingested.value.observation.canCreateOutputClaim, true);
    assert.equal(ingested.value.observation.canMintMoonRey, false);
    assert.equal(ingested.value.evidence.automaticIssuance, false);
  });

  it('2. normalizes kg and tonne exactly', () => {
    const kg = ingestAgricultureRecord(farmSystemRecord(NOW), NOW);
    assert.equal(kg.ok, true);
    if (!kg.ok) {
      throw new Error(kg.error.detail);
    }
    assert.equal(kg.value.observation.canonicalUnit, 'kg');
    const grams = quantityToGrams(kg.value.observation.canonicalQuantity);
    assert.equal(grams.ok, true);
    if (!grams.ok) {
      throw new Error(grams.error.detail);
    }
    assert.equal(grams.value, 1_000_000n);
    const tonne = ingestAgricultureRecord(tonneHarvestRecord(NOW), NOW);
    assert.equal(tonne.ok, true);
    if (!tonne.ok) {
      throw new Error(tonne.error.detail);
    }
    const converted = normalizeHarvestMass({
      mantissa: 2n,
      unit: 'tonne',
      factType: 'AGRICULTURAL_OUTPUT',
      targetUnit: 'kg',
    });
    assert.equal(converted.ok, true);
    if (!converted.ok) {
      throw new Error(converted.error.detail);
    }
    assert.equal(converted.value.canonical.mantissa, 2_000n);
    const dairy = ingestAgricultureRecord(dairyMassRecord(NOW), NOW);
    assert.equal(dairy.ok, true);
    const liters = ingestAgricultureRecord(agricultureRecord({ sourceClass: 'DAIRY_PRODUCTION_METER', unit: 'L', nowUnix: NOW }), NOW);
    assert.equal(liters.ok, false);
    if (!liters.ok) {
      assert.equal(liters.error.code, 'UNIT_EXTENSION_REQUIRED');
    }
  });

  it('3. does not treat a planted field as production', () => {
    const planted = ingestAgricultureRecord(plantedFieldRecord(NOW), NOW);
    assert.equal(planted.ok, false);
    if (planted.ok) {
      throw new Error('planted field must not be production');
    }
    assert.equal(planted.error.code, 'PLANTED_IS_NOT_PRODUCTION');
    assert.equal(PLANTED_AREA_EQUALS_OUTPUT, false);
    const area = evaluateAgricultureAdversary('PLANTED_ACREAGE_AS_OUTPUT', NOW);
    assert.equal(area.ok, true);
  });

  it('4. does not treat forecast yield as production', () => {
    const forecast = ingestAgricultureRecord(forecastYieldRecord(NOW), NOW);
    assert.equal(forecast.ok, false);
    if (forecast.ok) {
      throw new Error('forecast must not be production');
    }
    assert.equal(forecast.error.code, 'FORECAST_YIELD_IS_NOT_PRODUCTION');
    assert.equal(FORECAST_YIELD_EQUALS_OUTPUT, false);
    const adversary = evaluateAgricultureAdversary('FORECAST_AS_HARVEST', NOW);
    assert.equal(adversary.ok, true);
  });

  it('5. derives cumulative harvest delta', () => {
    const pair = cumulativeHarvestPair(NOW);
    const ingested = ingestAgricultureRecord(pair.current, NOW);
    assert.equal(ingested.ok, true);
    if (!ingested.ok) {
      throw new Error(ingested.error.detail);
    }
    assert.equal(ingested.value.observation.canonicalQuantity.mantissa, 1_000n);
  });

  it('6. handles harvest counter reset without negative output', () => {
    const reset = evaluateAgricultureAdversary('COUNTER_RESET', NOW);
    assert.equal(reset.ok, true);
  });

  it('7. dedupes harvest telemetry + scale + farm system as one event', () => {
    const batch = ingestAgricultureRecords(
      [harvestTelemetryRecord(NOW), grainScaleRecord(NOW), farmSystemRecord(NOW)],
      NOW,
    );
    assert.equal(batch.ok, true);
    if (!batch.ok) {
      throw new Error(batch.error.detail);
    }
    const events = identifyHarvestEvents(
      batch.value.map((row) => row.observation),
      NOW,
      NOW + 3_600n,
    );
    assert.equal(events.ok, true);
    if (!events.ok) {
      throw new Error(events.error.detail);
    }
    assert.equal(events.value.length, 1);
    const duplicate = refuseDuplicateHarvestMass(events.value, 3);
    assert.equal(duplicate.ok, false);
    const adversary = evaluateAgricultureAdversary('DUPLICATE_HARVEST', NOW);
    assert.equal(adversary.ok, true);
  });

  it('8. keeps harvest→processing lineage', () => {
    const harvest = ingestAgricultureRecord(farmSystemRecord(NOW), NOW);
    const flour = ingestAgricultureRecord(processedFlourRecord(NOW), NOW);
    assert.equal(harvest.ok && flour.ok, true);
    if (!harvest.ok || !flour.ok) {
      throw new Error('ingest failed');
    }
    const lineage = linkHarvestToProcessing({
      harvest: harvest.value.observation,
      processed: flour.value.observation,
    });
    assert.equal(lineage.ok, true);
    if (!lineage.ok) {
      throw new Error(lineage.error.detail);
    }
    assert.equal(lineage.value.relation, 'TRANSFORMS');
    assert.equal(lineage.value.impliesDuplicateValue, false);
    assert.equal(flour.value.observation.canCreateOutputClaim, false);
  });

  it('9. keeps harvest→goods lineage', () => {
    const harvest = ingestAgricultureRecord(farmSystemRecord(NOW), NOW);
    assert.equal(harvest.ok, true);
    if (!harvest.ok) {
      throw new Error(harvest.error.detail);
    }
    const lineage = linkHarvestToGoods({
      harvest: harvest.value.observation,
      goodsObservationId: 'goods.flour.88',
    });
    assert.equal(lineage.ok, true);
    if (!lineage.ok) {
      throw new Error(lineage.error.detail);
    }
    assert.equal(lineage.value.relation, 'OUTPUT_OF');
    assert.equal(lineage.value.impliesDuplicateValue, false);
  });
});

describe('CHUNK-134 water data fabric', () => {
  it('10. accepts valid water production', () => {
    const ingested = ingestWaterRecord(treatmentMeterRecord(NOW), NOW);
    assert.equal(ingested.ok, true);
    if (!ingested.ok) {
      throw new Error(ingested.error.detail);
    }
    assert.equal(ingested.value.observation.factType, 'WATER_PRODUCTION');
    assert.equal(ingested.value.observation.canCreateOutputClaim, true);
    assert.equal(ingested.value.observation.canMintMoonRey, false);
  });

  it('11. normalizes L and m3 exactly', () => {
    const liters = ingestWaterRecord(literProductionRecord(NOW), NOW);
    assert.equal(liters.ok, true);
    if (!liters.ok) {
      throw new Error(liters.error.detail);
    }
    assert.equal(liters.value.observation.canonicalUnit, 'L');
    const converted = normalizeWaterVolume({
      mantissa: 2_000n,
      unit: 'L',
      factType: 'WATER_PRODUCTION',
      targetUnit: 'm3',
    });
    assert.equal(converted.ok, true);
    if (!converted.ok) {
      throw new Error(converted.error.detail);
    }
    assert.equal(converted.value.canonical.mantissa, 2n);
    const volumeTime = ingestWaterRecord(waterRecord({ unit: 'm3_hour', nowUnix: NOW }), NOW);
    assert.equal(volumeTime.ok, false);
  });

  it('12. does not treat water availability as output', () => {
    const reserve = ingestWaterRecord(reservoirAvailabilityRecord(NOW), NOW);
    assert.equal(reserve.ok, true);
    if (!reserve.ok) {
      throw new Error(reserve.error.detail);
    }
    assert.equal(reserve.value.observation.factType, 'WATER_AVAILABILITY');
    assert.equal(reserve.value.observation.canCreateOutputClaim, false);
    assert.equal(waterAvailabilityEqualsProduction(), false);
    assert.equal(WATER_AVAILABILITY_EQUALS_PRODUCTION, false);
    const output = evaluateWaterClaimPath({ factType: 'WATER_AVAILABILITY', claimType: 'OUTPUT' });
    assert.equal(output.ok, false);
    const mapping = mappingById('spm.water.WATER_AVAILABILITY.WATER', 1);
    assert.ok(mapping);
    assert.equal(mapping.allowedClaimTypes.includes('OUTPUT'), false);
    const adversary = evaluateWaterAdversary('AVAILABILITY_AS_PRODUCTION', NOW);
    assert.equal(adversary.ok, true);
  });

  it('13. derives cumulative water meter interval', () => {
    const pair = cumulativeWaterPair(NOW);
    const ingested = ingestWaterRecord(pair.current, NOW);
    assert.equal(ingested.ok, true);
    if (!ingested.ok) {
      throw new Error(ingested.error.detail);
    }
    assert.equal(ingested.value.observation.canonicalQuantity.mantissa, 500n);
  });

  it('14. does not treat irrigation consumption as water production', () => {
    const irrigation = ingestWaterRecord(irrigationConsumptionRecord(NOW), NOW);
    assert.equal(irrigation.ok, true);
    if (!irrigation.ok) {
      throw new Error(irrigation.error.detail);
    }
    assert.equal(irrigation.value.observation.isIrrigationInput, true);
    assert.equal(irrigation.value.observation.canCreateOutputClaim, false);
    assert.equal(irrigationConsumptionEqualsWaterProduction(), false);
    assert.equal(IRRIGATION_CONSUMPTION_EQUALS_WATER_PRODUCTION, false);
    const production = ingestWaterRecord(treatmentMeterRecord(NOW), NOW);
    assert.equal(production.ok, true);
    if (!production.ok) {
      throw new Error(production.error.detail);
    }
    const lineage = linkWaterProductionToIrrigation({
      production: production.value.observation,
      irrigation: irrigation.value.observation,
    });
    assert.equal(lineage.ok, true);
    if (!lineage.ok) {
      throw new Error(lineage.error.detail);
    }
    assert.equal(lineage.value.relation, 'INPUT_TO');
    const disguised = evaluateWaterAdversary('IRRIGATION_AS_PRODUCTION', NOW);
    assert.equal(disguised.ok, true);
  });
});

describe('CHUNK-134 shared agriculture / water invariants', () => {
  it('15. does not treat inventory movement as production', () => {
    const inventory = ingestAgricultureRecord(inventoryMovementRecord(NOW), NOW);
    assert.equal(inventory.ok, true);
    if (!inventory.ok) {
      throw new Error(inventory.error.detail);
    }
    assert.equal(inventory.value.observation.createsHarvestEvent, false);
    assert.equal(inventory.value.observation.createsInventoryEvidence, true);
    const harvest = ingestAgricultureRecord(farmSystemRecord(NOW), NOW);
    assert.equal(harvest.ok, true);
    if (!harvest.ok) {
      throw new Error(harvest.error.detail);
    }
    const lineage = linkHarvestToInventory({
      harvest: harvest.value.observation,
      inventory: inventory.value.observation,
    });
    assert.equal(lineage.ok, true);
    if (!lineage.ok) {
      throw new Error(lineage.error.detail);
    }
    assert.equal(lineage.value.relation, 'STORES');
    const disguised = evaluateAgricultureAdversary('INVENTORY_AS_HARVEST', NOW);
    assert.equal(disguised.ok, true);
  });

  it('16. does not infer operator as legal owner', () => {
    const farm = ingestAgricultureRecord(farmSystemRecord(NOW), NOW);
    const water = ingestWaterRecord(treatmentMeterRecord(NOW), NOW);
    assert.equal(farm.ok && water.ok, true);
    if (!farm.ok || !water.ok) {
      throw new Error('ingest failed');
    }
    assert.equal(farm.value.observation.legalOwnershipInferred, false);
    assert.equal(water.value.observation.legalOwnershipInferred, false);
    assert.equal(LEGAL_OWNERSHIP_INFERRED, false);
    assert.equal(inferLegalOwnerFromOperator(farm.value.observation.parties).ok, false);
    assert.equal(inferWaterLegalOwnerFromOperator(water.value.observation.parties).ok, false);
  });

  it('17. preserves rights references', () => {
    const harvestRights = evaluateHarvestRights(farmSystemRecord(NOW), simulationAgriculturePolicy());
    assert.equal(harvestRights.ok, true);
    if (!harvestRights.ok) {
      throw new Error(harvestRights.error.detail);
    }
    assert.equal(harvestRights.value[0]?.fixtureOnly, true);
    assert.equal(harvestRights.value[0]?.provesRealAuthorization, false);
    const waterRights = evaluateWaterRights(wellRecord(NOW), simulationWaterPolicy());
    assert.equal(waterRights.ok, true);
    if (!waterRights.ok) {
      throw new Error(waterRights.error.detail);
    }
    assert.equal(waterRights.value[0]?.waterRightReference, 'water.right.sim.1');
    assert.equal(evaluateAgricultureAdversary('MISSING_RIGHTS', NOW).ok, true);
    assert.equal(evaluateWaterAdversary('MISSING_RIGHTS', NOW).ok, true);
  });

  it('18. rejects same-controller fake quorum', () => {
    assert.equal(evaluateAgricultureAdversary('SAME_CONTROLLER_FAKE_QUORUM', NOW).ok, true);
    assert.equal(evaluateWaterAdversary('SAME_CONTROLLER_FAKE_QUORUM', NOW).ok, true);
    assert.equal(
      classifyAgricultureIndependence({
        sourceClass: 'GRAIN_SCALE',
        controllerId: 'farm-controller',
        upstreamOrganizationId: 'farm-org',
        sharedControlGroup: 'farm-control-group',
        related: [{ controllerId: 'farm-controller', upstreamOrganizationId: 'farm-org', sharedControlGroup: 'farm-control-group' }],
      }),
      'SAME_CONTROLLER',
    );
    assert.equal(
      classifyWaterIndependence({
        sourceClass: 'INDEPENDENT_WATER_AUDITOR',
        controllerId: 'auditor-controller',
        upstreamOrganizationId: 'auditor-org',
        sharedControlGroup: null,
        related: [{ controllerId: 'utility-controller', upstreamOrganizationId: 'utility-org', sharedControlGroup: 'utility-control-group' }],
      }),
      'INDEPENDENT_ORGANIZATION',
    );
  });

  it('19. quality evidence does not change physical quantity', () => {
    const harvest = ingestAgricultureRecord(farmSystemRecord(NOW), NOW);
    assert.equal(harvest.ok, true);
    if (!harvest.ok) {
      throw new Error(harvest.error.detail);
    }
    assert.equal(qualityDoesNotChangePhysicalQuantity(), false);
    assert.equal(
      qualityLeavesQuantityUnchanged(harvest.value.observation.sourceQuantity, harvest.value.observation.sourceQuantity),
      true,
    );
    assert.equal(harvest.value.observation.qualityEvidence?.changesPhysicalQuantity, false);
    const water = ingestWaterRecord(treatmentMeterRecord(NOW), NOW);
    assert.equal(water.ok, true);
    if (!water.ok) {
      throw new Error(water.error.detail);
    }
    assert.equal(waterQualityDoesNotChangePhysicalQuantity(), false);
    assert.equal(
      waterQualityLeavesQuantityUnchanged(water.value.observation.canonicalQuantity, water.value.observation.canonicalQuantity),
      true,
    );
    assert.equal(water.value.observation.qualityEvidence?.createsOutput, false);
  });

  it('20. makes no real external calls', () => {
    const transport = new FakeExternalHttpTransport();
    assert.equal(transport.contactsPublicInternet, false);
    assert.equal(agricultureRealProviderContacted(), false);
    assert.equal(waterRealProviderContacted(), false);
    assert.equal(liveMainnetConnectivityEnabled(), false);
    assert.equal(evaluateAgricultureAdversary('FLOAT_QUANTITY', NOW).ok, true);
    assert.equal(evaluateAgricultureAdversary('SCHEMA_DRIFT', NOW).ok, true);
    assert.equal(evaluateAgricultureAdversary('CREDENTIAL_LEAK', NOW).ok, true);
    assert.equal(evaluateAgricultureAdversary('STALE_METER', NOW).ok, true);
    assert.equal(evaluateAgricultureAdversary('WRONG_UNITS', NOW).ok, true);
    assert.equal(evaluateWaterAdversary('FLOAT_QUANTITY', NOW).ok, true);
    assert.equal(evaluateWaterAdversary('SCHEMA_DRIFT', NOW).ok, true);
    assert.equal(evaluateWaterAdversary('CREDENTIAL_LEAK', NOW).ok, true);
    assert.equal(evaluateWaterAdversary('STALE_METER', NOW).ok, true);
    assert.equal(evaluateWaterAdversary('WRONG_UNITS', NOW).ok, true);
    assert.equal(evaluateWaterAdversary('COUNTER_RESET', NOW).ok, true);
  });

  it('21. agricultural fact does not auto-mint', () => {
    const ingested = ingestAgricultureRecord(farmSystemRecord(NOW), NOW);
    assert.equal(ingested.ok, true);
    if (!ingested.ok) {
      throw new Error(ingested.error.detail);
    }
    assert.equal(ingested.value.evidence.issued, false);
    assert.equal(ingested.value.observation.canMintMoonRey, false);
    assert.equal(agricultureFactCannotAutoMint(), false);
    const path = evaluateAgricultureClaimPath({ factType: 'AGRICULTURAL_OUTPUT', claimType: 'OUTPUT' });
    assert.equal(path.ok, true);
    if (path.ok) {
      assert.equal(path.value.canMint, false);
    }
    const food = mappingById('spm.food_agriculture.FOOD_PRODUCTION.FOOD_AGRICULTURE', 1);
    assert.ok(food);
    const mapped = validateSourceFactClaimMapping({
      sourceCategory: 'food_agriculture',
      factType: 'FOOD_PRODUCTION',
      sourceUnit: 'kg',
      productiveCategory: 'FOOD_AGRICULTURE',
      claimType: 'OUTPUT',
    });
    assert.equal(mapped.ok, true);
    const certified = certifyAgricultureSandbox('valid_harvest_mass', NOW);
    assert.equal(certified.record.mintsMoonRey, false);
    assert.equal(certified.record.productionAuthorized, false);
    const projected = projectAgricultureMetadata(new EconomicAssetRegistry(), ingested.value.evidence);
    assert.equal(projected.ok, true);
  });

  it('22. water fact does not auto-mint', () => {
    const ingested = ingestWaterRecord(treatmentMeterRecord(NOW), NOW);
    assert.equal(ingested.ok, true);
    if (!ingested.ok) {
      throw new Error(ingested.error.detail);
    }
    assert.equal(ingested.value.evidence.issued, false);
    assert.equal(ingested.value.observation.canMintMoonRey, false);
    assert.equal(waterFactCannotAutoMint(), false);
    assert.equal(waterProductionIsActive(), false);
    assert.equal(agricultureProductionIsActive(), false);
    const path = evaluateWaterClaimPath({ factType: 'WATER_PRODUCTION', claimType: 'OUTPUT' });
    assert.equal(path.ok, true);
    if (path.ok) {
      assert.equal(path.value.canMint, false);
    }
    const events = identifyWaterProductionEvents([ingested.value.observation], NOW, NOW + 3_600n);
    assert.equal(events.ok, true);
    if (events.ok) {
      assert.equal(events.value.length, 1);
    }
    const certified = certifyWaterSandbox('valid_treatment_production', NOW);
    assert.equal(certified.record.mintsMoonRey, false);
    assert.equal(certified.record.productionAuthorized, false);
    const projected = projectWaterMetadata(new EconomicAssetRegistry(), ingested.value.evidence);
    assert.equal(projected.ok, true);
    const harvest = ingestAgricultureRecord(farmSystemRecord(NOW), NOW);
    const irrigation = ingestWaterRecord(irrigationConsumptionRecord(NOW), NOW);
    assert.equal(harvest.ok && irrigation.ok, true);
    if (harvest.ok && irrigation.ok) {
      const linked = linkIrrigationToHarvest({
        irrigationObservationId: irrigation.value.observation.observationId,
        harvest: harvest.value.observation,
      });
      assert.equal(linked.ok, true);
    }
  });

  it('prints the demo authority boundary', () => {
    const demo = runAgricultureWaterDataFabricDemo();
    assert.equal(demo.harvestEventCount, 1);
    assert.equal(demo.waterProductionObserved, true);
    assert.equal(demo.irrigationLinked, true);
    assert.equal(demo.flags.PLANTED_AREA_EQUALS_OUTPUT, false);
    assert.equal(demo.flags.FORECAST_YIELD_EQUALS_OUTPUT, false);
    assert.equal(demo.flags.WATER_AVAILABILITY_EQUALS_PRODUCTION, false);
    assert.equal(demo.flags.IRRIGATION_CONSUMPTION_EQUALS_WATER_PRODUCTION, false);
    assert.equal(demo.flags.REAL_PROVIDER_CONTACTED, false);
    assert.equal(demo.flags.PRODUCTION_ACTIVE, false);
  });
});
