import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { liveMainnetConnectivityEnabled } from './oracle/production/runtime-types.ts';
import { mappingById } from './oracle/source-taxonomy/registry.ts';
import { FACT_SCHEMAS } from './oracle/schemas.ts';
import { UNIT_CODES } from './oracle/types.ts';
import { capacityClaimAutomaticallyIssues } from './productive/source-taxonomy/index.ts';
import {
  accessControlRecord,
  bookingSystemRecord,
  capacityCannotAutomaticallyProduceGpuv,
  capacityCannotBecomeUsage,
  capacityEqualsRealizedUse,
  certifyRealEstateSandbox,
  classifyRealEstateIndependence,
  deriveAreaTime,
  evaluateRealEstateAdversary,
  evaluateRealEstateClaimPath,
  evaluateUtilization,
  identifySpaceUseEvents,
  inferOwnerFromOperator,
  ingestRealEstateRecord,
  mapRealEstateRecordToEconomicAsset,
  ingestRealEstateRecords,
  occupiedSpaceRecord,
  propertyOwnershipEqualsProductiveUse,
  realEstateCertificationCannotAuthorizeMoonRey,
  realEstateFactCannotAutoMint,
  realEstateProductionIsActive,
  realEstateRealProviderContacted,
  realEstateRecord,
  refuseDuplicateBuildingUsage,
  refuseM2AsUsageWithoutDuration,
  refusePersonLevelData,
  runRealEstateInfrastructureDataFabricDemo,
  separatePartyRoles,
  simulationPolicy,
  vacantCapacityRecord,
  vacancyEqualsProductiveUse,
} from './oracle/production/provider-families/real-estate/index.ts';

const NOW = 1_700_000_000n;

