import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { moonreyIssuanceActivated } from './protocol/assets.ts';
import { MACHINE_TYPE_TO_ACTOR } from './machine-economy/types.ts';
import {
  CLASSICAL_MACHINE_SUITE,
  HYBRID_MACHINE_SUITE,
  MACHINE_KEY_PURPOSE,
  MachineEconomyEngine,
  PQ_MACHINE_SUITE,
  UnitRegistry,
  developmentPorts,
  isRejection,
  machineKeysMayShare,
  machineUsage,
  runComputeDemo,
  runEnergyDemo,
  runMachineCommand,
} from './machine-economy/index.ts';

function provisionBuyer(
  engine: MachineEconomyEngine,
  input: {
    readonly machineId: string;
    readonly machineType: 'AI_AGENT' | 'ROBOT' | 'DEVICE';
    readonly capability: 'PURCHASE_COMPUTE' | 'PURCHASE_ENERGY' | 'PURCHASE_SERVICE';
    readonly category: 'GPU_COMPUTE' | 'ENERGY' | 'ROBOT_LABOR';
    readonly maxPerTransaction?: bigint;
    readonly maxCompute?: bigint;
  },
): void {
  engine.creditDevelopmentUnits(input.machineId, 'MOONREY_COIN', 1_000_000n);
  engine.register({
    machineId: input.machineId,
    machineType: input.machineType,
    ownerActor: `${input.machineId}_owner`,
    controllerActor: `${input.machineId}_controller`,
    hardwareIdentityRef: `hw.${input.machineId}`,
    softwareModelRef: `sw.${input.machineId}`,
    firmwareHash: 'fw',
    modelHash: 'md',
    jurisdiction: 'SIM-DEV',
    seedLabel: input.machineId,
  });
  engine.grantCapabilities({
    machineId: input.machineId,
    controllerActor: `${input.machineId}_controller`,
    capabilities: [input.capability],
  });
  engine.setSpendingMandate({
    machineId: input.machineId,
    controllerActor: `${input.machineId}_controller`,
    mandateId: `spend_${input.machineId}`,
    allowedAssetIds: ['MOONREY_COIN'],
    maxPerTransaction: input.maxPerTransaction ?? 200_000n,
    maxPerEpoch: 500_000n,
    maxOutstandingCommitments: 200_000n,
    approvedCounterpartyClasses: ['MACHINE'],
    approvedServiceCategories: [input.category],
    purposeConstraints: ['bounded_purchase'],
    expiresAtUtc: '2027-01-01T00:00:00.000Z',
    controllerApprovalThreshold: 'AUTO_WITHIN_MANDATE',
  });
  engine.setResourceMandate({
    machineId: input.machineId,
    controllerActor: `${input.machineId}_controller`,
    mandateId: `res_${input.machineId}`,
    maxCompute: input.maxCompute ?? 1_000n,
    maxEnergy: 1_000n,
    maxBandwidth: 0n,
    maxStorage: 0n,
    maxProductionCommitment: 0n,
    maxDeliveryObligation: 1_000n,
    unitRefs: { compute: 'GPU_SECOND', energy: 'KWH', service: 'SERVICE_SECOND' },
  });
}

