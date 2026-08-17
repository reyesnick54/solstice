/**
 * Protocol-plane adapters: MoonRey issuance, native fees, validators.
 *
 * MoonRey issuance always flows through ProductiveEconomyEngine and
 * oracle-fact quorum. Fees use FeeEngine. Validator rewards/penalties
 * stay on the fee/accountability accounting path.
 */

import { FeeEngine, type ValidatorDescriptor } from '../../sunrey-chain/src/fees/engine.ts';
import { FeeMempool } from '../../sunrey-chain/src/fees/mempool.ts';
import { FOUR_VALIDATORS, transferTx, txId } from '../../sunrey-chain/src/fees/demo-helpers.ts';
import { developmentBlockLimits } from '../../sunrey-chain/src/fees/policy.ts';
import { ProductiveEconomyEngine } from '../../sunrey-chain/src/productive/engine.ts';
import { fixtureClaim, fixtureFacts, fixtureObject, fixtureRight } from '../../sunrey-chain/src/productive/fixtures.ts';
import { moonreyIssuanceActivated } from '../../sunrey-chain/src/protocol/assets.ts';
import { PRODUCTIVE_SIM_CATEGORIES, type ProductiveSimCategory } from './ids.ts';
import { claimCategory } from './layers.ts';
import { moonreyPolicyFor } from './policies.ts';
import { mulBps } from './seed.ts';
import type {
  DualEconomyScenario,
  FeeEconomicsSnapshot,
  OracleHealthSnapshot,
  ProductiveEconomyState,
  ValidatorEconomicsSnapshot,
} from './types.ts';

export type ProtocolLab = {
  readonly productive: ProductiveEconomyEngine;
  readonly fees: FeeEngine;
  readonly mempool: FeeMempool;
  readonly validators: ValidatorDescriptor[];
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
  const productive = new ProductiveEconomyEngine(
    { height: 10, blockTimeUnixSeconds: 1_800_000_000n, blockId: 'blk_dual_10' },
    [moonreyPolicyFor(scenario)],
  );
  const operators = Math.max(1, scenario.concentration.operatorCount);
  for (let index = 0; index < scenario.automation.productiveSystemCount; index += 1) {
    const category = PRODUCTIVE_SIM_CATEGORIES[index % PRODUCTIVE_SIM_CATEGORIES.length] ?? 'ENERGY';
    const operator = `ctl.op_${index % operators}`;
    const objectId = `obj.${category.toLowerCase()}.${index}`;
    productive.registerObject(fixtureObject({ objectId, category: claimCategory(category), unitSchema: UNIT_FOR[category], owner: operator }));
    productive.putRight(fixtureRight({ rightId: `right.${objectId}`, objectId, holderId: operator }));
  }
  const fees = new FeeEngine();
  fees.faucet('household', 5_000_000n);
  fees.faucet('community', 2_000_000n);
  const validators = FOUR_VALIDATORS.filter((validator) => !scenario.validators.unavailable.includes(validator.validatorId)).map((validator) => ({
    ...validator,
  }));
  if (validators.length === 0) {
    validators.push({ validatorId: 'val_a', votingPower: 1n });
  }
  return {
    productive,
    fees,
    mempool: new FeeMempool(fees),
    validators,
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
    validatorRewards: new Map(validators.map((validator) => [validator.validatorId, 0n])),
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
    const facts = fixtureFacts({
      objectId,
      category: claimCategory(category),
      quantity: claimQty,
      unit: UNIT_FOR[category],
      count: usableProviders,
      ...(scenario.oracle.stale ? { quality: 100n, validUntil: 1_799_000_100n } : {}),
      conflicted: scenario.oracle.conflict,
    });
    for (const fact of facts) {
      lab.productive.putOracleFact(fact);
      if (fact.status === 'CONFLICTED') {
        lab.conflictedFacts += 1;
      } else if (scenario.oracle.stale) {
        lab.staleFacts += 1;
      } else {
        lab.usableFacts += 1;
      }
    }
    const claimId = `claim.${objectId}.${epoch}`;
    lab.productive.submitClaim(
      fixtureClaim({
        claimId,
        objectId,
        claimType: 'OUTPUT',
        category: claimCategory(category),
        quantity: claimQty,
        unit: UNIT_FOR[category],
        controller: `ctl.op_${index % operators}`,
        factCount: usableProviders,
        epoch,
      }),
    );
    const result = lab.productive.issueFromClaim(claimId);
    if (!result.ok) {
      lab.rejectedClaims += 1;
      continue;
    }
    if (lab.issuedFingerprints.has(result.receipt.fingerprint)) {
      throw new Error('duplicate MoonRey issuance fingerprint');
    }
    lab.issuedFingerprints.add(result.receipt.fingerprint);
    issued += result.receipt.moonreyQuantity;
  }
  lab.moonreyIssued += issued;
  return issued;
}

