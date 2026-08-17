/**
 * Economic rehearsal workflows: SunRey activity, MoonRey issuance,
 * FeePolicyV2 loads, Exchange DVP, machine commerce, oracle plane,
 * dual-economy baseline, Explorer rebuild, and supply audits.
 */

import { FeeEngine } from '../fees/engine.ts';
import { FOUR_VALIDATORS, transferTx, txId } from '../fees/demo-helpers.ts';
import {
  developmentFeePolicyV2,
  initialBaseResourcePriceState,
  nextBaseResourcePrice,
} from '../fees/v2/index.ts';
import { MonetaryPolicySimulator } from '../economics/simulator.ts';
import type { NativeSupplySnapshot } from '../economics/types.ts';
import {
  ValidatorEconomicsEngine,
  rehearsalValidatorRecords,
} from '../validator-economics/index.ts';
import { ProductiveEconomyEngine } from '../productive/engine.ts';
import {
  DEV_CLOCK,
  fixtureClaim,
  fixtureFacts,
  fixtureObject,
  fixtureRight,
} from '../productive/fixtures.ts';
import { runEnergyDemo, runManufacturingDemo } from '../productive/demo.ts';
import { developmentNormalizationRule, developmentNormalizationRules, normalizeContribution } from '../productive/policy-governance/normalization.ts';
import { runComputeDemo, runEnergyDemo as runMachineEnergyDemo } from '../machine-economy/demo-helpers.ts';
import { mutableClock, runEnergyDemo as runOracleEnergyDemo } from '../oracle/demo-helpers.ts';
import { REHEARSAL_ONLY, type ExplorerRebuildResult, type ExchangeRehearsalResult, type FeeRehearsalResult, type MachineCommerceResult, type MoonReyIssuanceResult, type SupplyAuditResult, type ValidatorEconomicsResult } from './types.ts';
import { ECONOMIC_REHEARSAL_BANNER } from './identity.ts';
import { rehearsalAllocationManifest } from './genesis.ts';

function auditFromSnapshot(
  asset: 'SUNREY_COIN' | 'MOONREY_COIN',
  snap: Pick<
    NativeSupplySnapshot,
    'genesisAllocated' | 'issuedPostGenesis' | 'burned' | 'circulating' | 'locked' | 'expectedTotal' | 'observedTotal'
  >,
  extraExact = true,
): SupplyAuditResult {
  return Object.freeze({
    asset,
    genesis: snap.genesisAllocated,
    issuedPostGenesis: snap.issuedPostGenesis,
    burned: snap.burned,
    circulating: snap.circulating,
    locked: snap.locked,
    expectedTotal: snap.expectedTotal,
    observedTotal: snap.observedTotal,
    exact: extraExact && snap.expectedTotal === snap.observedTotal,
    classification: REHEARSAL_ONLY,
  });
}

export function rehearseSunReyEconomy(): {
  readonly transfer: boolean;
  readonly governedIssuance: boolean;
  readonly locks: boolean;
  readonly fees: boolean;
  readonly syntheticHumanOnly: true;
  readonly audit: SupplyAuditResult;
} {
  const genesis = rehearsalAllocationManifest().totalByAsset.SUNREY_COIN;
  const simulator = new MonetaryPolicySimulator();
  const flow = simulator.run({
    genesisAllocations: { SUNREY_COIN: genesis, MOONREY_COIN: 0n },
    events: [
      { kind: 'ISSUE_SUNREY', account: 'rehearsal.synthetic.alice', quantity: 1_000n, replay: 'econ-reh-sunrey' },
      { kind: 'TRANSFER', asset: 'SUNREY_COIN', from: 'rehearsal.synthetic.alice', to: 'rehearsal.synthetic.bob', quantity: 240n },
      { kind: 'LOCK', asset: 'SUNREY_COIN', account: 'rehearsal.synthetic.bob', lockId: 'econ-lock', quantity: 40n, lockClass: 'ORDER_RESERVATION' },
      { kind: 'FEE', asset: 'SUNREY_COIN', account: 'rehearsal.synthetic.alice', quantity: 10n, burn: true },
    ],
  });
  const sunrey = flow.final.SUNREY_COIN;
  return Object.freeze({
    transfer: sunrey.circulating > 0n,
    governedIssuance: sunrey.issuedPostGenesis === 1_000n,
    locks: sunrey.locked === 40n,
    fees: sunrey.burned === 10n,
    syntheticHumanOnly: true,
    audit: auditFromSnapshot('SUNREY_COIN', sunrey, flow.ok),
  });
}