describe('CHUNK-135 real-estate use data fabric', () => {
  it('1. accepts real-estate capacity as m2', () => {
    const ingested = ingestRealEstateRecord(vacantCapacityRecord(NOW), NOW);
    assert.equal(ingested.ok, true);
    if (!ingested.ok) {
      throw new Error(ingested.error.detail);
    }
    assert.equal(ingested.value.observation.factType, 'REAL_ESTATE_USE_CAPACITY');
    assert.equal(ingested.value.observation.canonicalUnit, 'm2');
    assert.equal(ingested.value.observation.canCreateUsageClaim, false);
  });

  it('2. derives realized m2-time usage exactly', () => {
    const ingested = ingestRealEstateRecord(occupiedSpaceRecord(NOW), NOW);
    assert.equal(ingested.ok, true);
    if (!ingested.ok) {
      throw new Error(ingested.error.detail);
    }
    assert.equal(ingested.value.observation.factType, 'REAL_ESTATE_USAGE');
    assert.equal(ingested.value.observation.canonicalUnit, 'm2_hour');
    assert.equal(ingested.value.observation.canonicalQuantity.mantissa, 400n);
    const derived = deriveAreaTime({ areaMantissa: 100n, durationSeconds: 14_400n });
    assert.equal(derived.ok, true);
    if (derived.ok) {
      assert.equal(derived.value.mantissa, 400n);
      assert.equal(derived.value.unitId, 'm2_hour');
    }
  });

  it('3. refuses m2 without duration as usage quantity', () => {
    const refused = refuseM2AsUsageWithoutDuration();
    assert.equal(refused.ok, false);
    const ingested = ingestRealEstateRecord(
      realEstateRecord({ factType: 'REAL_ESTATE_USAGE', unit: 'm2', numericValue: '100' }),
      NOW,
    );
    assert.equal(ingested.ok, false);
    if (!ingested.ok) {
      assert.equal(ingested.error.code, 'M2_WITHOUT_DURATION');
    }
  });

  it('4. does not treat vacancy as usage', () => {
    const vacant = ingestRealEstateRecord(vacantCapacityRecord(NOW), NOW);
    assert.equal(vacant.ok, true);
    if (vacant.ok) {
      assert.equal(vacant.value.observation.createsUsageEvent, false);
    }
    assert.equal(vacancyEqualsProductiveUse(), false);
    const disguised = ingestRealEstateRecord(realEstateRecord({ usageState: 'VACANT' }), NOW);
    assert.equal(disguised.ok, false);
  });

  it('5. does not treat listing or appraisal as usage', () => {
    const listing = evaluateRealEstateAdversary('LISTING_AS_PRODUCTIVITY', NOW);
    assert.equal(listing.ok, true);
    const appraisal = ingestRealEstateRecord(realEstateRecord({ usageState: 'APPRAISED' }), NOW);
    assert.equal(appraisal.ok, false);
    if (!appraisal.ok) {
      assert.equal(appraisal.error.code, 'APPRAISAL_IS_NOT_USAGE');
    }
  });

  it('6. keeps owner, operator, and use-right holder distinct', () => {
    const ingested = ingestRealEstateRecord(occupiedSpaceRecord(NOW), NOW);
    assert.equal(ingested.ok, true);
    if (!ingested.ok) {
      throw new Error(ingested.error.detail);
    }
    const roles = separatePartyRoles(ingested.value.observation.parties);
    assert.equal(roles.ownerIds.includes('party.owner'), true);
    assert.equal(roles.operatorIds.includes('party.operator'), true);
    assert.equal(roles.ownerIds.includes('party.operator'), false);
    assert.equal(inferOwnerFromOperator(ingested.value.observation.parties).ok, false);
    assert.equal(propertyOwnershipEqualsProductiveUse(), false);
    const owned = evaluateRealEstateAdversary('OWNERSHIP_AS_USAGE', NOW);
    assert.equal(owned.ok, true);
  });

  it('7. maps REAL_ESTATE_USAGE without rewriting capacity history', () => {
    assert.equal(UNIT_CODES.includes('m2_hour'), true);
    assert.deepEqual(FACT_SCHEMAS.REAL_ESTATE_USAGE.allowedUnits, ['m2_hour']);
    assert.deepEqual(FACT_SCHEMAS.REAL_ESTATE_USE_CAPACITY.allowedUnits, ['m2']);
    const historical = mappingById('spm.real_estate_use.REAL_ESTATE_USE_CAPACITY.REAL_ESTATE_USE', 1);
    assert.ok(historical);
    assert.equal(historical.status, 'SUPERSEDED');
    assert.deepEqual(historical.allowedClaimTypes, ['CAPACITY', 'USAGE']);
    const current = mappingById('spm.real_estate_use.REAL_ESTATE_USE_CAPACITY.REAL_ESTATE_USE', 2);
    assert.ok(current);
    assert.deepEqual(current.allowedClaimTypes, ['CAPACITY']);
    const usage = mappingById('spm.real_estate_use.REAL_ESTATE_USAGE.REAL_ESTATE_USE', 1);
    assert.ok(usage);
    assert.deepEqual(usage.allowedClaimTypes, ['USAGE']);
  });

  it('14. validates utilization denominators', () => {
    const usage = ingestRealEstateRecord(occupiedSpaceRecord(NOW), NOW);
    const capacity = ingestRealEstateRecord(vacantCapacityRecord(NOW), NOW);
    assert.equal(usage.ok && capacity.ok, true);
    if (!usage.ok || !capacity.ok) {
      throw new Error('ingest failed');
    }
    const utilization = evaluateUtilization({
      actual: usage.value.observation,
      capacity: capacity.value.observation,
    });
    assert.equal(utilization.ok, true);
    if (utilization.ok) {
      assert.equal(utilization.value.inventedDenominator, false);
    }
  });

  it('15. excludes person-level occupancy data', () => {
    const leaked = refusePersonLevelData(
      realEstateRecord({ extras: { tenantName: 'A. Tenant', roomAccessLog: 'badge-1' } }),
    );
    assert.equal(leaked.ok, false);
    const adversary = evaluateRealEstateAdversary('PERSON_LEVEL_ACCESS_LOG', NOW);
    assert.equal(adversary.ok, true);
  });

  it('16. refuses same-controller fake quorum', () => {
    const fake = evaluateRealEstateAdversary('SAME_CONTROLLER_FAKE_QUORUM', NOW);
    assert.equal(fake.ok, true);
    const same = classifyRealEstateIndependence({
      sourceClass: 'INDEPENDENT_OCCUPANCY_ATTESTATION',
      controllerId: 'building-controller',
      upstreamOrganizationId: 'manager-org',
      related: [{ controllerId: 'building-controller', upstreamOrganizationId: 'manager-org' }],
    });
    assert.equal(same, 'SAME_CONTROLLER');
  });

  it('17-20. stays simulation-only and cannot mint or produce GPUV from capacity', () => {
    assert.equal(realEstateRealProviderContacted(), false);
    assert.equal(liveMainnetConnectivityEnabled(), false);
    assert.equal(realEstateFactCannotAutoMint(), false);
    assert.equal(realEstateProductionIsActive(), false);
    assert.equal(capacityCannotAutomaticallyProduceGpuv(), false);
    assert.equal(capacityEqualsRealizedUse(), false);
    assert.equal(capacityClaimAutomaticallyIssues(), false);
    const gpuv = evaluateRealEstateClaimPath({ factType: 'REAL_ESTATE_USE_CAPACITY', claimType: 'OUTPUT' });
    assert.equal(gpuv.ok, false);
    const certified = certifyRealEstateSandbox('valid_realized_area_time', NOW);
    assert.equal(certified.record.productionAuthorized, false);
    assert.equal(certified.record.mintsMoonRey, false);
    assert.equal(realEstateCertificationCannotAuthorizeMoonRey(), false);
    assert.equal(evaluateRealEstateAdversary('CAPACITY_AS_USAGE', NOW).ok, true);
    assert.equal(evaluateRealEstateAdversary('FLOAT_DURATION', NOW).ok, true);
    assert.equal(evaluateRealEstateAdversary('SCHEMA_DRIFT', NOW).ok, true);
    assert.equal(evaluateRealEstateAdversary('WRONG_UNIT', NOW).ok, true);
    assert.equal(evaluateRealEstateAdversary('STALE_UTILIZATION', NOW).ok, true);
    assert.equal(evaluateRealEstateAdversary('DUPLICATE_BUILDING_USAGE', NOW).ok, true);
    assert.equal(evaluateRealEstateAdversary('M2_AS_M2_HOUR_WITHOUT_DURATION', NOW).ok, true);
    assert.equal(capacityCannotBecomeUsage(realEstateRecord({ factType: 'REAL_ESTATE_USE_CAPACITY', usageState: 'OCCUPIED' })).ok, false);
  });

  it('clusters booking and access-control as one occupancy event', () => {
    const batch = ingestRealEstateRecords([bookingSystemRecord(NOW), accessControlRecord(NOW)], NOW);
    assert.equal(batch.ok, true);
    if (!batch.ok) {
      throw new Error(batch.error.detail);
    }
    const events = identifySpaceUseEvents(batch.value.map((row) => row.observation));
    assert.equal(events.ok, true);
    if (events.ok) {
      assert.equal(events.value.length, 1);
      assert.equal(refuseDuplicateBuildingUsage(events.value, 2).ok, false);
    }
  });

  it('projects only privacy-safe economic-asset metadata', () => {
    const ingested = ingestRealEstateRecord(occupiedSpaceRecord(NOW), NOW);
    assert.equal(ingested.ok, true);
    if (!ingested.ok) {
      throw new Error(ingested.error.detail);
    }
    const projected = mapRealEstateRecordToEconomicAsset(ingested.value.evidence);
    assert.equal(projected.ok, true);
    if (projected.ok) {
      const encoded = JSON.stringify(projected.value).toLowerCase();
      assert.equal(encoded.includes('tenant'), false);
      assert.equal(encoded.includes('badge'), false);
      assert.equal(encoded.includes('lease document'), false);
    }
  });

  it('prints the demo authority boundary', () => {
    const demo = runRealEstateInfrastructureDataFabricDemo();
    assert.equal(demo.areaTimeMantissa, '400');
    assert.equal(demo.facilityTimeMantissa, '6');
    assert.equal(demo.flags.PROPERTY_OWNERSHIP_EQUALS_PRODUCTIVE_USE, false);
    assert.equal(demo.flags.VACANCY_EQUALS_PRODUCTIVE_USE, false);
    assert.equal(demo.flags.CAPACITY_EQUALS_REALIZED_USE, false);
    assert.equal(demo.flags.LEGACY_MACHINE_H_REINTERPRETED, false);
    assert.equal(demo.flags.REAL_PROVIDER_CONTACTED, false);
    assert.equal(demo.flags.PRODUCTION_ACTIVE, false);
  });
});