function provisionProvider(
  engine: MachineEconomyEngine,
  input: {
    readonly machineId: string;
    readonly offerId: string;
    readonly capability: 'SELL_COMPUTE' | 'SELL_ENERGY' | 'PROVIDE_SERVICE';
    readonly category: 'GPU_COMPUTE' | 'ENERGY' | 'ROBOT_LABOR';
    readonly unit: 'GPU_SECOND' | 'KWH' | 'SERVICE_SECOND';
    readonly capacity?: bigint;
    readonly pricePerUnit?: bigint;
    readonly asset?: 'MOONREY_COIN' | 'SUNREY_COIN';
  },
): void {
  engine.register({
    machineId: input.machineId,
    machineType: 'COMPUTE_NODE',
    ownerActor: `${input.machineId}_owner`,
    controllerActor: `${input.machineId}_controller`,
    hardwareIdentityRef: `hw.${input.machineId}`,
    softwareModelRef: `sw.${input.machineId}`,
    firmwareHash: 'fw',
    modelHash: 'md',
    jurisdiction: 'SIM-DEV',
    seedLabel: input.machineId,
  });
  engine.grantCapabilities({
    machineId: input.machineId,
    controllerActor: `${input.machineId}_controller`,
    capabilities: [input.capability],
  });
  engine.postOffer({
    offerId: input.offerId,
    providerMachineId: input.machineId,
    serviceCategory: input.category,
    capacity: input.capacity ?? 100n,
    unit: input.unit,
    pricePerUnit: input.pricePerUnit ?? 1_000n,
    acceptedAssets: [input.asset ?? 'MOONREY_COIN'],
    availableFromUtc: '2026-08-16T00:00:00.000Z',
    availableUntilUtc: '2026-12-31T00:00:00.000Z',
    location: 'SIM',
    jurisdiction: 'SIM-DEV',
    oracleRequired: true,
    meteringRequired: true,
    settlementAsset: input.asset ?? 'MOONREY_COIN',
    market: input.category === 'ENERGY' ? 'ENERGY' : 'COMPUTE_CAPACITY',
  });
}