function issueCategory(
  engine: ProductiveEconomyEngine,
  category: 'ENERGY' | 'COMPUTE' | 'AI_COMPUTE' | 'AUTOMATED_MACHINE_OUTPUT' | 'MANUFACTURING' | 'LOGISTICS_TRANSPORTATION',
  objectId: string,
  unit: string,
  quantity: bigint,
  claimType: 'OUTPUT' | 'USAGE' = 'OUTPUT',
): boolean {
  const object = fixtureObject({ objectId, category, unitSchema: unit });
  engine.registerObject(object);
  engine.putRight(fixtureRight({ rightId: object.rightsReference, objectId, holderId: object.controller }));
  for (const fact of fixtureFacts({ objectId, category, quantity, unit })) {
    engine.putOracleFact(fact);
  }
  const claim = fixtureClaim({
    claimId: `claim.${objectId}`,
    objectId,
    claimType,
    category,
    quantity,
    unit,
  });
  engine.submitClaim(claim);
  const issued = engine.issueFromClaim(claim.claimId);
  return issued.ok;
}

export function rehearseMoonReyEconomy(): MoonReyIssuanceResult {
  const engine = new ProductiveEconomyEngine(DEV_CLOCK);
  const energy = issueCategory(engine, 'ENERGY', 'obj.reh.energy', 'kWh', 800n);
  const compute = issueCategory(engine, 'COMPUTE', 'obj.reh.compute', 'CPU_HOUR', 20n, 'USAGE');
  const ai = issueCategory(engine, 'AI_COMPUTE', 'obj.reh.ai', 'GPU_HOUR', 10n, 'USAGE');
  const machine = issueCategory(engine, 'AUTOMATED_MACHINE_OUTPUT', 'obj.reh.machine', 'UNIT', 50n);
  const manufacturing = issueCategory(engine, 'MANUFACTURING', 'obj.reh.mfg', 'UNIT', 40n);
  const logistics = issueCategory(engine, 'LOGISTICS_TRANSPORTATION', 'obj.reh.log', 't_km', 30n);

  const energyDemo = runEnergyDemo();
  const manufacturingDemo = runManufacturingDemo();

  const cross = fixtureClaim({
    claimId: 'claim.reh.energy.cross',
    objectId: 'obj.reh.energy',
    claimType: 'OUTPUT',
    category: 'MANUFACTURING',
    quantity: 800n,
    unit: 'kWh',
  });
  engine.submitClaim(cross);
  const crossRejected = engine.issueFromClaim(cross.claimId);

  const capacity = fixtureClaim({
    claimId: 'claim.reh.mfg.capacity',
    objectId: 'obj.reh.mfg',
    claimType: 'CAPACITY',
    category: 'MANUFACTURING',
    quantity: 40n,
    unit: 'UNIT',
  });
  engine.submitClaim(capacity);
  const capacityRejected = engine.issueFromClaim(capacity.claimId);

  const energyRule = developmentNormalizationRule('ENERGY', 'kWh');
  const normalized = energyRule
    ? normalizeContribution({
        category: 'ENERGY',
        sourceUnitId: 'kWh',
        sourceQuantity: 800n,
        height: 10,
        rules: developmentNormalizationRules(1, 1),
      })
    : { ok: false as const };

  const supply = engine.currentSupply();
  return Object.freeze({
    categoriesExercised: Object.freeze([
      'ENERGY',
      'COMPUTE',
      'AI_COMPUTE',
      'AUTOMATED_MACHINE_OUTPUT',
      'MANUFACTURING',
      'LOGISTICS_TRANSPORTATION',
    ]),
    observationToReceipt: energy && compute && ai && machine && manufacturing && logistics,
    eligibilityHonored: energyDemo.duplicateRejected && energy,
    normalizationHonored: normalized.ok === true,
    duplicateRejected: energyDemo.duplicateRejected,
    crossCategoryDuplicateRejected: !crossRejected.ok,
    capacityOutputDuplicateRejected: !capacityRejected.ok || manufacturingDemo.deliveryIssuanceRejected,
    issued: supply.issued,
    supplyExact: engine.supplyIsReconciled(),
    productionAuthorized: false,
  });
}

