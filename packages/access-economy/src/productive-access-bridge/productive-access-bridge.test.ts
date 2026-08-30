import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ProductiveAccessBridge,
  checkProductiveAccessInvariants,
  runAutonomousFleetBridgeDemo,
  vehicleDaysToHours,
  FIXTURE_AUTONOMOUS_VEHICLE_FLEET,
  FIXTURE_SOLAR_KWH,
  PRODUCTIVE_ACCESS_BRIDGE_INVARIANT_IDS,
} from './index.ts';

describe('ACCESS-19 AccessCapacityCommitment', () => {
  it('commits capacity bounded by verified available quantity', () => {
    const bridge = new ProductiveAccessBridge();
    bridge.registerVerifiedCapacity(FIXTURE_SOLAR_KWH);
    const committed = bridge.commitCapacity({
      commitmentId: 'commit.solar',
      providerRef: FIXTURE_SOLAR_KWH.providerRef,
      productiveObjectRef: FIXTURE_SOLAR_KWH.productiveObjectRef,
      category: FIXTURE_SOLAR_KWH.category,
      canonicalUnit: FIXTURE_SOLAR_KWH.canonicalUnit,
      quantity: 5_000n,
      availabilityWindow: FIXTURE_SOLAR_KWH.availabilityWindow,
      geography: FIXTURE_SOLAR_KWH.geography,
      qualityClass: FIXTURE_SOLAR_KWH.qualityClass,
      settlementTerms: Object.freeze({
        kind: 'FIAT',
        currency: 'USD',
        fiatMinorUnits: 1_000n,
        sunreyMinorUnits: 0n,
        moonreyMinorUnits: 0n,
        contractRef: 'contract.solar',
      }),
      evidenceRefs: Object.freeze(['evidence.solar']),
      oracleRefs: Object.freeze(['oracle.solar']),
      expiration: FIXTURE_SOLAR_KWH.availabilityWindow.validUntil,
      revocationPolicy: Object.freeze({
        cancellableByProvider: true,
        cancellableByPlatform: false,
        refundOnRevocation: true,
        noticePeriodSeconds: 3600n,
      }),
      verifiedContributionRef: FIXTURE_SOLAR_KWH.contributionFingerprint,
      createdAt: FIXTURE_SOLAR_KWH.observedAt,
    });
    assert.equal(committed.ok, true);
    const over = bridge.commitCapacity({
      ...committed.ok ? {
        commitmentId: 'commit.solar.over',
        providerRef: FIXTURE_SOLAR_KWH.providerRef,
        productiveObjectRef: FIXTURE_SOLAR_KWH.productiveObjectRef,
        category: FIXTURE_SOLAR_KWH.category,
        canonicalUnit: FIXTURE_SOLAR_KWH.canonicalUnit,
        quantity: 50_000n,
        availabilityWindow: FIXTURE_SOLAR_KWH.availabilityWindow,
        geography: FIXTURE_SOLAR_KWH.geography,
        qualityClass: FIXTURE_SOLAR_KWH.qualityClass,
        settlementTerms: Object.freeze({
          kind: 'FIAT',
          currency: 'USD',
          fiatMinorUnits: 0n,
          sunreyMinorUnits: 0n,
          moonreyMinorUnits: 0n,
          contractRef: 'contract.solar.over',
        }),
        evidenceRefs: Object.freeze(['evidence.solar']),
        oracleRefs: Object.freeze(['oracle.solar']),
        expiration: FIXTURE_SOLAR_KWH.availabilityWindow.validUntil,
        revocationPolicy: Object.freeze({
          cancellableByProvider: true,
          cancellableByPlatform: false,
          refundOnRevocation: false,
          noticePeriodSeconds: 0n,
        }),
        verifiedContributionRef: FIXTURE_SOLAR_KWH.contributionFingerprint,
        createdAt: FIXTURE_SOLAR_KWH.observedAt,
      } : ({} as never),
    });
    assert.equal(over.ok, false);
    if (!over.ok) {
      assert.equal(over.failure.code, 'EXCEEDS_VERIFIED_CAPACITY');
    }
  });

  it('rejects oracle-only commitment without evidence or contribution', () => {
    const bridge = new ProductiveAccessBridge();
    bridge.registerVerifiedCapacity(FIXTURE_SOLAR_KWH);
    const result = bridge.commitCapacity({
      commitmentId: 'commit.oracle.only',
      providerRef: FIXTURE_SOLAR_KWH.providerRef,
      productiveObjectRef: FIXTURE_SOLAR_KWH.productiveObjectRef,
      category: FIXTURE_SOLAR_KWH.category,
      canonicalUnit: FIXTURE_SOLAR_KWH.canonicalUnit,
      quantity: 100n,
      availabilityWindow: FIXTURE_SOLAR_KWH.availabilityWindow,
      geography: FIXTURE_SOLAR_KWH.geography,
      qualityClass: FIXTURE_SOLAR_KWH.qualityClass,
      settlementTerms: Object.freeze({
        kind: 'FIAT',
        currency: 'USD',
        fiatMinorUnits: 0n,
        sunreyMinorUnits: 0n,
        moonreyMinorUnits: 0n,
        contractRef: 'contract.oracle',
      }),
      evidenceRefs: Object.freeze([]),
      oracleRefs: Object.freeze(['oracle.only']),
      expiration: FIXTURE_SOLAR_KWH.availabilityWindow.validUntil,
      revocationPolicy: Object.freeze({
        cancellableByProvider: false,
        cancellableByPlatform: false,
        refundOnRevocation: false,
        noticePeriodSeconds: 0n,
      }),
      verifiedContributionRef: null,
      createdAt: FIXTURE_SOLAR_KWH.observedAt,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure.code, 'ORACLE_FACT_ALONE_INSUFFICIENT');
    }
  });
});

