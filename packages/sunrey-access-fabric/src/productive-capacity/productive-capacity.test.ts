import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PRODUCTIVE_SCHEMA_VERSION } from '../../../sunrey-chain/src/productive/types.ts';
import type { ProductiveClaim } from '../../../sunrey-chain/src/productive/claims.ts';
import type { ProductiveEconomicObject } from '../../../sunrey-chain/src/productive/objects.ts';
import {
  CanonicalProductiveCapacityAdapter,
  createProductiveCapacityDiscovery,
  createSimulationProductiveCapacityAdapter,
  FORD_MUSTANG_MIAMI_SLICE,
  GPU_COMPUTE_SLICE,
  HOTEL_TOKYO_OCTOBER_SLICE,
  SIMULATION_FIXTURE_PREFIX,
  SIMULATION_NOW_UNIX_SECONDS,
  validateSliceCapacity,
} from '../index.ts';

const DAY = 86_400n;

function discovery() {
  const port = createSimulationProductiveCapacityAdapter();
  return { port, service: createProductiveCapacityDiscovery(port) };
}

describe('ACCESS-03 productive capacity discovery', () => {
  it('filters passenger vehicle capacity in Miami for next week', () => {
    const { service } = discovery();
    const result = service.findAvailable({
      kind: 'AVAILABILITY',
      economicCategory: 'LOGISTICS_TRANSPORTATION',
      serviceQualityClass: 'PASSENGER_VEHICLE',
      geographyId: 'geo_sim_us_fl_miami',
      serviceLocation: 'Miami',
      windowStartUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + DAY,
      windowEndUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 8n * DAY,
      nowUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.ok(result.slices.length >= 1);
    assert.ok(result.slices.some((row) => row.sliceId === FORD_MUSTANG_MIAMI_SLICE.sliceId));
    assert.ok(result.slices.every((row) => row.availabilityAmount > 0n));
  });

  it('filters hotel room-night capacity in Tokyo for October', () => {
    const { service } = discovery();
    const result = service.findAvailable({
      kind: 'AVAILABILITY',
      economicCategory: 'REAL_ESTATE_USE',
      serviceQualityClass: 'HOTEL_ROOM_NIGHT',
      geographyId: 'geo_sim_jp_tokyo',
      serviceLocation: 'Tokyo',
      windowStartUnixSeconds: 1_759_392_000n,
      windowEndUnixSeconds: 1_761_984_000n,
      nowUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.slices.length, 1);
    assert.equal(result.slices[0]!.sliceId, HOTEL_TOKYO_OCTOBER_SLICE.sliceId);
  });

  it('filters food production and delivery capacity in a region', () => {
    const { service } = discovery();
    const result = service.findAvailable({
      kind: 'AVAILABILITY',
      economicCategory: 'FOOD_AGRICULTURE',
      serviceQualityClass: 'FOOD_DELIVERY',
      geographyId: 'geo_sim_us_fl_south',
      windowStartUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
      windowEndUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 30n * DAY,
      nowUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.slices.length, 1);
    assert.equal(result.slices[0]!.canonicalUnit, 'kg');
  });

  it('filters GPU-hour and robot-hour capacity', () => {
    const { service } = discovery();
    const gpu = service.findAvailable({
      kind: 'AVAILABILITY',
      economicCategory: 'COMPUTE',
      serviceQualityClass: 'GPU_A100',
      windowStartUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
      windowEndUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 7n * DAY,
      nowUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
    });
    assert.equal(gpu.ok, true);
    if (!gpu.ok) {
      return;
    }
    assert.ok(gpu.slices.some((row) => row.canonicalUnit === 'gpu_s'));

    const robot = service.findAvailable({
      kind: 'AVAILABILITY',
      economicCategory: 'MANUFACTURING',
      serviceQualityClass: 'ROBOT_INDUSTRIAL',
      windowStartUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
      windowEndUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 14n * DAY,
      nowUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
    });
    assert.equal(robot.ok, true);
    if (!robot.ok) {
      return;
    }
    assert.ok(robot.slices.some((row) => row.canonicalUnit === 'machine_h'));
  });

  it('filters energy capacity', () => {
    const { service } = discovery();
    const result = service.findAvailable({
      kind: 'AVAILABILITY',
      economicCategory: 'ENERGY',
      serviceQualityClass: 'ENERGY_GRID',
      windowStartUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
      windowEndUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 30n * DAY,
      nowUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.slices[0]!.canonicalUnit, 'kWh');
  });

  it('applies time-window filtering', () => {
    const { service } = discovery();
    const inside = service.findAvailable({
      kind: 'AVAILABILITY',
      serviceQualityClass: 'PASSENGER_VEHICLE',
      geographyId: 'geo_sim_us_fl_miami',
      windowStartUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + DAY,
      windowEndUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 2n * DAY,
      nowUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
    });
    const outside = service.findAvailable({
      kind: 'AVAILABILITY',
      serviceQualityClass: 'PASSENGER_VEHICLE',
      geographyId: 'geo_sim_us_fl_miami',
      windowStartUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 90n * DAY,
      windowEndUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 100n * DAY,
      nowUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
    });
    assert.equal(inside.ok, true);
    assert.equal(outside.ok, true);
    if (!inside.ok || !outside.ok) {
      return;
    }
    assert.ok(inside.slices.length > 0);
    assert.equal(outside.slices.length, 0);
  });

  it('excludes exhausted capacity from availability queries', () => {
    const { service } = discovery();
    const result = service.findAvailable({
      kind: 'AVAILABILITY',
      serviceQualityClass: 'PASSENGER_VEHICLE',
      geographyId: 'geo_sim_us_fl_miami',
      windowStartUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + DAY,
      windowEndUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 8n * DAY,
      nowUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.ok(result.slices.every((row) => row.availabilityAmount > 0n));
    assert.ok(!result.slices.some((row) => row.sliceId.includes('exhausted')));
  });

  it('rejects stale evidence when configured', () => {
    const { service } = discovery();
    const result = service.findAvailable({
      kind: 'AVAILABILITY',
      economicCategory: 'COMPUTE',
      windowStartUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
      windowEndUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 7n * DAY,
      nowUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
      rejectStaleEvidence: true,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.ok(!result.slices.some((row) => row.sliceId.includes('stale_evidence')));
  });

  it('enforces geographic constraints', () => {
    const { service } = discovery();
    const miami = service.findAvailable({
      kind: 'AVAILABILITY',
      geographyId: 'geo_sim_us_fl_miami',
      windowStartUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
      windowEndUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 30n * DAY,
      nowUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
    });
    const tokyo = service.findAvailable({
      kind: 'AVAILABILITY',
      geographyId: 'geo_sim_jp_tokyo',
      windowStartUnixSeconds: 1_759_392_000n,
      windowEndUnixSeconds: 1_761_984_000n,
      nowUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
    });
    assert.equal(miami.ok, true);
    assert.equal(tokyo.ok, true);
    if (!miami.ok || !tokyo.ok) {
      return;
    }
    assert.ok(miami.slices.every((row) => row.geography.geographyId.includes('miami') || row.geography.geographyId.includes('mia')));
    assert.ok(tokyo.slices.every((row) => row.geography.geographyId.includes('tokyo')));
  });

  it('enforces quality constraints', () => {
    const { service } = discovery();
    const premiumGpu = service.findAvailable({
      kind: 'AVAILABILITY',
      serviceQualityClass: 'GPU_A100',
      windowStartUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
      windowEndUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 7n * DAY,
      nowUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
    });
    const hotel = service.findAvailable({
      kind: 'AVAILABILITY',
      serviceQualityClass: 'HOTEL_ROOM_NIGHT',
      windowStartUnixSeconds: 1_759_392_000n,
      windowEndUnixSeconds: 1_761_984_000n,
      nowUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
    });
    assert.equal(premiumGpu.ok, true);
    assert.equal(hotel.ok, true);
    if (!premiumGpu.ok || !hotel.ok) {
      return;
    }
    assert.ok(premiumGpu.slices.every((row) => row.serviceQualityClass === 'GPU_A100'));
    assert.ok(hotel.slices.every((row) => row.serviceQualityClass === 'HOTEL_ROOM_NIGHT'));
  });

  it('requires source provenance and rejects marketing-only data', () => {
    const { service } = discovery();
    const result = service.findAvailable({
      kind: 'AVAILABILITY',
      serviceQualityClass: 'PASSENGER_VEHICLE',
      windowStartUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
      windowEndUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 30n * DAY,
      nowUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
      requireProvenance: true,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.ok(result.slices.every((row) => row.provenance.claimId || row.provenance.oracleFactId || row.provenance.objectId));
    assert.ok(!result.slices.some((row) => row.verificationStatus === 'MARKETING_UNPROVENANCED'));
  });

  it('rejects zero and negative capacity slices', () => {
    assert.equal(validateSliceCapacity({ ...GPU_COMPUTE_SLICE, capacityAmount: 0n, availabilityAmount: 0n }).ok, false);
    assert.equal(validateSliceCapacity({ ...GPU_COMPUTE_SLICE, capacityAmount: -1n }).ok, false);
    assert.equal(validateSliceCapacity({ ...GPU_COMPUTE_SLICE, availabilityAmount: -1n }).ok, false);
    assert.equal(validateSliceCapacity(GPU_COMPUTE_SLICE).ok, true);
  });

  it('does not create capacity when querying', () => {
    const port = createSimulationProductiveCapacityAdapter();
    const service = createProductiveCapacityDiscovery(port);
    const before = port.fixtureCount();
    for (let index = 0; index < 5; index += 1) {
      service.findAvailable({
        kind: 'AVAILABILITY',
        windowStartUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
        windowEndUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 30n * DAY,
        nowUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
      });
    }
    assert.equal(port.fixtureCount(), before);
    assert.equal(port.snapshot().sliceCount, before);
  });

  it('queries utilization with independently evidenced basis', () => {
    const { service } = discovery();
    const result = service.queryUtilization({
      productiveObjectRef: GPU_COMPUTE_SLICE.productiveObjectRef,
      measurementPeriod: {
        validFromUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
        validUntilUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + DAY,
        epoch: 1,
      },
      nowUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.utilization.independentlyEvidenced, true);
    assert.ok(result.utilization.basisAmount > 0n);
  });

  it('projects canonical productive registry through bridge adapter without owning truth', () => {
    const object: ProductiveEconomicObject = {
      schemaVersion: PRODUCTIVE_SCHEMA_VERSION,
      objectId: 'obj_canonical_vehicle',
      category: 'LOGISTICS_TRANSPORTATION',
      owner: 'owner_sim',
      controller: 'controller_sim',
      operator: 'operator_sim',
      geography: { geographyId: 'geo_sim_us_fl_miami', jurisdiction: 'US-FL' },
      rightsReference: 'rights_sim',
      oracleFeedReferences: ['feed_sim'],
      unitSchema: 'service_hour',
      capacityMetadata: { qualityClass: 'PASSENGER_VEHICLE', location: 'Miami, FL, US' },
      provenance: 'prov_sim',
      status: 'ACTIVE',
      activationHeight: 1,
      expirationHeight: null,
      validFromUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
      validUntilUnixSeconds: null,
    };
    const claim: ProductiveClaim = {
      schemaVersion: PRODUCTIVE_SCHEMA_VERSION,
      claimId: 'claim_canonical_vehicle',
      objectId: object.objectId,
      claimType: 'CAPACITY',
      category: 'LOGISTICS_TRANSPORTATION',
      quantity: 8n,
      unit: 'service_hour',
      measurementPeriod: {
        validFromUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + DAY,
        validUntilUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 8n * DAY,
        epoch: 1,
      },
      geography: object.geography,
      oracleFactIds: [],
      rightsReferences: ['rights_sim'],
      controller: object.controller,
      proofReferences: [],
      status: 'VERIFIED',
      upstreamContributionIds: [],
    };
    const adapter = new CanonicalProductiveCapacityAdapter(
      { objects: [object], claims: [claim], facts: [] },
      SIMULATION_NOW_UNIX_SECONDS,
    );
    const service = createProductiveCapacityDiscovery(adapter);
    const result = service.findAvailable({
      kind: 'AVAILABILITY',
      serviceQualityClass: 'PASSENGER_VEHICLE',
      geographyId: 'geo_sim_us_fl_miami',
      windowStartUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + DAY,
      windowEndUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 8n * DAY,
      nowUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.slices.length, 1);
    assert.equal(result.slices[0]!.provenance.sourceClass, 'CANONICAL_PRODUCTIVE_REGISTRY');
    assert.equal(result.slices[0]!.provenance.claimId, claim.claimId);
  });

  it('marks simulation fixtures unmistakably', () => {
    const port = createSimulationProductiveCapacityAdapter();
    const snapshot = port.snapshot();
    assert.equal(snapshot.sourceClass, 'SIMULATION_FIXTURE');
    const { service } = discovery();
    const result = service.findAvailable({
      kind: 'AVAILABILITY',
      windowStartUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
      windowEndUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 30n * DAY,
      nowUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.ok(result.slices.every((row) => row.sliceId.startsWith(SIMULATION_FIXTURE_PREFIX)));
  });
});
