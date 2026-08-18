/**
 * Protocol-plane adapters over the reconciled Chunk 71–75 stack.
 *
 * charged fee → FeeDispositionPolicyV2 → ValidatorEconomicsEngine
 * fee burn → AssetSupplyBook FEE_BURN
 * MoonRey quantity from productive policy, authorization from
 * MonetaryIssuanceAuthority.
 */

import { createIntegratedEconomicStack, type IntegratedEconomicStack } from '../../sunrey-chain/src/economics/stack.ts';
import { moonreyIssuanceActivated } from '../../sunrey-chain/src/protocol/assets.ts';
import { PRODUCTIVE_SIM_CATEGORIES, type ProductiveSimCategory } from './ids.ts';
import { moonreyPolicyFor } from './policies.ts';
import type {
  DualEconomyScenario,
  FeeEconomicsSnapshot,
  OracleHealthSnapshot,
  ProductiveEconomyState,
  ValidatorEconomicsSnapshot,
} from './types.ts';

export type ProtocolLab = {
  readonly stack: IntegratedEconomicStack;
  issuedFingerprints: Set<string>;
  moonreyIssued: bigint;
  rejectedClaims: number;
  usableFacts: number;
  staleFacts: number;
  conflictedFacts: number;
  feeCharged: bigint;
  feeBurned: bigint;
  feeRewards: bigint;
  feeSink: bigint;
  feeTreasury: bigint;
  includedTx: number;
  skippedTx: number;
  validatorRewards: Map<string, bigint>;
  penalizedUnits: bigint;
};

const UNIT_FOR: Record<ProductiveSimCategory, string> = {
  ENERGY: 'kWh',
  COMPUTE: 'GPU_HOUR',
  AI_COMPUTE: 'GPU_HOUR',
  AUTOMATED_MACHINE_OUTPUT: 'UNIT',
  MANUFACTURING: 'UNIT',
  FOOD_AGRICULTURE: 'kg',
  WATER: 'L',
  STORAGE: 'm3_hour',
  LOGISTICS_TRANSPORTATION: 't_km',
  BANDWIDTH_COMMUNICATIONS: 'GB',
  MINERALS_RAW_MATERIALS: 'kg',
  REAL_ESTATE_USE: 'm2_hour',
  SERVICES: 'service_hour',
};

export function createProtocolLab(scenario: DualEconomyScenario): ProtocolLab {
  if (moonreyIssuanceActivated()) {
    throw new Error('dual-economy lab must not activate production MoonRey issuance');
  }
  const available = ['val_a', 'val_b', 'val_c', 'val_d'].filter((id) => !scenario.validators.unavailable.includes(id));
  const stack = createIntegratedEconomicStack({
    validatorIds: available.length > 0 ? available : ['val_a'],
    moonreyPolicy: moonreyPolicyFor(scenario),
  });
  const operators = Math.max(1, scenario.concentration.operatorCount);
  for (let index = 0; index < scenario.automation.productiveSystemCount; index += 1) {
    const category = PRODUCTIVE_SIM_CATEGORIES[index % PRODUCTIVE_SIM_CATEGORIES.length] ?? 'ENERGY';
    stack.registerProductiveObject({
      objectId: `obj.${category.toLowerCase()}.${index}`,
      category,
      unit: UNIT_FOR[category],
      owner: `ctl.op_${index % operators}`,
    });
  }
  return {
    stack,
    issuedFingerprints: new Set(),
    moonreyIssued: 0n,
    rejectedClaims: 0,
    usableFacts: 0,
    staleFacts: 0,
    conflictedFacts: 0,
    feeCharged: 0n,
    feeBurned: 0n,
    feeRewards: 0n,
    feeSink: 0n,
    feeTreasury: 0n,
    includedTx: 0,
    skippedTx: 0,
    validatorRewards: new Map(stack.feeValidators.map((validator) => [validator.validatorId, 0n])),
    penalizedUnits: 0n,
  };
}

export function issueMoonReyForEpoch(
  lab: ProtocolLab,
  scenario: DualEconomyScenario,
  productive: ProductiveEconomyState,
  epoch: number,
): bigint {
  let issued = 0n;
  const operators = Math.max(1, scenario.concentration.operatorCount);
  const usableProviders = Math.max(0, scenario.oracle.providerCount - scenario.oracle.removeProviders);
  for (let index = 0; index < scenario.automation.productiveSystemCount; index += 1) {
    const category = PRODUCTIVE_SIM_CATEGORIES[index % PRODUCTIVE_SIM_CATEGORIES.length] ?? 'ENERGY';
    const objectId = `obj.${category.toLowerCase()}.${index}`;
    const quantity = (productive.output[category] ?? 0n) / BigInt(Math.max(1, Math.ceil(scenario.automation.productiveSystemCount / PRODUCTIVE_SIM_CATEGORIES.length)));
    const claimQty = quantity < 1n ? 1n : quantity > 50_000n ? 50_000n : quantity;
    if (scenario.oracle.stale) {
      lab.staleFacts += usableProviders;
    } else if (scenario.oracle.conflict) {
      lab.conflictedFacts += usableProviders;
    } else {
      lab.usableFacts += usableProviders;
    }
    const result = lab.stack.issueMoonReyFromClaim({
      claimId: `claim.${objectId}.${epoch}`,
      objectId,
      category,
      quantity: claimQty,
      unit: UNIT_FOR[category],
      controller: `ctl.op_${index % operators}`,
      epoch,
      providerCount: usableProviders,
      stale: scenario.oracle.stale,
      conflict: scenario.oracle.conflict,
    });
    if (!result.ok) {
      lab.rejectedClaims += 1;
      continue;
    }
    if (lab.issuedFingerprints.has(result.fingerprint)) {
      throw new Error('duplicate MoonRey issuance fingerprint');
    }
    lab.issuedFingerprints.add(result.fingerprint);
    issued += result.quantity;
  }
  lab.moonreyIssued += issued;
  return issued;
}

