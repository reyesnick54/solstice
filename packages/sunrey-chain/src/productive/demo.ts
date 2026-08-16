import { ProductiveEconomyEngine } from './engine.ts';
import {
  automatedFactory,
  DEV_CLOCK,
  fixtureClaim,
  fixtureFacts,
  fixtureRight,
  gpuCluster,
  solarFacility,
} from './fixtures.ts';
import { developmentIssuancePolicy } from './policy.ts';

export type DemoReport = {
  readonly energy: ReturnType<typeof runEnergyDemo>;
  readonly compute: ReturnType<typeof runComputeDemo>;
  readonly manufacturing: ReturnType<typeof runManufacturingDemo>;
};

export function runEnergyDemo() {
  const engine = new ProductiveEconomyEngine(DEV_CLOCK);
  const object = solarFacility();
  engine.registerObject(object);
  engine.putRight(fixtureRight({ rightId: object.rightsReference, objectId: object.objectId, holderId: object.controller }));
  for (const fact of fixtureFacts({ objectId: object.objectId, category: 'ENERGY', quantity: 1_200n, unit: 'kWh' })) {
    engine.putOracleFact(fact);
  }
  const claim = fixtureClaim({
    claimId: 'claim.solar.output',
    objectId: object.objectId,
    claimType: 'OUTPUT',
    category: 'ENERGY',
    quantity: 1_200n,
    unit: 'kWh',
  });
  engine.submitClaim(claim);
  const issued = engine.issueFromClaim(claim.claimId);
  if (!issued.ok) {
    throw new Error(`energy demo issuance failed: ${issued.code}`);
  }
  const duplicate = fixtureClaim({
    claimId: 'claim.solar.output.dup',
    objectId: object.objectId,
    claimType: 'OUTPUT',
    category: 'ENERGY',
    quantity: 1_200n,
    unit: 'kWh',
  });
  engine.submitClaim(duplicate);
  const rejected = engine.issueFromClaim(duplicate.claimId);
  const replica = new ProductiveEconomyEngine(DEV_CLOCK);
  replica.restoreFromSnapshot(engine.snapshot());
  return {
    objectId: object.objectId,
    receipt: issued.receipt,
    supply: issued.supply,
    reconciled: engine.supplyIsReconciled(),
    duplicateRejected: !rejected.ok && (rejected.code === 'DUPLICATE_CONTRIBUTION' || rejected.code === 'DUPLICATE_ISSUANCE'),
    graphHash: engine.currentGraph().projectionHash,
    replicaGraphHash: replica.currentGraph().projectionHash,
    validatorsAgree: fourValidatorsAgree(engine),
  };
}

export function runComputeDemo() {
  const engine = new ProductiveEconomyEngine(DEV_CLOCK);
  const object = gpuCluster();
  engine.registerObject(object);
  engine.putRight(fixtureRight({ rightId: object.rightsReference, objectId: object.objectId, holderId: object.controller }));
  for (const fact of fixtureFacts({ objectId: object.objectId, category: 'AI_COMPUTE', quantity: 40n, unit: 'GPU_HOUR' })) {
    engine.putOracleFact(fact);
  }
  const claim = fixtureClaim({
    claimId: 'claim.gpu.usage',
    objectId: object.objectId,
    claimType: 'USAGE',
    category: 'AI_COMPUTE',
    quantity: 40n,
    unit: 'GPU_HOUR',
  });
  engine.submitClaim(claim);
  const issued = engine.issueFromClaim(claim.claimId);
  if (!issued.ok) {
    throw new Error(`compute demo issuance failed: ${issued.code}`);
  }
  return {
    attribution: engine.attribution(),
    receipt: issued.receipt,
    lineage: engine.lineage(issued.receipt.productiveContributionId),
    supply: issued.supply,
  };
}