describe('ACCESS-19 autonomous fleet demo', () => {
  it('reconciles 100k verified, 10k committed, 4 vehicle-days consumed', () => {
    const bridge = new ProductiveAccessBridge();
    const result = runAutonomousFleetBridgeDemo({
      bridge,
      verifiedCapacity: FIXTURE_AUTONOMOUS_VEHICLE_FLEET,
      moonreyBefore: 0n,
      moonreyAfter: 1_250n,
      moonreyIssuance: Object.freeze({
        issuanceId: 'issuance.fleet',
        contributionFingerprint: FIXTURE_AUTONOMOUS_VEHICLE_FLEET.contributionFingerprint!,
        moonreyQuantity: 1_250n,
        issuedAt: FIXTURE_AUTONOMOUS_VEHICLE_FLEET.observedAt,
        triggeredByAccess: false,
      }),
    });

    assert.equal(result.totalVerifiedVehicleHours, 100_000n);
    assert.equal(result.committedVehicleHours, 10_000n);
    assert.equal(result.consumedVehicleDays, 4n);
    assert.equal(result.consumedVehicleHours, vehicleDaysToHours(4n));
    assert.equal(result.remainingVerifiedVehicleHours, 90_000n);
    assert.equal(result.remainingPoolVehicleHours, 10_000n - vehicleDaysToHours(4n));
    assert.equal(result.moonreyIssuedByAccess, 0n);
    assert.equal(result.reconciliation.reconciled, true);
    assert.equal(result.invariantsHeld, true);
    assert.equal(result.providerSettlement.moonreyIssuanceRef, null);
  });
});

describe('ACCESS-19 permanent invariants', () => {
  it('declares all eight bridge invariants', () => {
    assert.equal(PRODUCTIVE_ACCESS_BRIDGE_INVARIANT_IDS.length, 8);
    const bridge = new ProductiveAccessBridge();
    bridge.registerVerifiedCapacity(FIXTURE_AUTONOMOUS_VEHICLE_FLEET);
    runAutonomousFleetBridgeDemo({
      bridge,
      verifiedCapacity: FIXTURE_AUTONOMOUS_VEHICLE_FLEET,
      moonreyBefore: 0n,
      moonreyAfter: 1n,
      moonreyIssuance: Object.freeze({
        issuanceId: 'issuance.test',
        contributionFingerprint: 'fp.test',
        moonreyQuantity: 1n,
        issuedAt: FIXTURE_AUTONOMOUS_VEHICLE_FLEET.observedAt,
        triggeredByAccess: false,
      }),
    });
    const invariants = bridge.checkInvariants();
    assert.equal(invariants.length, 8);
    assert.equal(invariants.every((row) => row.held), true);
  });

  it('detects output/delivery double issuance via invariant input', () => {
    const invariants = checkProductiveAccessInvariants({
      verifiedCapacities: [FIXTURE_AUTONOMOUS_VEHICLE_FLEET],
      commitments: [],
      poolLedgers: [],
      deliveries: [],
      settlements: [],
      moonreyIssuances: [
        Object.freeze({
          issuanceId: 'a',
          contributionFingerprint: 'fp.output',
          moonreyQuantity: 100n,
          issuedAt: FIXTURE_AUTONOMOUS_VEHICLE_FLEET.observedAt,
          triggeredByAccess: false,
        }),
        Object.freeze({
          issuanceId: 'b',
          contributionFingerprint: 'fp.output',
          moonreyQuantity: 100n,
          issuedAt: FIXTURE_AUTONOMOUS_VEHICLE_FLEET.observedAt,
          triggeredByAccess: false,
        }),
      ],
      moonreyIssuedByAccess: 0n,
      outputDeliveryFingerprints: new Map([
        [FIXTURE_AUTONOMOUS_VEHICLE_FLEET.productiveObjectRef, Object.freeze(['fp.output', 'fp.delivery'])],
      ]),
    });
    const doubleIssuance = invariants.find((row) => row.invariant === 'NO_OUTPUT_DELIVERY_DOUBLE_ISSUANCE');
    assert.equal(doubleIssuance?.held, false);
  });
});
