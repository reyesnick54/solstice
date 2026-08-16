import { MachineEconomyEngine, isRejection } from './engine.ts';
import { developmentPorts } from './ports.ts';
import type { MachineEconomyMetrics, MachineSettlement } from './types.ts';

export type ComputeDemoReport = {
  readonly buyerId: string;
  readonly providerId: string;
  readonly orderId: string;
  readonly escrowLocked: string;
  readonly delivered: string;
  readonly paid: string;
  readonly unusedReleased: string;
  readonly productiveEligible: boolean;
  readonly moonreyIssued: false;
  readonly stateRoots: readonly string[];
  readonly rootsEqual: boolean;
  readonly metrics: MachineEconomyMetrics;
};

export type EnergyDemoReport = {
  readonly buyerId: string;
  readonly providerId: string;
  readonly paid: string;
  readonly unusedReleased: string;
  readonly asset: 'MOONREY_COIN' | 'SUNREY_COIN';
  readonly converted: false;
  readonly stateRoot: string;
};

function fourEngines(): MachineEconomyEngine[] {
  return [0, 1, 2, 3].map(() => new MachineEconomyEngine(developmentPorts()));
}

function provisionComputePair(engine: MachineEconomyEngine): void {
  engine.creditDevelopmentUnits('ai_buyer', 'MOONREY_COIN', 1_000_000n);
  const buyer = engine.register({
    machineId: 'ai_buyer',
    machineType: 'AI_AGENT',
    ownerActor: 'human_owner_1',
    controllerActor: 'human_controller_1',
    hardwareIdentityRef: 'hw.ai.buyer',
    softwareModelRef: 'model.buyer.v1',
    firmwareHash: 'fw_buyer',
    modelHash: 'md_buyer',
    jurisdiction: 'SIM-DEV',
    seedLabel: 'ai_buyer',
  });
  const provider = engine.register({
    machineId: 'gpu_provider',
    machineType: 'COMPUTE_NODE',
    ownerActor: 'human_owner_2',
    controllerActor: 'human_controller_2',
    hardwareIdentityRef: 'hw.gpu.1',
    softwareModelRef: 'gpu.cluster.v1',
    firmwareHash: 'fw_gpu',
    modelHash: 'md_gpu',
    jurisdiction: 'SIM-DEV',
    seedLabel: 'gpu_provider',
  });
  if (isRejection(buyer) || isRejection(provider)) {
    throw new Error('registration failed');
  }
  engine.grantCapabilities({
    machineId: 'ai_buyer',
    controllerActor: 'human_controller_1',
    capabilities: ['PURCHASE_COMPUTE'],
  });
  engine.grantCapabilities({
    machineId: 'gpu_provider',
    controllerActor: 'human_controller_2',
    capabilities: ['SELL_COMPUTE'],
  });
  engine.setSpendingMandate({
    machineId: 'ai_buyer',
    controllerActor: 'human_controller_1',
    mandateId: 'spend_ai_buyer',
    allowedAssetIds: ['MOONREY_COIN'],
    maxPerTransaction: 200_000n,
    maxPerEpoch: 500_000n,
    maxOutstandingCommitments: 200_000n,
    approvedCounterpartyClasses: ['MACHINE'],
    approvedServiceCategories: ['GPU_COMPUTE'],
    purposeConstraints: ['purchase_gpu_compute'],
    expiresAtUtc: '2027-01-01T00:00:00.000Z',
    controllerApprovalThreshold: 'AUTO_WITHIN_MANDATE',
  });
  engine.setResourceMandate({
    machineId: 'ai_buyer',
    controllerActor: 'human_controller_1',
    mandateId: 'res_ai_buyer',
    maxCompute: 10_000n,
    maxEnergy: 0n,
    maxBandwidth: 0n,
    maxStorage: 0n,
    maxProductionCommitment: 0n,
    maxDeliveryObligation: 0n,
    unitRefs: { compute: 'GPU_SECOND' },
  });
  engine.postOffer({
    offerId: 'offer_gpu_1',
    providerMachineId: 'gpu_provider',
    serviceCategory: 'GPU_COMPUTE',
    capacity: 100n,
    unit: 'GPU_SECOND',
    pricePerUnit: 1_000n,
    acceptedAssets: ['MOONREY_COIN'],
    availableFromUtc: '2026-08-16T00:00:00.000Z',
    availableUntilUtc: '2026-12-31T00:00:00.000Z',
    location: 'SIM-HALL',
    jurisdiction: 'SIM-DEV',
    oracleRequired: true,
    meteringRequired: true,
    settlementAsset: 'MOONREY_COIN',
    market: 'COMPUTE_CAPACITY',
  });
}

function runComputeOn(engine: MachineEconomyEngine): MachineSettlement {
  provisionComputePair(engine);
  const order = engine.submitPurchase({
    orderId: 'po_compute_1',
    buyerMachineId: 'ai_buyer',
    providerMachineId: 'gpu_provider',
    offerId: 'offer_gpu_1',
    quantity: 100n,
    purpose: 'purchase_gpu_compute',
    deliveryFromUtc: '2026-08-16T00:00:00.000Z',
    deliveryUntilUtc: '2026-08-16T01:00:00.000Z',
    seedLabel: 'ai_buyer',
    nonce: 'nonce-compute-1',
  });
  if (isRejection(order)) {
    throw new Error(order.reason);
  }
  const escrow = engine.lockEscrow(order.orderId);
  if (isRejection(escrow)) {
    throw new Error(escrow.reason);
  }
  engine.startMetering(order.orderId, 'meter_compute_1');
  engine.reportDelivery({
    sessionId: 'meter_compute_1',
    factId: 'fact_gpu_72',
    quantity: 72n,
    source: 'ORACLE_NETWORK',
  });
  const proof = engine.finalizeDelivery('meter_compute_1', 'proof_compute_1');
  if (isRejection(proof)) {
    throw new Error(proof.reason);
  }
  const settlement = engine.settle(order.orderId, 'set_compute_1');
  if (isRejection(settlement)) {
    throw new Error(settlement.reason);
  }
  return settlement;
}

