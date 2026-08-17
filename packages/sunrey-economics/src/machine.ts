/**
 * Machine-to-machine commerce through canonical mandates.
 *
 * AI, robots, factories, and service agents transact only inside
 * configured mandates. Machines cannot issue MoonRey.
 */

import { MachineEconomyEngine, isRejection } from '../../sunrey-chain/src/machine-economy/engine.ts';
import { developmentPorts } from '../../sunrey-chain/src/machine-economy/ports.ts';
import { moonreyIssuanceActivated } from '../../sunrey-chain/src/protocol/assets.ts';
import type { MachineCommerceSnapshot } from './types.ts';

export type MachineLab = {
  readonly engine: MachineEconomyEngine;
  settled: number;
  rejectedMandate: number;
  sunreySettled: bigint;
  moonreySettled: bigint;
};

const PAIRS = [
  { buyer: 'ai_compute_buyer', provider: 'compute_seller', category: 'GPU_COMPUTE' as const, asset: 'MOONREY_COIN' as const, purpose: 'purchase_gpu_compute', buyCap: 'PURCHASE_COMPUTE' as const, sellCap: 'SELL_COMPUTE' as const, unit: 'GPU_SECOND' as const, market: 'COMPUTE_CAPACITY' as const },
  { buyer: 'robot_energy_buyer', provider: 'energy_seller', category: 'ENERGY' as const, asset: 'SUNREY_COIN' as const, purpose: 'purchase_energy', buyCap: 'PURCHASE_ENERGY' as const, sellCap: 'SELL_ENERGY' as const, unit: 'KWH' as const, market: 'ENERGY' as const },
  { buyer: 'factory_logistics_buyer', provider: 'logistics_seller', category: 'DELIVERY_SERVICE' as const, asset: 'MOONREY_COIN' as const, purpose: 'request_logistics', buyCap: 'REQUEST_LOGISTICS' as const, sellCap: 'PROVIDE_LOGISTICS' as const, unit: 'LOGISTICS_METER' as const, market: 'MACHINE_SERVICES' as const },
  { buyer: 'service_storage_buyer', provider: 'storage_seller', category: 'WAREHOUSE_STORAGE' as const, asset: 'SUNREY_COIN' as const, purpose: 'purchase_storage', buyCap: 'PURCHASE_STORAGE' as const, sellCap: 'SELL_STORAGE' as const, unit: 'GB_MONTH' as const, market: 'MACHINE_SERVICES' as const },
];

export function createMachineLab(): MachineLab {
  if (moonreyIssuanceActivated()) {
    throw new Error('machine lab must not run with production MoonRey issuance');
  }
  const engine = new MachineEconomyEngine(developmentPorts(), Date.parse('2026-08-17T12:00:00.000Z'));
  for (const pair of PAIRS) {
    engine.creditDevelopmentUnits(pair.buyer, pair.asset, 1_000_000n);
    register(engine, pair.buyer, pair.buyer.includes('ai') ? 'AI_AGENT' : pair.buyer.includes('robot') ? 'ROBOT' : pair.buyer.includes('factory') ? 'INDUSTRIAL_MACHINE' : 'AUTOMATED_SERVICE', pair.asset);
    register(engine, pair.provider, pair.provider.includes('compute') ? 'COMPUTE_NODE' : pair.provider.includes('energy') ? 'PRODUCTIVE_MACHINE' : 'AUTOMATED_SERVICE', pair.asset);
    engine.grantCapabilities({ machineId: pair.buyer, controllerActor: `ctl_${pair.buyer}`, capabilities: [pair.buyCap] });
    engine.grantCapabilities({ machineId: pair.provider, controllerActor: `ctl_${pair.provider}`, capabilities: [pair.sellCap] });
    engine.setSpendingMandate({
      machineId: pair.buyer,
      controllerActor: `ctl_${pair.buyer}`,
      mandateId: `spend_${pair.buyer}`,
      allowedAssetIds: [pair.asset],
      maxPerTransaction: 200_000n,
      maxPerEpoch: 800_000n,
      maxOutstandingCommitments: 200_000n,
      approvedCounterpartyClasses: ['MACHINE'],
      approvedServiceCategories: [pair.category],
      purposeConstraints: [pair.purpose],
      expiresAtUtc: '2027-01-01T00:00:00.000Z',
      controllerApprovalThreshold: 'AUTO_WITHIN_MANDATE',
    });
    engine.setResourceMandate({
      machineId: pair.buyer,
      controllerActor: `ctl_${pair.buyer}`,
      mandateId: `res_${pair.buyer}`,
      maxCompute: 10_000n,
      maxEnergy: 10_000n,
      maxBandwidth: 10_000n,
      maxStorage: 10_000n,
      maxProductionCommitment: 10_000n,
      maxDeliveryObligation: 10_000n,
      unitRefs: { compute: 'GPU_SECOND' },
    });
    engine.postOffer({
      offerId: `offer_${pair.provider}`,
      providerMachineId: pair.provider,
      serviceCategory: pair.category,
      capacity: 10_000n,
      unit: pair.unit,
      pricePerUnit: 1_000n,
      acceptedAssets: [pair.asset],
      availableFromUtc: '2026-08-16T00:00:00.000Z',
      availableUntilUtc: '2027-12-31T00:00:00.000Z',
      location: 'SIM-HALL',
      jurisdiction: 'SIM-DEV',
      oracleRequired: true,
      meteringRequired: true,
      settlementAsset: pair.asset,
      market: pair.market,
    });
  }
  return { engine, settled: 0, rejectedMandate: 0, sunreySettled: 0n, moonreySettled: 0n };
}