describe('SunRey machine economic identity and commerce', () => {
  it('maps machine types onto the canonical ActorType set', () => {
    assert.equal(MACHINE_TYPE_TO_ACTOR.AI_AGENT, 'AI_AGENT');
    assert.equal(MACHINE_TYPE_TO_ACTOR.ROBOT, 'ROBOT');
    assert.equal(MACHINE_TYPE_TO_ACTOR.DEVICE, 'DEVICE');
    assert.equal(MACHINE_TYPE_TO_ACTOR.COMPUTE_NODE, 'PRODUCTIVE_ASSET');
    assert.equal(UnitRegistry.known('GPU_SECOND'), true);
    assert.equal(machineKeysMayShare('MACHINE_SIGNING'), true);
    assert.equal(machineKeysMayShare('VALIDATOR_CONSENSUS'), false);
    assert.equal(MACHINE_KEY_PURPOSE, 'MACHINE_SIGNING');
  });

  it('bounds an AI agent by explicit capability', () => {
    const engine = new MachineEconomyEngine();
    provisionBuyer(engine, {
      machineId: 'ai_1',
      machineType: 'AI_AGENT',
      capability: 'PURCHASE_COMPUTE',
      category: 'GPU_COMPUTE',
    });
    provisionProvider(engine, {
      machineId: 'gpu_1',
      offerId: 'offer_1',
      capability: 'SELL_COMPUTE',
      category: 'GPU_COMPUTE',
      unit: 'GPU_SECOND',
    });
    const ok = engine.submitPurchase({
      orderId: 'po_ok',
      buyerMachineId: 'ai_1',
      providerMachineId: 'gpu_1',
      offerId: 'offer_1',
      quantity: 10n,
      purpose: 'bounded_purchase',
      deliveryFromUtc: '2026-08-16T00:00:00.000Z',
      deliveryUntilUtc: '2026-08-16T01:00:00.000Z',
      seedLabel: 'ai_1',
      nonce: 'n1',
    });
    assert.equal(isRejection(ok), false);
  });

  it('bounds a robot by explicit capability', () => {
    const engine = new MachineEconomyEngine();
    provisionBuyer(engine, {
      machineId: 'robot_1',
      machineType: 'ROBOT',
      capability: 'PURCHASE_SERVICE',
      category: 'ROBOT_LABOR',
    });
    provisionProvider(engine, {
      machineId: 'labor_1',
      offerId: 'offer_robot',
      capability: 'PROVIDE_SERVICE',
      category: 'ROBOT_LABOR',
      unit: 'SERVICE_SECOND',
    });
    const ok = engine.submitPurchase({
      orderId: 'po_robot',
      buyerMachineId: 'robot_1',
      providerMachineId: 'labor_1',
      offerId: 'offer_robot',
      quantity: 5n,
      purpose: 'bounded_purchase',
      deliveryFromUtc: '2026-08-16T00:00:00.000Z',
      deliveryUntilUtc: '2026-08-16T01:00:00.000Z',
      seedLabel: 'robot_1',
      nonce: 'n-robot',
    });
    assert.equal(isRejection(ok), false);
    assert.equal(engine.getIdentity('robot_1')?.actorType, 'ROBOT');
  });

  it('bounds a device by explicit capability', () => {
    const engine = new MachineEconomyEngine();
    provisionBuyer(engine, {
      machineId: 'device_1',
      machineType: 'DEVICE',
      capability: 'PURCHASE_ENERGY',
      category: 'ENERGY',
    });
    provisionProvider(engine, {
      machineId: 'grid_1',
      offerId: 'offer_dev',
      capability: 'SELL_ENERGY',
      category: 'ENERGY',
      unit: 'KWH',
      pricePerUnit: 10n,
    });
    const ok = engine.submitPurchase({
      orderId: 'po_device',
      buyerMachineId: 'device_1',
      providerMachineId: 'grid_1',
      offerId: 'offer_dev',
      quantity: 8n,
      purpose: 'bounded_purchase',
      deliveryFromUtc: '2026-08-16T00:00:00.000Z',
      deliveryUntilUtc: '2026-08-16T01:00:00.000Z',
      seedLabel: 'device_1',
      nonce: 'n-device',
    });
    assert.equal(isRejection(ok), false);
    assert.equal(engine.getIdentity('device_1')?.actorType, 'DEVICE');
  });

  it('rejects an unauthorized service and leaves the machine active', () => {
    const engine = new MachineEconomyEngine();
    provisionBuyer(engine, {
      machineId: 'ai_unauth',
      machineType: 'AI_AGENT',
      capability: 'PURCHASE_COMPUTE',
      category: 'GPU_COMPUTE',
    });
    provisionProvider(engine, {
      machineId: 'grid_unauth',
      offerId: 'offer_energy_unauth',
      capability: 'SELL_ENERGY',
      category: 'ENERGY',
      unit: 'KWH',
      pricePerUnit: 10n,
    });
    const rejected = engine.submitPurchase({
      orderId: 'po_unauth',
      buyerMachineId: 'ai_unauth',
      providerMachineId: 'grid_unauth',
      offerId: 'offer_energy_unauth',
      quantity: 1n,
      purpose: 'bounded_purchase',
      deliveryFromUtc: '2026-08-16T00:00:00.000Z',
      deliveryUntilUtc: '2026-08-16T01:00:00.000Z',
      seedLabel: 'ai_unauth',
      nonce: 'n-unauth',
    });
    assert.equal(isRejection(rejected), true);
    if (isRejection(rejected)) {
      assert.equal(rejected.code, 'UNAUTHORIZED_SERVICE');
    }
    assert.equal(engine.getIdentity('ai_unauth')?.status, 'ACTIVE');
    assert.equal(engine.escrowForOrder('po_unauth'), undefined);
  });

  it('enforces the spending limit with an auditable rejection and no escrow', () => {
    const engine = new MachineEconomyEngine();
    provisionBuyer(engine, {
      machineId: 'ai_limit',
      machineType: 'AI_AGENT',
      capability: 'PURCHASE_COMPUTE',
      category: 'GPU_COMPUTE',
      maxPerTransaction: 5_000n,
    });
    provisionProvider(engine, {
      machineId: 'gpu_limit',
      offerId: 'offer_limit',
      capability: 'SELL_COMPUTE',
      category: 'GPU_COMPUTE',
      unit: 'GPU_SECOND',
    });
    const rejected = engine.submitPurchase({
      orderId: 'po_limit',
      buyerMachineId: 'ai_limit',
      providerMachineId: 'gpu_limit',
      offerId: 'offer_limit',
      quantity: 10n,
      purpose: 'bounded_purchase',
      deliveryFromUtc: '2026-08-16T00:00:00.000Z',
      deliveryUntilUtc: '2026-08-16T01:00:00.000Z',
      seedLabel: 'ai_limit',
      nonce: 'n-limit',
    });
    assert.equal(isRejection(rejected), true);
    if (isRejection(rejected)) {
      assert.equal(rejected.code, 'SPENDING_LIMIT_EXCEEDED');
      assert.match(rejected.reason, /mandate/i);
    }
    assert.equal(engine.escrowForOrder('po_limit'), undefined);
    assert.equal(engine.getIdentity('ai_limit')?.status, 'ACTIVE');
    assert.equal(engine.listRejections().length > 0, true);
  });

  it('enforces the resource limit', () => {
    const engine = new MachineEconomyEngine();
    provisionBuyer(engine, {
      machineId: 'ai_res',
      machineType: 'AI_AGENT',
      capability: 'PURCHASE_COMPUTE',
      category: 'GPU_COMPUTE',
      maxCompute: 5n,
    });
    provisionProvider(engine, {
      machineId: 'gpu_res',
      offerId: 'offer_res',
      capability: 'SELL_COMPUTE',
      category: 'GPU_COMPUTE',
      unit: 'GPU_SECOND',
    });
    const rejected = engine.submitPurchase({
      orderId: 'po_res',
      buyerMachineId: 'ai_res',
      providerMachineId: 'gpu_res',
      offerId: 'offer_res',
      quantity: 10n,
      purpose: 'bounded_purchase',
      deliveryFromUtc: '2026-08-16T00:00:00.000Z',
      deliveryUntilUtc: '2026-08-16T01:00:00.000Z',
      seedLabel: 'ai_res',
      nonce: 'n-res',
    });
    assert.equal(isRejection(rejected), true);
    if (isRejection(rejected)) {
      assert.equal(rejected.code, 'RESOURCE_LIMIT_EXCEEDED');
    }
  });

  it('rejects an unsupported settlement asset', () => {
    const engine = new MachineEconomyEngine();
    provisionBuyer(engine, {
      machineId: 'ai_asset',
      machineType: 'AI_AGENT',
      capability: 'PURCHASE_COMPUTE',
      category: 'GPU_COMPUTE',
    });
    provisionProvider(engine, {
      machineId: 'gpu_asset',
      offerId: 'offer_asset',
      capability: 'SELL_COMPUTE',
      category: 'GPU_COMPUTE',
      unit: 'GPU_SECOND',
      asset: 'SUNREY_COIN',
    });
    const rejected = engine.submitPurchase({
      orderId: 'po_asset',
      buyerMachineId: 'ai_asset',
      providerMachineId: 'gpu_asset',
      offerId: 'offer_asset',
      quantity: 1n,
      purpose: 'bounded_purchase',
      deliveryFromUtc: '2026-08-16T00:00:00.000Z',
      deliveryUntilUtc: '2026-08-16T01:00:00.000Z',
      seedLabel: 'ai_asset',
      nonce: 'n-asset',
    });
    assert.equal(isRejection(rejected), true);
    if (isRejection(rejected)) {
      assert.equal(rejected.code, 'UNSUPPORTED_ASSET');
    }
  });

  it('prevents a machine from governing, validating, or issuing MoonRey', () => {
    const engine = new MachineEconomyEngine();
    engine.register({
      machineId: 'ai_gov',
      machineType: 'AI_AGENT',
      ownerActor: 'owner',
      controllerActor: 'controller',
      hardwareIdentityRef: 'hw',
      softwareModelRef: 'sw',
      firmwareHash: 'fw',
      modelHash: 'md',
      jurisdiction: 'SIM-DEV',
    });
    for (const authority of [
      'VOTE_PROTOCOL_GOVERNANCE',
      'VOTE_VALIDATOR_CONSENSUS',
      'BECOME_VALIDATOR',
      'ISSUE_EXECUTION_AUTHORITY',
      'CHANGE_CRYPTO_SUITE_POLICY',
      'MODIFY_ORACLE_REGISTRY_AUTHORITY',
      'CHANGE_MOONREY_ISSUANCE_POLICY',
      'ISSUE_MOONREY_DIRECTLY',
    ] as const) {
      const refused = engine.refuseAuthority('ai_gov', authority);
      assert.equal(refused.code, 'FORBIDDEN_AUTHORITY');
    }
    assert.equal(moonreyIssuanceActivated(), false);
    assert.throws(() => engine.ports.productive.issueMoonRey(), /cannot issue MoonRey/);
  });

  it('settles escrow exactly and supports exact partial delivery', () => {
    const report = runComputeDemo();
    assert.equal(report.delivered, '72');
    assert.equal(report.paid, '72000');
    assert.equal(report.unusedReleased, '28000');
    assert.equal(BigInt(report.paid) + BigInt(report.unusedReleased), 100_000n);
    assert.equal(report.productiveEligible, true);
    assert.equal(report.moonreyIssued, false);
    assert.equal(report.rootsEqual, true);
    assert.equal(new Set(report.stateRoots).size, 1);
  });

  it('prevents ordinary settlement when oracles conflict', () => {
    const engine = new MachineEconomyEngine();
    provisionBuyer(engine, {
      machineId: 'ai_oracle',
      machineType: 'AI_AGENT',
      capability: 'PURCHASE_COMPUTE',
      category: 'GPU_COMPUTE',
    });
    provisionProvider(engine, {
      machineId: 'gpu_oracle',
      offerId: 'offer_oracle',
      capability: 'SELL_COMPUTE',
      category: 'GPU_COMPUTE',
      unit: 'GPU_SECOND',
    });
    const order = engine.submitPurchase({
      orderId: 'po_oracle',
      buyerMachineId: 'ai_oracle',
      providerMachineId: 'gpu_oracle',
      offerId: 'offer_oracle',
      quantity: 10n,
      purpose: 'bounded_purchase',
      deliveryFromUtc: '2026-08-16T00:00:00.000Z',
      deliveryUntilUtc: '2026-08-16T01:00:00.000Z',
      seedLabel: 'ai_oracle',
      nonce: 'n-oracle',
    });
    assert.equal(isRejection(order), false);
    engine.lockEscrow('po_oracle');
    engine.startMetering('po_oracle', 'meter_oracle');
    engine.reportDelivery({
      sessionId: 'meter_oracle',
      factId: 'f1',
      quantity: 10n,
      source: 'ORACLE_NETWORK',
      conflicted: true,
    });
    const proof = engine.finalizeDelivery('meter_oracle', 'proof_oracle');
    assert.equal(isRejection(proof), true);
    if (isRejection(proof)) {
      assert.equal(proof.code, 'ORACLE_CONFLICT');
    }
    assert.equal(engine.settlementForOrder('po_oracle'), undefined);
    assert.equal(engine.metrics().machine_oracle_conflicts >= 1, true);
  });

  it('revokes future actions, retains history, and recovers escrow deterministically', () => {
    const engine = new MachineEconomyEngine();
    provisionBuyer(engine, {
      machineId: 'ai_rev',
      machineType: 'AI_AGENT',
      capability: 'PURCHASE_COMPUTE',
      category: 'GPU_COMPUTE',
    });
    provisionProvider(engine, {
      machineId: 'gpu_rev',
      offerId: 'offer_rev',
      capability: 'SELL_COMPUTE',
      category: 'GPU_COMPUTE',
      unit: 'GPU_SECOND',
    });
    const order = engine.submitPurchase({
      orderId: 'po_rev',
      buyerMachineId: 'ai_rev',
      providerMachineId: 'gpu_rev',
      offerId: 'offer_rev',
      quantity: 10n,
      purpose: 'bounded_purchase',
      deliveryFromUtc: '2026-08-16T00:00:00.000Z',
      deliveryUntilUtc: '2026-08-16T01:00:00.000Z',
      seedLabel: 'ai_rev',
      nonce: 'n-rev-1',
    });
    assert.equal(isRejection(order), false);
    const escrow = engine.lockEscrow('po_rev');
    assert.equal(isRejection(escrow), false);
    const revoked = engine.revoke('ai_rev', 'ai_rev_controller', 'suspected_compromise');
    assert.equal(isRejection(revoked), false);
    assert.equal(engine.getIdentity('ai_rev')?.status, 'REVOKED');
    assert.equal(engine.escrowForOrder('po_rev')?.status, 'RECOVERY_HOLD');
    assert.equal(engine.getOrder('po_rev')?.orderId, 'po_rev');
    const future = engine.submitPurchase({
      orderId: 'po_rev_2',
      buyerMachineId: 'ai_rev',
      providerMachineId: 'gpu_rev',
      offerId: 'offer_rev',
      quantity: 1n,
      purpose: 'bounded_purchase',
      deliveryFromUtc: '2026-08-16T00:00:00.000Z',
      deliveryUntilUtc: '2026-08-16T01:00:00.000Z',
      seedLabel: 'ai_rev',
      nonce: 'n-rev-2',
    });
    assert.equal(isRejection(future), true);
    if (isRejection(future)) {
      assert.equal(future.code, 'MACHINE_NOT_ACTIVE');
    }
    const recovered = engine.recover('ai_rev', 'ai_rev_controller', 'ai_rev_replacement');
    assert.equal(isRejection(recovered), false);
    assert.equal(engine.getIdentity('ai_rev')?.status, 'ACTIVE');
    const oldKey = engine.submitPurchase({
      orderId: 'po_old_key',
      buyerMachineId: 'ai_rev',
      providerMachineId: 'gpu_rev',
      offerId: 'offer_rev',
      quantity: 1n,
      purpose: 'bounded_purchase',
      deliveryFromUtc: '2026-08-16T00:00:00.000Z',
      deliveryUntilUtc: '2026-08-16T01:00:00.000Z',
      seedLabel: 'ai_rev',
      nonce: 'n-old-key',
    });
    assert.equal(isRejection(oldKey), true);
    if (isRejection(oldKey)) {
      assert.equal(oldKey.code, 'KEY_COMPROMISED');
    }
    const released = engine.resolveRecoveryEscrow(
      engine.escrowForOrder('po_rev')?.escrowId ?? '',
      'ai_rev_controller',
      'RELEASE_TO_BUYER',
    );
    assert.equal(isRejection(released), false);
    if (!isRejection(released)) {
      assert.equal(released.status, 'RELEASED_UNUSED');
    }
  });

  it('rotates machine keys onto a hybrid/PQ-compatible suite', () => {
    const engine = new MachineEconomyEngine();
    engine.register({
      machineId: 'ai_pq',
      machineType: 'AI_AGENT',
      ownerActor: 'owner',
      controllerActor: 'controller',
      hardwareIdentityRef: 'hw',
      softwareModelRef: 'sw',
      firmwareHash: 'fw',
      modelHash: 'md',
      jurisdiction: 'SIM-DEV',
      suiteId: CLASSICAL_MACHINE_SUITE,
      seedLabel: 'ai_pq',
    });
    const rotated = engine.rotateKeys('ai_pq', 'controller', 'ai_pq_hybrid', HYBRID_MACHINE_SUITE);
    assert.equal(isRejection(rotated), false);
    if (!isRejection(rotated)) {
      assert.equal(rotated.suiteId, HYBRID_MACHINE_SUITE);
      assert.equal(rotated.purpose, 'MACHINE_SIGNING');
    }
    const pq = engine.rotateKeys('ai_pq', 'controller', 'ai_pq_pq', PQ_MACHINE_SUITE);
    assert.equal(isRejection(pq), false);
    if (!isRejection(pq)) {
      assert.equal(pq.suiteId, PQ_MACHINE_SUITE);
    }
    const identity = engine.getIdentity('ai_pq');
    assert.equal(identity?.keys.some((key) => key.status === 'ROTATED'), true);
    assert.equal(identity?.keys.at(-1)?.status, 'ACTIVE');
  });

  it('includes protocol fees in mandate accounting so fees cannot bypass the limit', () => {
    const engine = new MachineEconomyEngine();
    provisionBuyer(engine, {
      machineId: 'ai_fee',
      machineType: 'AI_AGENT',
      capability: 'PURCHASE_COMPUTE',
      category: 'GPU_COMPUTE',
      maxPerTransaction: 10_000n,
    });
    provisionProvider(engine, {
      machineId: 'gpu_fee',
      offerId: 'offer_fee',
      capability: 'SELL_COMPUTE',
      category: 'GPU_COMPUTE',
      unit: 'GPU_SECOND',
      pricePerUnit: 1_000n,
    });
    const rejected = engine.submitPurchase({
      orderId: 'po_fee',
      buyerMachineId: 'ai_fee',
      providerMachineId: 'gpu_fee',
      offerId: 'offer_fee',
      quantity: 10n,
      purpose: 'bounded_purchase',
      deliveryFromUtc: '2026-08-16T00:00:00.000Z',
      deliveryUntilUtc: '2026-08-16T01:00:00.000Z',
      seedLabel: 'ai_fee',
      nonce: 'n-fee',
    });
    assert.equal(isRejection(rejected), true);
    if (isRejection(rejected)) {
      assert.equal(rejected.code, 'FEE_BYPASS_REJECTED');
    }
  });

  it('keeps productive contribution eligibility separate from MoonRey issuance', () => {
    const report = runComputeDemo();
    assert.equal(report.productiveEligible, true);
    assert.equal(report.moonreyIssued, false);
    const energy = runEnergyDemo();
    assert.equal(energy.converted, false);
    assert.equal(energy.paid, '8000');
    assert.equal(energy.unusedReleased, '0');
  });

  it('exposes machine CLI commands and observability metrics', () => {
    const engine = new MachineEconomyEngine();
    const registered = runMachineCommand(engine, ['register', 'cli_bot', 'ROBOT', 'cli_controller']);
    assert.equal(registered.ok, true);
    assert.match(machineUsage(), /sunrey-node machine register/);
    assert.equal(runMachineCommand(engine, ['show', 'cli_bot']).ok, true);
    assert.equal(runMachineCommand(engine, ['capabilities', 'cli_bot']).ok, true);
    assert.equal(runMachineCommand(engine, ['mandate', 'cli_bot']).ok, true);
    assert.equal(runMachineCommand(engine, ['offers']).ok, true);
    const revoked = runMachineCommand(engine, ['revoke', 'cli_bot', 'cli_controller', 'cli_test']);
    assert.equal(revoked.ok, true);
    const metrics = engine.metrics();
    assert.equal(typeof metrics.active_machine_identities, 'number');
    assert.equal(metrics.machine_revocations >= 1, true);
  });

  it('refuses high-value settlement on machine self-report alone', () => {
    const engine = new MachineEconomyEngine();
    provisionBuyer(engine, {
      machineId: 'ai_self',
      machineType: 'AI_AGENT',
      capability: 'PURCHASE_COMPUTE',
      category: 'GPU_COMPUTE',
    });
    provisionProvider(engine, {
      machineId: 'gpu_self',
      offerId: 'offer_self',
      capability: 'SELL_COMPUTE',
      category: 'GPU_COMPUTE',
      unit: 'GPU_SECOND',
    });
    engine.submitPurchase({
      orderId: 'po_self',
      buyerMachineId: 'ai_self',
      providerMachineId: 'gpu_self',
      offerId: 'offer_self',
      quantity: 20n,
      purpose: 'bounded_purchase',
      deliveryFromUtc: '2026-08-16T00:00:00.000Z',
      deliveryUntilUtc: '2026-08-16T01:00:00.000Z',
      seedLabel: 'ai_self',
      nonce: 'n-self',
    });
    engine.lockEscrow('po_self');
    engine.startMetering('po_self', 'meter_self');
    engine.reportDelivery({
      sessionId: 'meter_self',
      factId: 'self_1',
      quantity: 20n,
      source: 'MACHINE_SELF_REPORT',
    });
    const proof = engine.finalizeDelivery('meter_self', 'proof_self');
    assert.equal(isRejection(proof), true);
    if (isRejection(proof)) {
      assert.equal(proof.code, 'SELF_REPORT_INSUFFICIENT');
    }
  });

  it('does not create a second exchange or convert native assets', () => {
    const ports = developmentPorts();
    assert.equal(ports.matching.source, 'MACHINE_MARKET_MATCHING_PORT');
    assert.deepEqual([...ports.matching.markets], [
      'COMPUTE_CAPACITY',
      'ENERGY',
      'MACHINE_SERVICES',
      'PRODUCTIVE_CAPACITY_RIGHTS',
    ]);
    const energy = runEnergyDemo();
    assert.equal(energy.converted, false);
  });
});
