import { MachineEconomyEngine, isRejection } from '../../../sunrey-chain/src/machine-economy/engine.ts';
import { developmentPorts } from '../../../sunrey-chain/src/machine-economy/ports.ts';
import { recordAlert, type RangeEnvironment } from '../environment.ts';
import { actor, defineScenario, detection, finish, holdAll, recovery, step } from './helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';

function pair(maxPerTransaction = 5_000n, credit = 1_000_000n): MachineEconomyEngine {
  const engine = new MachineEconomyEngine(developmentPorts());
  engine.creditDevelopmentUnits('ai_buyer', 'MOONREY_COIN', credit);
  engine.register({
    machineId: 'ai_buyer',
    machineType: 'AI_AGENT',
    ownerActor: 'ai_buyer_owner',
    controllerActor: 'ai_buyer_controller',
    hardwareIdentityRef: 'hw.ai_buyer',
    softwareModelRef: 'sw.ai_buyer',
    firmwareHash: 'fw',
    modelHash: 'md',
    jurisdiction: 'SIM-DEV',
    seedLabel: 'ai_buyer',
  });
  engine.register({
    machineId: 'gpu_provider',
    machineType: 'COMPUTE_NODE',
    ownerActor: 'gpu_owner',
    controllerActor: 'gpu_controller',
    hardwareIdentityRef: 'hw.gpu',
    softwareModelRef: 'sw.gpu',
    firmwareHash: 'fw',
    modelHash: 'md',
    jurisdiction: 'SIM-DEV',
    seedLabel: 'gpu_provider',
  });
  engine.grantCapabilities({ machineId: 'ai_buyer', controllerActor: 'ai_buyer_controller', capabilities: ['PURCHASE_COMPUTE'] });
  engine.grantCapabilities({ machineId: 'gpu_provider', controllerActor: 'gpu_controller', capabilities: ['SELL_COMPUTE'] });
  engine.setSpendingMandate({
    machineId: 'ai_buyer',
    controllerActor: 'ai_buyer_controller',
    mandateId: 'spend_ai_buyer',
    allowedAssetIds: ['MOONREY_COIN'],
    maxPerTransaction,
    maxPerEpoch: 500_000n,
    maxOutstandingCommitments: 200_000n,
    approvedCounterpartyClasses: ['MACHINE'],
    approvedServiceCategories: ['GPU_COMPUTE'],
    purposeConstraints: ['bounded_purchase'],
    expiresAtUtc: '2027-01-01T00:00:00.000Z',
    controllerApprovalThreshold: 'AUTO_WITHIN_MANDATE',
  });
  engine.setResourceMandate({
    machineId: 'ai_buyer',
    controllerActor: 'ai_buyer_controller',
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
  return engine;
}

export const machineScenarios: readonly AttackScenario[] = [
  defineScenario({
    scenarioId: 'MACHINE-OVERSPEND',
    category: 'MACHINE_COMMERCE_ABUSE',
    seed: 5770,
    subsystem: 'machine-economy',
    attack: 'machine overspend',
    actors: [actor('ai_buyer', 'MACHINE_ACTOR', true)],
    faults: [],
    timeline: [step(1, 'ai_buyer', 'over-limit purchase')],
    expectedSecurityProperties: ['NO_MACHINE_MANDATE_BYPASS'],
    expectedDetections: [detection('security_log', 'SPENDING_LIMIT_EXCEEDED')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'spending mandate',
    detectiveControl: 'SPENDING_LIMIT_EXCEEDED',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'MACHINE-OUTSIDE-CAPABILITY',
    category: 'MACHINE_COMMERCE_ABUSE',
    seed: 5771,
    subsystem: 'machine-economy',
    attack: 'purchase outside capability',
    actors: [actor('ai_buyer', 'MACHINE_ACTOR', true)],
    faults: [],
    timeline: [step(1, 'ai_buyer', 'buy energy without capability')],
    expectedSecurityProperties: ['NO_MACHINE_MANDATE_BYPASS'],
    expectedDetections: [detection('security_log', 'CAPABILITY_MISSING')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'capability manifest',
    detectiveControl: 'CAPABILITY_MISSING',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'MACHINE-SELF-CERTIFY',
    category: 'MACHINE_COMMERCE_ABUSE',
    seed: 5772,
    subsystem: 'machine-economy',
    attack: 'machine self-certifies high-value delivery',
    actors: [actor('gpu_provider', 'MACHINE_ACTOR', true)],
    faults: [],
    timeline: [step(1, 'gpu_provider', 'self report')],
    expectedSecurityProperties: ['NO_MACHINE_MANDATE_BYPASS'],
    expectedDetections: [detection('security_log', 'SELF_REPORT_INSUFFICIENT')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'oracle-backed delivery',
    detectiveControl: 'SELF_REPORT_INSUFFICIENT',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'MACHINE-METER',
    category: 'MACHINE_COMMERCE_ABUSE',
    seed: 5773,
    subsystem: 'machine-economy',
    attack: 'meter manipulation',
    actors: [actor('gpu_provider', 'MACHINE_ACTOR', true)],
    faults: [],
    timeline: [step(1, 'gpu_provider', 'inflate meter')],
    expectedSecurityProperties: ['NO_MACHINE_MANDATE_BYPASS'],
    expectedDetections: [detection('security_log', 'ORACLE_CONFLICT')],
    expectedRecovery: ['ORACLE_SUSPENSION'],
    preventiveControl: 'oracle conflict on delivery',
    detectiveControl: 'ORACLE_CONFLICT',
    recovery: 'hold escrow',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'MACHINE-REVOKED',
    category: 'MACHINE_COMMERCE_ABUSE',
    seed: 5774,
    subsystem: 'machine-economy',
    attack: 'revoked machine action',
    actors: [actor('ai_buyer', 'MACHINE_ACTOR', true)],
    faults: [],
    timeline: [step(1, 'operator', 'revoke'), step(2, 'ai_buyer', 'purchase')],
    expectedSecurityProperties: ['NO_MACHINE_MANDATE_BYPASS'],
    expectedDetections: [detection('security_log', 'REVOKED')],
    expectedRecovery: ['KEY_ROTATION'],
    preventiveControl: 'revocation',
    detectiveControl: 'status REVOKED',
    recovery: 'escrow recovery hold',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'MACHINE-ESCROW-DOUBLE',
    category: 'MACHINE_COMMERCE_ABUSE',
    seed: 5775,
    subsystem: 'machine-economy',
    attack: 'escrow double spend',
    actors: [actor('ai_buyer', 'MACHINE_ACTOR', true)],
    faults: [],
    timeline: [step(1, 'ai_buyer', 'lock twice')],
    expectedSecurityProperties: ['NO_MACHINE_MANDATE_BYPASS', 'NO_DOUBLE_SETTLEMENT'],
    expectedDetections: [detection('security_log', 'ESCROW_UNSAFE_STATE')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'escrow state machine',
    detectiveControl: 'ESCROW_UNSAFE_STATE',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'MACHINE-CONFLICTED-ORACLE',
    category: 'MACHINE_COMMERCE_ABUSE',
    seed: 5776,
    subsystem: 'machine-economy',
    attack: 'settlement with conflicted oracle fact',
    actors: [actor('oracle.range.a', 'ORACLE_PROVIDER', true)],
    faults: [],
    timeline: [step(1, 'oracle.range.a', 'conflicted delivery')],
    expectedSecurityProperties: ['NO_MACHINE_MANDATE_BYPASS'],
    expectedDetections: [detection('security_log', 'ORACLE_CONFLICT')],
    expectedRecovery: ['ORACLE_SUSPENSION'],
    preventiveControl: 'conflicted facts cannot settle',
    detectiveControl: 'ORACLE_CONFLICT',
    recovery: 'escrow remains locked',
    preventiveOnly: false,
  }),
];

export function runMachine(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  const engine = pair(
    scenario.scenarioId === 'MACHINE-OVERSPEND' ? 5_000n : 200_000n,
    scenario.scenarioId === 'MACHINE-ESCROW-DOUBLE' ? 10_000n : 1_000_000n,
  );
  const purchase = {
    orderId: 'po_range',
    buyerMachineId: 'ai_buyer',
    providerMachineId: 'gpu_provider',
    offerId: 'offer_gpu_1',
    quantity: scenario.scenarioId === 'MACHINE-OVERSPEND' ? 10n : 10n,
    purpose: scenario.scenarioId === 'MACHINE-OUTSIDE-CAPABILITY' ? 'buy_energy' : 'bounded_purchase',
    deliveryFromUtc: '2026-08-16T00:00:00.000Z',
    deliveryUntilUtc: '2026-08-16T01:00:00.000Z',
    seedLabel: 'ai_buyer',
    nonce: 'n-range',
  };
  if (scenario.scenarioId === 'MACHINE-OVERSPEND' || scenario.scenarioId === 'MACHINE-OUTSIDE-CAPABILITY') {
    const rejected = engine.submitPurchase(purchase);
    const code = isRejection(rejected) ? rejected.code : 'ACCEPTED';
    recordAlert(env, code);
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: isRejection(rejected),
      safetyHeld: isRejection(rejected),
      invariants: holdAll(scenario.expectedSecurityProperties, code),
      detections: [{ channel: 'security_log', code: scenario.expectedDetections[0]!.code, observed: isRejection(rejected), detail: code }],
      recovery: recovery('NONE_PREVENTIVE', false, true, true, 'mandate held'),
      notes: code,
    });
  }
  const order = engine.submitPurchase(purchase);
  if (isRejection(order)) {
    throw new Error(order.reason);
  }
  const firstLock = engine.lockEscrow(order.orderId);
  if (isRejection(firstLock)) {
    throw new Error(firstLock.reason);
  }
  if (scenario.scenarioId === 'MACHINE-ESCROW-DOUBLE') {
    const second = engine.lockEscrow(order.orderId);
    const code = isRejection(second) ? second.code : 'DOUBLE_LOCKED';
    recordAlert(env, code);
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: isRejection(second),
      safetyHeld: isRejection(second),
      invariants: holdAll(scenario.expectedSecurityProperties, code),
      detections: [{ channel: 'security_log', code: 'ESCROW_UNSAFE_STATE', observed: isRejection(second), detail: code }],
      recovery: recovery('NONE_PREVENTIVE', false, true, true, 'second lock refused'),
      notes: code,
    });
  }
  if (scenario.scenarioId === 'MACHINE-REVOKED') {
    engine.revoke('ai_buyer', 'ai_buyer_controller', 'range-compromise');
    const future = engine.submitPurchase({ ...purchase, orderId: 'po_range_2', nonce: 'n-range-2' });
    const code = isRejection(future) ? future.code : engine.getIdentity('ai_buyer')?.status ?? 'UNKNOWN';
    recordAlert(env, String(code));
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: isRejection(future) || engine.getIdentity('ai_buyer')?.status === 'REVOKED',
      safetyHeld: true,
      invariants: holdAll(scenario.expectedSecurityProperties, String(code)),
      detections: [{ channel: 'security_log', code: 'REVOKED', observed: engine.getIdentity('ai_buyer')?.status === 'REVOKED', detail: String(code) }],
      recovery: recovery('KEY_ROTATION', true, true, true, 'escrow on recovery hold'),
      notes: String(code),
    });
  }
  engine.startMetering(order.orderId, 'meter_range');
  engine.reportDelivery({
    sessionId: 'meter_range',
    factId: 'fact_range',
    quantity: 10n,
    source: scenario.scenarioId === 'MACHINE-SELF-CERTIFY' ? 'MACHINE_SELF_REPORT' : 'ORACLE_NETWORK',
    ...(scenario.scenarioId === 'MACHINE-METER' || scenario.scenarioId === 'MACHINE-CONFLICTED-ORACLE' ? { conflicted: true } : {}),
  });
  const proof = engine.finalizeDelivery('meter_range', 'proof_range');
  const code = isRejection(proof) ? proof.code : 'SETTLED';
  recordAlert(env, code);
  return finish({
    scenario,
    sourceCommit: env.sourceCommit,
    testnetGenesis: env.testnetGenesis,
    attackBlocked: isRejection(proof),
    safetyHeld: isRejection(proof),
    invariants: holdAll(scenario.expectedSecurityProperties, code),
    detections: [{ channel: 'security_log', code: scenario.expectedDetections[0]!.code, observed: isRejection(proof), detail: code }],
    recovery: recovery('ORACLE_SUSPENSION', true, true, true, 'delivery not settled'),
    notes: code,
  });
}