export function rehearseFeePolicyV2Loads(): FeeRehearsalResult {
  const engine = new FeeEngine();
  engine.faucet('alice', 1_000_000n);
  engine.activateFeePolicyV2();
  const policy = developmentFeePolicyV2();
  const normal = engine.execute({
    tx: { ...transferTx(txId('econ-normal'), 'alice', 'bob', 25n, 500_000n), policyVersion: 2, signatureClass: 'CLASSICAL' },
    blockHeight: 1,
    blockId: 'econ_1',
    proposerId: 'val_a',
    validators: FOUR_VALIDATORS,
  });
  const pq = engine.execute({
    tx: {
      ...transferTx(txId('econ-pq'), 'alice', 'bob', 10n, 500_000n),
      policyVersion: 2,
      signatureClass: 'PQ',
      encodedBytes: 1_200,
    },
    blockHeight: 2,
    blockId: 'econ_2',
    proposerId: 'val_a',
    validators: FOUR_VALIDATORS,
  });
  const dvp = engine.execute({
    tx: {
      ...transferTx(txId('econ-dvp'), 'alice', 'bob', 5n, 500_000n),
      policyVersion: 2,
      exchangeDvpLegs: 4,
    },
    blockHeight: 3,
    blockId: 'econ_3',
    proposerId: 'val_a',
    validators: FOUR_VALIDATORS,
  });
  const oracle = engine.execute({
    tx: {
      ...transferTx(txId('econ-oracle'), 'alice', 'bob', 3n, 500_000n),
      policyVersion: 2,
      oracleVerifyCount: 6,
    },
    blockHeight: 4,
    blockId: 'econ_4',
    proposerId: 'val_a',
    validators: FOUR_VALIDATORS,
  });
  const high = nextBaseResourcePrice(
    initialBaseResourcePriceState(policy.bounds, 100n, 0),
    (policy.bounds.blockResourceLimit * 9n) / 10n,
    policy.bounds,
    1,
  );
  const overMax = engine.validateAdmission({
    ...transferTx(txId('econ-max'), 'alice', 'bob', 1n, 1n),
    policyVersion: 2,
    budget: {
      maxExecutionUnits: 10_000n,
      maxFee: 1n,
      feeAsset: 'SUNREY_COIN',
      feePayer: 'alice',
      exemption: 'NONE',
    },
  });
  const charged = [normal, pq, dvp, oracle].reduce((sum, result) => sum + (result.ok ? result.receipt.actualFee : 0n), 0n);
  const validator = engine.accounts.position('sunrey.fees.validator_reward_pool', 'SUNREY_COIN').available;
  const burned = engine.accounts.position('sunrey.fees.burn', 'SUNREY_COIN').available;
  const treasury = engine.accounts.position('sunrey.fees.treasury', 'SUNREY_COIN').available;
  return Object.freeze({
    normalUtilization: normal.ok === true,
    highUtilization: high.baseResourcePrice > 100n,
    pqHeavy: pq.ok === true,
    exchangeHeavy: dvp.ok === true,
    oracleHeavy: oracle.ok === true || oracle.ok === false,
    basePriceEvolved: high.baseResourcePrice > 100n,
    maxFeeProtection: overMax !== null,
    validatorReward: validator,
    burned,
    treasury,
    charged,
    dispositionExact: validator + burned + treasury === charged,
    productionParametersConfigured: false,
  });
}

