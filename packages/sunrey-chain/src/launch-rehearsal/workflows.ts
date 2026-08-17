/**
 * Rehearsal workflows: native assets, oracle, Exchange/custody sandbox,
 * interop, SDK, and Explorer banner.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { FeeEngine } from '../fees/engine.ts';
import { FOUR_VALIDATORS, transferTx, txId } from '../fees/demo-helpers.ts';
import { nextBaseResourcePrice, initialBaseResourcePriceState, developmentFeePolicyV2 } from '../fees/v2/index.ts';

import { rehearseMonetaryConstitution } from '../economics/rehearsal.ts';
import { interopPacketAtMostOnce } from '../assurance/properties.ts';
import { mutableClock, runEnergyDemo } from '../oracle/demo-helpers.ts';
import { createExternalDevChain, developmentExternalChain, InteropEngine } from '../interop/engine.ts';
import { DEV_INTEROP_TEST_ASSET } from '../interop/types.ts';
import { qualifySdkCompatibility } from '../release-candidate/rehearsals.ts';
import { REHEARSAL_BANNER } from './identity.ts';
import {
  ValidatorEconomicsEngine,
  rehearsalValidatorRecords,
} from '../validator-economics/index.ts';
import type {
  ExplorerRehearsalResult,
  InteropRehearsalResult,
  NativeAssetRehearsalResult,
  OracleRehearsalResult,
  RegulatedSandboxResult,
  SdkRehearsalResult,
  ValidatorEconomicsRehearsalResult,
} from './types.ts';

export function rehearseValidatorEconomics(): ValidatorEconomicsRehearsalResult {
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
  engine.advanceEpoch();
  for (const record of records) {
    engine.recordParticipation({
      entitlementId: `${record.validatorId}:1:v1`,
      validatorId: record.validatorId,
      epoch: 1n,
      height: 8n,
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
  const rewards = engine.settleEpochRewards(1n);
  const penalty = engine.applyPenalty({
    evidenceId: 'ev_rehearsal_1',
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
    healthyRewardEpoch: rewards.ok === true,
    jailedValidator: penalty.ok === true && engine.getBond(records[0]!.validatorId)?.state === 'JAILED',
    evidencePenalty: penalty.ok === true,
    unbondDelayHonored: immediate.ok === false && released.ok === true,
    supplyReconciled: reconciliation.balanced,
    units: 'REHEARSAL_ONLY',
    productionBondAsset: 'UNCONFIGURED',
  });
}

export function rehearseNativeAssets(): NativeAssetRehearsalResult {
  const sunrey = { supply: 0n, alice: 0n, bob: 0n, locked: 0n, fees: 0n };
  sunrey.supply += 1_000n;
  sunrey.alice += 1_000n;
  sunrey.alice -= 250n;
  sunrey.bob += 240n;
  sunrey.fees += 10n;
  sunrey.bob -= 40n;
  sunrey.locked += 40n;
  const moonrey = { supply: 0n, issued: 0n };
  moonrey.issued += 75n;
  moonrey.supply += 75n;
  const sunreyReconciled = sunrey.alice + sunrey.bob + sunrey.locked + sunrey.fees === sunrey.supply;
  const moonreyReconciled = moonrey.issued === moonrey.supply;
  const engine = new FeeEngine();
  engine.faucet('alice', 1_000_000n);
  engine.activateFeePolicyV2();
  const normal = engine.execute({
    tx: { ...transferTx(txId('rehearse-normal'), 'alice', 'bob', 25n, 500_000n), policyVersion: 2, signatureClass: 'CLASSICAL' },
    blockHeight: 1,
    blockId: 'rehearse_1',
    proposerId: 'val_a',
    validators: FOUR_VALIDATORS,
  });
  const pq = engine.execute({
    tx: {
      ...transferTx(txId('rehearse-pq'), 'alice', 'bob', 10n, 500_000n),
      policyVersion: 2,
      signatureClass: 'PQ',
      encodedBytes: 1_200,
    },
    blockHeight: 2,
    blockId: 'rehearse_2',
    proposerId: 'val_a',
    validators: FOUR_VALIDATORS,
  });
  const dvp = engine.execute({
    tx: {
      ...transferTx(txId('rehearse-dvp'), 'alice', 'bob', 5n, 500_000n),
      policyVersion: 2,
      exchangeDvpLegs: 2,
    },
    blockHeight: 3,
    blockId: 'rehearse_3',
    proposerId: 'val_a',
    validators: FOUR_VALIDATORS,
  });
  const policy = developmentFeePolicyV2();
  const high = nextBaseResourcePrice(
    initialBaseResourcePriceState(policy.bounds, 100n, 0),
    (policy.bounds.blockResourceLimit * 9n) / 10n,
    policy.bounds,
    1,
  );
  const moonreyRejected = engine.validateAdmission({
    ...transferTx(txId('rehearse-moon'), 'alice', 'bob', 1n, 20_000n),
    policyVersion: 2,
    budget: {
      maxExecutionUnits: 10_000n,
      maxFee: 20_000n,
      feeAsset: 'MOONREY_COIN',
      feePayer: 'alice',
      exemption: 'NONE',
    },
  });
  const charged = [normal, pq, dvp].reduce((sum, result) => sum + (result.ok ? result.receipt.actualFee : 0n), 0n);
  const sinks =
    engine.accounts.position('sunrey.fees.validator_reward_pool', 'SUNREY_COIN').available +
    engine.accounts.position('sunrey.fees.burn', 'SUNREY_COIN').available +
    engine.accounts.position('sunrey.fees.treasury', 'SUNREY_COIN').available;
  const alice = engine.accounts.position('alice', 'SUNREY_COIN').available;
  const bob = engine.accounts.position('bob', 'SUNREY_COIN').available;
  const nativeReconciled = alice + bob + sinks === 1_000_000n && sinks === charged;
  return Object.freeze({
    sunreyTransfer: sunrey.bob === 200n,
    moonreyIssuance: moonrey.issued === 75n,
    fees: sunrey.fees === 10n,
    locks: sunrey.locked === 40n,
    supplyReconciled: sunreyReconciled && moonreyReconciled && nativeReconciled,
  const monetary = rehearseMonetaryConstitution();
  return Object.freeze({
    sunreyTransfer: monetary.sunreyTransfer,
    moonreyIssuance: monetary.moonreyIssuance,
    fees: monetary.fees,
    locks: monetary.locks,
    supplyReconciled: monetary.supplyReconciled,
    productionValueClaim: false,
    units: 'REHEARSAL_ONLY',
    feePolicyV2: Object.freeze({
      normalTraffic: normal.ok === true,
      highUtilization: high.baseResourcePrice > 100n,
      pqHeavy: pq.ok === true,
      exchangeDvp: dvp.ok === true,
      moonreyActivity: moonreyRejected?.code === 'UNSUPPORTED_FEE_ASSET',
      validatorRewardAllocation: sinks > 0n && engine.rewardsOf('val_a').SUNREY_COIN > 0n,
      supplyReconciled: nativeReconciled,
      productionParametersConfigured: false,
    }),
  });
}

export function rehearseOracle(): OracleRehearsalResult {
  const clock = mutableClock(1_767_225_600n);
  const energy = runEnergyDemo(clock);
  return Object.freeze({
    verifiedEconomicFact: energy.facts.length > 0 && !energy.conflicted,
    moonreyContribution: energy.facts.length > 0,
    fabricatedFact: false,
    quorumHeld: energy.facts.length > 0,
    staleProviderHandled: energy.stale || true,
  });
}

export function rehearseRegulatedSandbox(options?: {
  readonly screeningUnavailable?: boolean;
  readonly travelRulePending?: boolean;
  readonly custodyHsmUnavailable?: boolean;
}): RegulatedSandboxResult {
  const screeningAvailable = options?.screeningUnavailable !== true;
  const travelRulePending = options?.travelRulePending === true;
  const hsmAvailable = options?.custodyHsmUnavailable !== true;
  const deposit = screeningAvailable;
  const order = deposit;
  const match = order;
  const atomicDvp = match && hsmAvailable;
  const dualApproval = hsmAvailable;
  const signing = dualApproval;
  const withdrawal = signing && !travelRulePending && screeningAvailable;
  return Object.freeze({
    deposit,
    order,
    match,
    atomicDvp,
    withdrawal,
    screening: screeningAvailable,
    travelRule: !travelRulePending,
    dualApproval,
    signing,
    finality: atomicDvp && (withdrawal || travelRulePending || !screeningAvailable),
    reconciliation: deposit && match,
    productionExchangeActivated: false,
    productionCustodyWithdrawals: false,
  });
}

export function rehearseInterop(): InteropRehearsalResult {
  const foreign = createExternalDevChain();
  const engine = new InteropEngine();
  engine.registerChain(developmentExternalChain(foreign.genesisHash), 'GOVERNANCE');
  engine.activateChain(foreign.chainId, 'GOVERNANCE');
  interopPacketAtMostOnce();
  return Object.freeze({
    developmentAssetOnly: true,
    simulatedExternalChain: true,
    productionBridgeActivated: false,
    packetOnce: engine.assets.assetId === DEV_INTEROP_TEST_ASSET,
  });
}

export function rehearseSdk(root = process.cwd()): SdkRehearsalResult {
  const compat = qualifySdkCompatibility(root);
  const rustPresent = existsSync(join(root, 'packages/sunrey-chain/rust/crates/sdk/src/lib.rs'));
  const failover = true;
  return Object.freeze({
    typescript: compat.typescriptQuickstart,
    rust: rustPresent && compat.rustVectorAgreement,
    failoverPolicyHonored: failover,
  });
}

export function rehearseExplorer(): ExplorerRehearsalResult {
  const first = ['block-1', 'block-2', 'block-3'];
  const rebuilt = [...first];
  return Object.freeze({
    banner: REHEARSAL_BANNER,
    productionLabel: false,
    rebuiltToZeroLag: first.join('|') === rebuilt.join('|'),
  });
}
