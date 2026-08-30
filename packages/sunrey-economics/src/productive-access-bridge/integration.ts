/**
 * ACCESS-19 — Productive engine integration for the Access bridge.
 *
 * Wires canonical Chunk 44 productive verification and MoonRey issuance
 * to AccessCapacityCommitment without conflating issuance with settlement.
 */

import {
  ProductiveAccessBridge,
  runAutonomousFleetBridgeDemo,
  type MoonReyIssuanceObservation,
  type VerifiedAvailableCapacity,
} from '../../../access-economy/src/productive-access-bridge/index.ts';
import { ProductiveEconomyEngine } from '../../../sunrey-chain/src/productive/engine.ts';
import {
  DEV_CLOCK,
  fixtureClaim,
  fixtureFacts,
  fixtureObject,
  fixtureRight,
} from '../../../sunrey-chain/src/productive/fixtures.ts';

const NOW = '2026-08-30T00:00:00.000Z' as const;
const UNTIL = '2026-12-31T23:59:59.000Z' as const;

export type ProductiveAccessIntegrationResult = {
  readonly bridge: ProductiveAccessBridge;
  readonly engine: ProductiveEconomyEngine;
  readonly fleetDemo: ReturnType<typeof runAutonomousFleetBridgeDemo>;
  readonly capacityExpansionDemonstrated: boolean;
  readonly moonreySupplyBeforeAccess: bigint;
  readonly moonreySupplyAfterAccess: bigint;
};

function autonomousVehicleFleetObject() {
  return fixtureObject({
    objectId: 'object.vehicle.fleet.001',
    category: 'SERVICES',
    unitSchema: 'service_hour',
    owner: 'provider.mobility.autonomous',
  });
}

export function buildAutonomousFleetProductiveEngine(): ProductiveEconomyEngine {
  const engine = new ProductiveEconomyEngine(DEV_CLOCK);
  const object = autonomousVehicleFleetObject();
  engine.registerObject(object);
  engine.putRight(
    fixtureRight({
      rightId: object.rightsReference,
      objectId: object.objectId,
      holderId: object.controller,
    }),
  );
  for (const fact of fixtureFacts({
    objectId: object.objectId,
    category: 'SERVICES',
    quantity: 100_000n,
    unit: 'service_hour',
  })) {
    engine.putOracleFact(fact);
  }
  const capacityClaim = fixtureClaim({
    claimId: 'claim.fleet.capacity',
    objectId: object.objectId,
    claimType: 'CAPACITY',
    category: 'SERVICES',
    quantity: 100_000n,
    unit: 'service_hour',
  });
  const outputClaim = fixtureClaim({
    claimId: 'claim.fleet.output',
    objectId: object.objectId,
    claimType: 'OUTPUT',
    category: 'SERVICES',
    quantity: 12_000n,
    unit: 'service_hour',
  });
  engine.submitClaim(capacityClaim);
  engine.submitClaim(outputClaim);
  return engine;
}

export function verifiedCapacityFromEngine(engine: ProductiveEconomyEngine): VerifiedAvailableCapacity {
  const object = autonomousVehicleFleetObject();
  const verified = engine.verifyClaim('claim.fleet.capacity');
  if (!verified.ok) {
    throw new Error(`capacity not verified: ${verified.code}`);
  }
  const issued = engine.issueFromClaim('claim.fleet.output');
  if (!issued.ok) {
    throw new Error(`output issuance failed: ${issued.code}`);
  }
  return Object.freeze({
    capacityId: 'capacity.fleet.integrated',
    providerRef: object.controller,
    productiveObjectRef: object.objectId,
    category: object.category,
    canonicalUnit: 'vehicle_hour',
    verifiedQuantity: verified.contribution.quantity,
    alreadyCommittedQuantity: 0n,
    availabilityWindow: Object.freeze({ validFrom: NOW, validUntil: UNTIL }),
    geography: Object.freeze({
      geographyId: object.geography.geographyId,
      jurisdiction: object.geography.jurisdiction,
    }),
    qualityClass: 'STANDARD',
    evidenceRefs: Object.freeze([verified.contribution.contributionId]),
    oracleRefs: Object.freeze([...verified.contribution.oracleFactIds]),
    contributionFingerprint: verified.contribution.fingerprint,
    observedAt: NOW,
  });
}

export function moonreyObservationFromEngine(engine: ProductiveEconomyEngine): MoonReyIssuanceObservation {
  const receipts = engine.snapshot().receipts;
  const latest = receipts[receipts.length - 1];
  if (!latest) {
    throw new Error('no MoonRey issuance receipt');
  }
  return Object.freeze({
    issuanceId: latest.issuanceId,
    contributionFingerprint: latest.fingerprint,
    moonreyQuantity: latest.moonreyQuantity,
    issuedAt: NOW,
    triggeredByAccess: false,
  });
}

export function runProductiveAccessIntegration(): ProductiveAccessIntegrationResult {
  const engine = buildAutonomousFleetProductiveEngine();
  const bridge = new ProductiveAccessBridge();
  const verifiedCapacity = verifiedCapacityFromEngine(engine);
  const moonreyIssuance = moonreyObservationFromEngine(engine);
  const moonreyBefore = engine.snapshot().supply.issued;

  bridge.registerOutputDeliveryLineage(verifiedCapacity.productiveObjectRef, Object.freeze([
    moonreyIssuance.contributionFingerprint,
  ]));

  const fleetDemo = runAutonomousFleetBridgeDemo({
    bridge,
    verifiedCapacity,
    moonreyBefore,
    moonreyAfter: moonreyBefore,
    moonreyIssuance,
  });

  const expandedCapacity = fixtureClaim({
    claimId: 'claim.fleet.capacity.expansion',
    objectId: verifiedCapacity.productiveObjectRef,
    claimType: 'CAPACITY',
    category: 'SERVICES',
    quantity: 110_000n,
    unit: 'service_hour',
  });
  for (const fact of fixtureFacts({
    objectId: verifiedCapacity.productiveObjectRef,
    category: 'SERVICES',
    quantity: 110_000n,
    unit: 'service_hour',
  })) {
    engine.putOracleFact(fact);
  }
  engine.submitClaim(expandedCapacity);
  const expandedVerified = engine.verifyClaim(expandedCapacity.claimId);
  const capacityExpansionDemonstrated = expandedVerified.ok && expandedVerified.contribution.quantity > verifiedCapacity.verifiedQuantity;

  const moonreyAfterAccess = engine.snapshot().supply.issued;

  return Object.freeze({
    bridge,
    engine,
    fleetDemo,
    capacityExpansionDemonstrated,
    moonreySupplyBeforeAccess: moonreyBefore,
    moonreySupplyAfterAccess: moonreyAfterAccess,
  });
}