export function runComputeDemo(): ComputeDemoReport {
  const engines = fourEngines();
  const settlements = engines.map((engine) => runComputeOn(engine));
  const roots = engines.map((engine) => engine.stateRoot());
  const first = engines[0];
  const settlement = settlements[0];
  if (!first || !settlement) {
    throw new Error('machine-economy settlement missing');
  }
  return {
    buyerId: 'ai_buyer',
    providerId: 'gpu_provider',
    orderId: 'po_compute_1',
    escrowLocked: '100000',
    delivered: '72',
    paid: settlement.paid.toString(),
    unusedReleased: settlement.unusedReleased.toString(),
    productiveEligible: settlement.productiveEligible,
    moonreyIssued: false,
    stateRoots: roots,
    rootsEqual: roots.every((root) => root === roots[0]),
    metrics: first.metrics(),
  };
}

export function runEnergyDemo(): EnergyDemoReport {
  const engine = new MachineEconomyEngine();
  engine.creditDevelopmentUnits('facility_buyer', 'SUNREY_COIN', 50_000n);
  engine.register({
    machineId: 'facility_buyer',
    machineType: 'INDUSTRIAL_MACHINE',
    ownerActor: 'facility_owner',
    controllerActor: 'facility_controller',
    hardwareIdentityRef: 'hw.facility',
    softwareModelRef: 'facility.os.v1',
    firmwareHash: 'fw_fac',
    modelHash: 'md_fac',
    jurisdiction: 'SIM-DEV',
    approvedAssets: ['SUNREY_COIN'],
    seedLabel: 'facility_buyer',
  });
  engine.register({
    machineId: 'power_resource',
    machineType: 'PRODUCTIVE_MACHINE',
    ownerActor: 'power_owner',
    controllerActor: 'power_controller',
    hardwareIdentityRef: 'hw.power',
    softwareModelRef: 'power.ctrl.v1',
    firmwareHash: 'fw_pwr',
    modelHash: 'md_pwr',
    jurisdiction: 'SIM-DEV',
    approvedAssets: ['SUNREY_COIN'],
    seedLabel: 'power_resource',
  });
  engine.grantCapabilities({
    machineId: 'facility_buyer',
    controllerActor: 'facility_controller',
    capabilities: ['PURCHASE_ENERGY'],
  });
  engine.grantCapabilities({
    machineId: 'power_resource',
    controllerActor: 'power_controller',
    capabilities: ['SELL_ENERGY'],
  });
  engine.setSpendingMandate({
    machineId: 'facility_buyer',
    controllerActor: 'facility_controller',
    mandateId: 'spend_energy',
    allowedAssetIds: ['SUNREY_COIN'],
    maxPerTransaction: 20_000n,
    maxPerEpoch: 40_000n,
    maxOutstandingCommitments: 20_000n,
    approvedCounterpartyClasses: ['MACHINE'],
    approvedServiceCategories: ['ENERGY'],
    purposeConstraints: ['buy_facility_energy'],
    expiresAtUtc: '2027-01-01T00:00:00.000Z',
    controllerApprovalThreshold: 'AUTO_WITHIN_MANDATE',
  });
  engine.postOffer({
    offerId: 'offer_energy_1',
    providerMachineId: 'power_resource',
    serviceCategory: 'ENERGY',
    capacity: 500n,
    unit: 'KWH',
    pricePerUnit: 20n,
    acceptedAssets: ['SUNREY_COIN'],
    availableFromUtc: '2026-08-16T00:00:00.000Z',
    availableUntilUtc: '2026-12-31T00:00:00.000Z',
    location: 'SIM-GRID',
    jurisdiction: 'SIM-DEV',
    oracleRequired: true,
    meteringRequired: true,
    settlementAsset: 'SUNREY_COIN',
    market: 'ENERGY',
  });
  const order = engine.submitPurchase({
    orderId: 'po_energy_1',
    buyerMachineId: 'facility_buyer',
    providerMachineId: 'power_resource',
    offerId: 'offer_energy_1',
    quantity: 400n,
    purpose: 'buy_facility_energy',
    deliveryFromUtc: '2026-08-16T00:00:00.000Z',
    deliveryUntilUtc: '2026-08-16T12:00:00.000Z',
    seedLabel: 'facility_buyer',
    nonce: 'nonce-energy-1',
  });
  if (isRejection(order)) {
    throw new Error(order.reason);
  }
  engine.lockEscrow(order.orderId);
  engine.startMetering(order.orderId, 'meter_energy_1');
  engine.reportDelivery({
    sessionId: 'meter_energy_1',
    factId: 'fact_kwh_400',
    quantity: 400n,
    source: 'ORACLE_NETWORK',
  });
  engine.finalizeDelivery('meter_energy_1', 'proof_energy_1');
  const settlement = engine.settle(order.orderId, 'set_energy_1');
  if (isRejection(settlement)) {
    throw new Error(settlement.reason);
  }
  return {
    buyerId: 'facility_buyer',
    providerId: 'power_resource',
    paid: settlement.paid.toString(),
    unusedReleased: settlement.unusedReleased.toString(),
    asset: settlement.assetId,
    converted: false,
    stateRoot: engine.stateRoot(),
  };
}