export function runFeeEpoch(lab: ProtocolLab, scenario: DualEconomyScenario, epoch: number): void {
  const mode = scenario.validators.feeRevenueMode;
  const planned = mode === 'low' ? Math.max(1, Math.floor(scenario.fees.txPerEpoch / 3)) : mode === 'high' ? scenario.fees.txPerEpoch * 2 : scenario.fees.txPerEpoch;
  for (let index = 0; index < planned; index += 1) {
    const proposerId = lab.stack.feeValidators[epoch % lab.stack.feeValidators.length]?.validatorId;
    const executed = lab.stack.executeTransferFee({
      label: `dual-${epoch}-${index}`,
      amount: scenario.fees.transferAmount,
      maxFee: scenario.policies.feeMaxUnits,
      ...(proposerId ? { proposerId } : {}),
    });
    if (!executed.ok) {
      lab.skippedTx += 1;
      continue;
    }
    lab.includedTx += 1;
  }
  lab.feeCharged = lab.stack.feeCharged;
  lab.feeBurned = lab.stack.feeBurned;
  lab.feeRewards = lab.stack.feeRewards;
  lab.feeTreasury = lab.stack.feeTreasury;
  lab.feeSink = 0n;
  const settled = lab.stack.settleValidatorEpoch();
  if (settled.ok) {
    const share = lab.stack.feeValidators.length === 0 ? 0n : settled.paid / BigInt(lab.stack.feeValidators.length);
    for (const validator of lab.stack.feeValidators) {
      lab.validatorRewards.set(validator.validatorId, (lab.validatorRewards.get(validator.validatorId) ?? 0n) + share);
    }
  }
  if (scenario.validators.penaltyValidatorId && epoch === 1) {
    const target = lab.stack.feeValidators.some((row) => row.validatorId === scenario.validators.penaltyValidatorId)
      ? scenario.validators.penaltyValidatorId
      : lab.stack.feeValidators[0]!.validatorId;
    lab.stack.applyValidatorPenalty(target, `ev.dual.${epoch}`);
    lab.penalizedUnits = lab.stack.penalizedUnits;
  }
}

export function feeSnapshot(lab: ProtocolLab, utilizationBps: bigint): FeeEconomicsSnapshot {
  const conserved = lab.feeCharged === lab.feeBurned + lab.feeRewards + lab.feeSink + lab.feeTreasury;
  return Object.freeze({
    policyVersion: 'sunrey.fees.v2',
    charged: lab.feeCharged,
    burned: lab.feeBurned,
    validatorRewardPool: lab.feeRewards,
    networkSink: lab.feeSink,
    treasury: lab.feeTreasury,
    utilizationBps,
    includedTx: lab.includedTx,
    skippedForLimits: lab.skippedTx,
    conserved,
  });
}

export function validatorSnapshot(lab: ProtocolLab, scenario: DualEconomyScenario): ValidatorEconomicsSnapshot {
  const rewards = Object.fromEntries(lab.validatorRewards.entries());
  const recon = lab.stack.reconcile();
  return Object.freeze({
    policyVersion: 'sunrey.validator-economics.v1',
    activeCount: lab.stack.feeValidators.length,
    unavailable: scenario.validators.unavailable,
    rewards: Object.freeze(rewards),
    penalizedUnits: lab.penalizedUnits,
    feeRevenue: lab.feeCharged,
    accountingReconciled: recon.validatorRewardMatchesIngested && recon.ok,
  });
}

export function oracleSnapshot(lab: ProtocolLab, scenario: DualEconomyScenario): OracleHealthSnapshot {
  return Object.freeze({
    providers: Math.max(0, scenario.oracle.providerCount - scenario.oracle.removeProviders),
    usableFacts: lab.usableFacts,
    staleFacts: lab.staleFacts,
    conflictedFacts: lab.conflictedFacts,
    rejectedClaims: lab.rejectedClaims,
    failClosed: scenario.oracle.stale || scenario.oracle.conflict || scenario.oracle.providerCount - scenario.oracle.removeProviders < 3,
  });
}

export function moonreySupplyFromEngine(lab: ProtocolLab): { readonly issued: bigint; readonly burned: bigint; readonly locked: bigint; readonly holdings: bigint } {
  const productive = lab.stack.productive.currentSupply();
  return {
    issued: lab.stack.moonrey.issuedPostGenesis,
    burned: lab.stack.moonrey.burned,
    locked: lab.stack.moonrey.locked,
    holdings: productive.holdings,
  };
}