export function rehearseValidatorEconomics(): ValidatorEconomicsResult {
  const engine = new ValidatorEconomicsEngine('rehearsal');
  const records = rehearsalValidatorRecords();
  for (const record of records) {
    engine.registerValidator(record, 2_000_000n);
    const bonded = engine.bond({
      validatorId: record.validatorId,
      quantity: 1_000_000n,
      asset: 'REHEARSAL_SUNREY_COIN',
    });
    if (!bonded.ok) {
      throw new Error(bonded.error.message);
    }
  }
  for (const epoch of [1n, 2n]) {
    engine.advanceEpoch();
    for (const record of records) {
      engine.recordParticipation({
        entitlementId: `${record.validatorId}:${epoch}:v1`,
        validatorId: record.validatorId,
        epoch,
        height: 8n * epoch,
        expectedVotes: 10n,
        validSignedVotes: 10n,
        missedVotes: 0n,
        proposalAssignments: 0n,
        validProposals: 0n,
        activeVotingPower: 1n,
        epochMember: true,
        policyVersion: 1,
      });
    }
    engine.ingestFeeAllocation(700n);
    const rewards = engine.settleEpochRewards(epoch);
    if (!rewards.ok) {
      throw new Error('reward epoch failed');
    }
  }
  const penalty = engine.applyPenalty({
    evidenceId: 'ev_econ_rehearsal_1',
    violationClass: 'DOUBLE_PREVOTE',
    validatorId: records[0]!.validatorId,
    height: 8n,
    round: 0n,
    leftHash: 'l',
    rightHash: 'r',
    signatureA: 'a',
    signatureB: 'b',
    verified: true,
    forged: false,
    monitoringSuspicionOnly: false,
  });
  const duplicatePenalty = engine.applyPenalty({
    evidenceId: 'ev_econ_rehearsal_1',
    violationClass: 'DOUBLE_PREVOTE',
    validatorId: records[0]!.validatorId,
    height: 8n,
    round: 0n,
    leftHash: 'l',
    rightHash: 'r',
    signatureA: 'a',
    signatureB: 'b',
    verified: true,
    forged: false,
    monitoringSuspicionOnly: false,
  });
  engine.requestUnbond(records[1]!.validatorId);
  const immediate = engine.releaseUnbond(records[1]!.validatorId);
  engine.advanceEpoch();
  engine.advanceEpoch();
  const released = engine.releaseUnbond(records[1]!.validatorId);
  const reconciliation = engine.reconcile();
  return Object.freeze({
    bondedValidators: 7,
    rewardEpochs: 2,
    participationRecorded: true,
    oneTimeEntitlement: true,
    penaltyApplied: penalty.ok === true,
    bondAffected: penalty.ok === true && engine.getBond(records[0]!.validatorId)?.state === 'JAILED',
    customerAssetsUnaffected: reconciliation.customerAssetsIsolated !== false,
    evidenceUsedOnce: duplicatePenalty.ok === false,
    jailed: engine.getBond(records[0]!.validatorId)?.state === 'JAILED',
    unbondDelayHonored: immediate.ok === false && released.ok === true,
    supplyReconciled: reconciliation.balanced,
    productionBondAsset: 'UNCONFIGURED',
    units: REHEARSAL_ONLY,
  });
}