function register(engine: MachineEconomyEngine, machineId: string, machineType: 'AI_AGENT' | 'ROBOT' | 'INDUSTRIAL_MACHINE' | 'AUTOMATED_SERVICE' | 'COMPUTE_NODE' | 'PRODUCTIVE_MACHINE', asset: 'SUNREY_COIN' | 'MOONREY_COIN'): void {
  const identity = engine.register({
    machineId,
    machineType,
    ownerActor: `own_${machineId}`,
    controllerActor: `ctl_${machineId}`,
    hardwareIdentityRef: `hw.${machineId}`,
    softwareModelRef: `sw.${machineId}`,
    firmwareHash: `fw_${machineId}`,
    modelHash: `md_${machineId}`,
    jurisdiction: 'SIM-DEV',
    approvedAssets: [asset],
    seedLabel: machineId,
  });
  if (isRejection(identity)) {
    throw new Error(identity.reason);
  }
}

export function runMachineEpoch(lab: MachineLab, epoch: number, overspend = false): void {
  for (const [index, pair] of PAIRS.entries()) {
    const orderId = `po_${pair.buyer}_${epoch}`;
    const order = lab.engine.submitPurchase({
      orderId,
      buyerMachineId: pair.buyer,
      providerMachineId: pair.provider,
      offerId: `offer_${pair.provider}`,
      quantity: overspend && index === 0 ? 10_000n : 10n,
      purpose: pair.purpose,
      deliveryFromUtc: '2026-08-17T12:00:00.000Z',
      deliveryUntilUtc: '2026-08-17T13:00:00.000Z',
      seedLabel: pair.buyer,
      nonce: `nonce_${pair.buyer}_${epoch}`,
    });
    if (isRejection(order)) {
      lab.rejectedMandate += 1;
      continue;
    }
    const escrow = lab.engine.lockEscrow(order.orderId);
    if (isRejection(escrow)) {
      lab.rejectedMandate += 1;
      continue;
    }
    lab.engine.startMetering(order.orderId, `meter_${orderId}`);
    lab.engine.reportDelivery({
      sessionId: `meter_${orderId}`,
      factId: `fact_${orderId}`,
      quantity: 8n,
      source: 'ORACLE_NETWORK',
    });
    const proof = lab.engine.finalizeDelivery(`meter_${orderId}`, `proof_${orderId}`);
    if (isRejection(proof)) {
      lab.rejectedMandate += 1;
      continue;
    }
    const settlement = lab.engine.settle(order.orderId, `set_${orderId}`);
    if (isRejection(settlement)) {
      lab.rejectedMandate += 1;
      continue;
    }
    lab.settled += 1;
    if (pair.asset === 'SUNREY_COIN') {
      lab.sunreySettled += settlement.paid;
    } else {
      lab.moonreySettled += settlement.paid;
    }
  }
}

export function machineSnapshot(lab: MachineLab): MachineCommerceSnapshot {
  return Object.freeze({
    settled: lab.settled,
    rejectedMandate: lab.rejectedMandate,
    sunreySettled: lab.sunreySettled,
    moonreySettled: lab.moonreySettled,
    mandateBypass: false,
  });
}