export function runFeeEpoch(lab: ProtocolLab, scenario: DualEconomyScenario, epoch: number): void {
  const mode = scenario.validators.feeRevenueMode;
  const planned = mode === 'low' ? Math.max(1, Math.floor(scenario.fees.txPerEpoch / 3)) : mode === 'high' ? scenario.fees.txPerEpoch * 2 : scenario.fees.txPerEpoch;
  const limits = developmentBlockLimits();
  let admittedCount = 0;
  for (let index = 0; index < planned; index += 1) {
    const tx = transferTx(txId(`dual-${epoch}-${index}`), 'household', 'community', scenario.fees.transferAmount, scenario.policies.feeMaxUnits, scenario.policies.feeMaxUnits);
    if (lab.mempool.admit(tx) === null) {
      admittedCount += 1;
    } else {
      lab.skippedTx += 1;
    }
  }
  const selected = lab.mempool.selectForBlock(limits);
  lab.skippedTx += Math.max(0, admittedCount - selected.length);
  const proposer = lab.validators[epoch % lab.validators.length];
  if (!proposer) {
    return;
  }
  for (const tx of selected) {
    const executed = lab.fees.execute({
      tx,
      blockHeight: 10 + epoch,
      blockId: `blk_dual_${10 + epoch}`,
      proposerId: proposer.validatorId,
      validators: lab.validators,
    });
    if (!executed.ok) {
      lab.skippedTx += 1;
      continue;
    }
    lab.includedTx += 1;
    lab.feeCharged += executed.receipt.actualFee;
    lab.feeBurned += executed.receipt.disposition.burned;
    lab.feeRewards += executed.receipt.disposition.validatorRewardPool;
    lab.feeSink += executed.receipt.disposition.networkSink;
    lab.feeTreasury += executed.receipt.disposition.treasury;
  }
  lab.mempool.removeCommitted(selected.map((tx) => tx.transactionId));
  for (const validator of lab.validators) {
    const claimed = lab.fees.claimRewards(validator.validatorId, 'SUNREY_COIN');
    lab.validatorRewards.set(validator.validatorId, (lab.validatorRewards.get(validator.validatorId) ?? 0n) + claimed);
  }
  if (scenario.validators.penaltyValidatorId && epoch === 1) {
    const current = lab.validatorRewards.get(scenario.validators.penaltyValidatorId) ?? 0n;
    const penalty = mulBps(current + 1_000n, scenario.validators.penaltyBps);
    lab.penalizedUnits += penalty;
    lab.validatorRewards.set(scenario.validators.penaltyValidatorId, current > penalty ? current - penalty : 0n);
  }
}

export function feeSnapshot(lab: ProtocolLab, utilizationBps: bigint): FeeEconomicsSnapshot {
  const conserved = lab.feeCharged === lab.feeBurned + lab.feeRewards + lab.feeSink + lab.feeTreasury;
  return Object.freeze({
    policyVersion: 'sunrey.fees.development.v1',
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
  const rewardSum = [...lab.validatorRewards.values()].reduce((sum, value) => sum + value, 0n);
  return Object.freeze({
    policyVersion: 'sunrey.validator-economics.simulation.v1',
    activeCount: lab.validators.length,
    unavailable: scenario.validators.unavailable,
    rewards: Object.freeze(rewards),
    penalizedUnits: lab.penalizedUnits,
    feeRevenue: lab.feeCharged,
    accountingReconciled: rewardSum + lab.penalizedUnits === lab.feeRewards || lab.feeRewards >= rewardSum,
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
  return lab.productive.currentSupply();
}