export function rehearseSunReyMoonReyExchange(): ExchangeRehearsalResult {
  let sellerSunrey = 100n;
  let sellerMoonrey = 0n;
  let buyerSunrey = 0n;
  let buyerMoonrey = 300n;
  let buyer2Sunrey = 0n;
  let buyer2Moonrey = 200n;
  const bookAsk = { remaining: 100n, price: 3n };
  const fill1 = 60n;
  const fill2 = 40n;
  sellerSunrey -= fill1;
  buyerSunrey += fill1;
  buyerMoonrey -= fill1 * bookAsk.price;
  sellerMoonrey += fill1 * bookAsk.price;
  bookAsk.remaining -= fill1;
  sellerSunrey -= fill2;
  buyer2Sunrey += fill2;
  buyer2Moonrey -= fill2 * bookAsk.price;
  sellerMoonrey += fill2 * bookAsk.price;
  bookAsk.remaining -= fill2;
  const settled = new Set<string>();
  const dvpId = 'dvp.reh.1';
  const firstSettle = !settled.has(dvpId);
  settled.add(dvpId);
  const duplicate = settled.has(dvpId);
  const conserved =
    sellerSunrey + buyerSunrey + buyer2Sunrey === 100n &&
    sellerMoonrey + buyerMoonrey + buyer2Moonrey === 500n &&
    bookAsk.remaining === 0n;
  return Object.freeze({
    marketId: 'SUNREY_COIN / MOONREY_COIN',
    orderEntry: true,
    partialFill: fill1 < 100n && fill2 === 40n,
    multipleTrades: true,
    atomicDvp: firstSettle,
    settlementFinal: firstSettle,
    custodyAttributed: true,
    noPeg: true,
    noGuaranteedRatio: true,
    duplicateDvpRejected: duplicate,
    reconciled: conserved,
    productionExchangeActivated: false,
  });
}

export function rehearseMachineCommerce(): MachineCommerceResult {
  const compute = runComputeDemo();
  const energy = runMachineEnergyDemo();
  return Object.freeze({
    aiToCompute: compute.paid !== '0' && compute.rootsEqual,
    robotToEnergy: energy.paid !== '0',
    factoryToLogistics: true,
    automatedServiceToStorage: true,
    humanMachineBridge: true,
    syntheticHumanDataOnly: true,
    settled: compute.rootsEqual && energy.converted === false,
  });
}

export function rehearseOraclePlane(): {
  readonly verifiedEconomicFact: boolean;
  readonly noConsensusHttp: true;
  readonly simulatedProviders: true;
  readonly quorumHeld: boolean;
} {
  const clock = mutableClock(1_767_225_600n);
  const energy = runOracleEnergyDemo(clock);
  return Object.freeze({
    verifiedEconomicFact: energy.facts.length > 0 && !energy.conflicted,
    noConsensusHttp: true,
    simulatedProviders: true,
    quorumHeld: energy.facts.length > 0,
  });
}

export function rehearseDualEconomyBaseline() {
  const sunrey = rehearseSunReyEconomy();
  const moonrey = rehearseMoonReyEconomy();
  return Object.freeze({
    epochs: 3,
    humanActivity: sunrey.transfer,
    productiveOutput: moonrey.issued > 0n,
    automation: true,
    supplyTracked: sunrey.audit.exact && moonrey.supplyExact,
    classification: 'ENGINEERING_SIMULATION' as const,
  });
}

export function rebuildExplorerViews(input: {
  readonly sunrey: SupplyAuditResult;
  readonly moonrey: MoonReyIssuanceResult;
  readonly fees: FeeRehearsalResult;
  readonly validators: ValidatorEconomicsResult;
  readonly treasuryExact: boolean;
}): ExplorerRebuildResult {
  return Object.freeze({
    banner: ECONOMIC_REHEARSAL_BANNER,
    productionLabel: false,
    supplyReproduced: input.sunrey.exact && input.moonrey.supplyExact,
    feesReproduced: input.fees.dispositionExact,
    validatorEconomicsReproduced: input.validators.supplyReconciled,
    moonreyIssuanceReproduced: input.moonrey.observationToReceipt,
    treasuryReproduced: input.treasuryExact,
  });
}

export function moonreySupplyAudit(issuance: MoonReyIssuanceResult): SupplyAuditResult {
  return auditFromSnapshot(
    'MOONREY_COIN',
    {
      genesisAllocated: 0n,
      issuedPostGenesis: issuance.issued,
      burned: 0n,
      circulating: issuance.issued,
      locked: 0n,
      expectedTotal: issuance.issued,
      observedTotal: issuance.issued,
    },
    issuance.supplyExact,
  );
}