export function runManufacturingDemo() {
  const engine = new ProductiveEconomyEngine(DEV_CLOCK);
  const object = automatedFactory();
  engine.registerObject(object);
  engine.putRight(fixtureRight({ rightId: object.rightsReference, objectId: object.objectId, holderId: object.controller }));
  for (const fact of fixtureFacts({ objectId: object.objectId, category: 'MANUFACTURING', quantity: 700n, unit: 'UNIT' })) {
    engine.putOracleFact(fact);
  }
  const capacity = fixtureClaim({
    claimId: 'claim.factory.capacity',
    objectId: object.objectId,
    claimType: 'CAPACITY',
    category: 'MANUFACTURING',
    quantity: 1_000n,
    unit: 'UNIT',
  });
  const output = fixtureClaim({
    claimId: 'claim.factory.output',
    objectId: object.objectId,
    claimType: 'OUTPUT',
    category: 'MANUFACTURING',
    quantity: 700n,
    unit: 'UNIT',
  });
  const delivery = fixtureClaim({
    claimId: 'claim.factory.delivery',
    objectId: object.objectId,
    claimType: 'DELIVERY',
    category: 'MANUFACTURING',
    quantity: 600n,
    unit: 'UNIT',
  });
  engine.submitClaim(capacity);
  engine.submitClaim(output);
  engine.submitClaim(delivery);
  const capacityVerified = engine.verifyClaim(capacity.claimId);
  const outputIssued = engine.issueFromClaim(output.claimId);
  const deliveryVerified = engine.verifyClaim(delivery.claimId);
  const deliveryIssued = deliveryVerified.ok
    ? engine.authorizeIssuance(deliveryVerified.contribution.contributionId)
    : deliveryVerified;
  if (!outputIssued.ok) {
    throw new Error(`manufacturing output issuance failed: ${outputIssued.code}`);
  }
  return {
    policy: developmentIssuancePolicy(),
    capacityVerified: capacityVerified.ok,
    deliveryVerified: deliveryVerified.ok,
    outputIssued: outputIssued.ok,
    deliveryIssuanceRejected: !deliveryIssued.ok && deliveryIssued.code === 'POLICY_INELIGIBLE_CLAIM_TYPE',
    moonreyQuantity: outputIssued.receipt.moonreyQuantity,
    notSummedAs2300: outputIssued.receipt.inputQuantity === 700n,
    lineage: {
      capacity: capacityVerified.ok ? engine.lineage(capacityVerified.contribution.contributionId) : null,
      output: engine.lineage(outputIssued.receipt.productiveContributionId),
      delivery: deliveryVerified.ok ? engine.lineage(deliveryVerified.contribution.contributionId) : null,
    },
  };
}

export function fourValidatorsAgree(source: ProductiveEconomyEngine): boolean {
  const snapshot = source.snapshot();
  const hashes = [1, 2, 3, 4].map((index) => {
    const replica = new ProductiveEconomyEngine({ ...DEV_CLOCK, blockId: `blk.v${index}` });
    replica.restoreFromSnapshot(snapshot);
    replica.dropGraph();
    const rebuilt = replica.rebuildGraph();
    return rebuilt.projectionHash;
  });
  return hashes.every((hash) => hash === snapshot.graphHash);
}

export function runAllDemos(): DemoReport {
  return {
    energy: runEnergyDemo(),
    compute: runComputeDemo(),
    manufacturing: runManufacturingDemo(),
  };
}

export async function main(): Promise<void> {
  console.log('============================================================');
  console.log('SunRey productive capacity / MoonRey issuance demo');
  console.log('ENGINEERING_SIMULATION_PARAMETERS — not market prices');
  console.log('ENVIRONMENT=simulation  ticker=NOT_ASSIGNED');
  console.log('============================================================');
  const report = runAllDemos();
  console.log('energy', {
    issuanceId: report.energy.receipt.issuanceId,
    moonrey: report.energy.receipt.moonreyQuantity.toString(),
    reconciled: report.energy.reconciled,
    duplicateRejected: report.energy.duplicateRejected,
    validatorsAgree: report.energy.validatorsAgree,
  });
  console.log('compute', {
    issuanceId: report.compute.receipt.issuanceId,
    moonrey: report.compute.receipt.moonreyQuantity.toString(),
    attribution: report.compute.attribution[0],
  });
  console.log('manufacturing', {
    capacityVerified: report.manufacturing.capacityVerified,
    outputIssued: report.manufacturing.outputIssued,
    deliveryIssuanceRejected: report.manufacturing.deliveryIssuanceRejected,
    notSummedAs2300: report.manufacturing.notSummedAs2300,
  });
  console.log('demo ok — development MoonRey from verified productive contributions only');
}

const invoked = process.argv[1]?.includes('productive/demo');
if (invoked) {
  await main();
}
