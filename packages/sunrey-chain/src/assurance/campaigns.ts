import { createHash } from 'node:crypto';

import { FeeEngine } from '../fees/engine.ts';
import { transferTx, txId } from '../fees/demo-helpers.ts';
import { applyBurn, applyIssuance, emptyMoonReySupply, supplyReconciles } from '../productive/supply.ts';
import { evaluateIssuanceFormula } from '../productive/formula.ts';
import { MachineEconomyEngine, isRejection } from '../machine-economy/engine.ts';
import { developmentPorts } from '../machine-economy/ports.ts';
import { consensusCampaign, runSignerSafetySequence } from './consensus.ts';
import { nativeAssetInvariantProperties } from './properties.ts';
import { SeededRng } from './rng.ts';
import type { CampaignReport, FuzzProfile } from './types.ts';

function replicaRoot(label: string, payload: string): string {
  return createHash('sha256').update(label).update(payload).digest('hex');
}

export function runEconomicCampaign(seed: number, profile: FuzzProfile): CampaignReport {
  const rng = new SeededRng(seed);
  const replicas = Array.from({ length: profile.replicaCount }, () => new FeeEngine());
  for (const engine of replicas) {
    engine.faucet('alice', 5_000_000n);
    engine.faucet('bob', 1_000_000n);
  }
  let supply = emptyMoonReySupply();
  const machine = new MachineEconomyEngine(developmentPorts());
  machine.creditDevelopmentUnits('human_owner_1', 'SUNREY_COIN', 100_000n);
  const registered = machine.register({
    machineId: 'machine.campaign',
    machineType: 'DEVICE',
    ownerActor: 'human_owner_1',
    controllerActor: 'human_controller_1',
    hardwareIdentityRef: 'hw.campaign',
    softwareModelRef: 'model.campaign',
    firmwareHash: 'fw',
    modelHash: 'md',
    jurisdiction: 'SIM-DEV',
    seedLabel: 'machine.campaign',
  });
  if (isRejection(registered)) {
    throw new Error(registered.reason);
  }
  nativeAssetInvariantProperties(rng.child('assets'), profile.campaignOps);
  let operations = 0;
  for (let i = 0; i < profile.campaignOps; i += 1) {
    const kind = rng.pick(['transfer', 'issuance', 'burn', 'machine'] as const);
    if (kind === 'transfer') {
      const amount = rng.bigint(1n, 50n);
      const tx = transferTx(txId(`econ-${seed}-${i}`), 'alice', 'bob', amount, 4_000n);
      const roots: string[] = [];
      for (const engine of replicas) {
        const cloneTx = { ...tx, transactionId: tx.transactionId };
        engine.execute({
          tx: cloneTx,
          blockHeight: i + 1,
          blockId: `blk_${i}`,
          proposerId: 'val_a',
          validators: [
            { validatorId: 'val_a', votingPower: 1n },
            { validatorId: 'val_b', votingPower: 1n },
            { validatorId: 'val_c', votingPower: 1n },
            { validatorId: 'val_d', votingPower: 1n },
          ],
        });
        roots.push(
          replicaRoot(
            'fee',
            `${engine.accounts.position('alice', 'SUNREY_COIN').available}:${engine.accounts.position('bob', 'SUNREY_COIN').available}`,
          ),
        );
      }
      if (roots.some((root) => root !== roots[0])) {
        throw new Error(`state-root divergence at economic op ${i}`);
      }
    } else if (kind === 'issuance') {
      const issued = evaluateIssuanceFormula({
        eligibleQuantity: rng.bigint(10n, 400n),
        categoryWeight: 1_000_000n,
        claimTypeWeight: 1_000_000n,
        qualityFactor: 1_000_000n,
        roundingMode: 'FLOOR',
        maximumIssuance: 200n,
      }).moonreyQuantity;
      if (issued > 0n) {
        supply = applyIssuance(supply, issued);
      }
    } else if (kind === 'burn' && supply.holdings > 0n) {
      supply = applyBurn(supply, 1n);
    } else {
      machine.refuseAuthority('machine.campaign', 'BECOME_GOVERNOR');
    }
    if (!supplyReconciles(supply)) {
      throw new Error('economic campaign supply drift');
    }
    operations += 1;
  }
  const stateRoots = replicas.map((engine) =>
    replicaRoot(
      'final',
      `${engine.accounts.position('alice', 'SUNREY_COIN').available}:${supply.holdings}`,
    ),
  );
  if (stateRoots.some((root) => root !== stateRoots[0])) {
    throw new Error('replica state roots diverged');
  }
  return {
    name: 'economic',
    seed,
    operations,
    ok: true,
    stateRoots,
    notes: `mixed SunRey/MoonRey/fee/machine ops under ${profile.name}`,
  };
}

export function runConsensusCampaign(seed: number, profile: FuzzProfile): CampaignReport {
  const rng = new SeededRng(seed);
  const safety = runSignerSafetySequence(rng.child('signer'), Math.min(profile.consensusEvents, 48));
  const campaign = consensusCampaign(rng.child('bft'), profile.consensusEvents);
  return {
    name: 'consensus',
    seed,
    operations: profile.consensusEvents,
    ok: true,
    stateRoots: [`finalized:${campaign.finalized}`, `conflicts:${safety.conflicts}`],
    notes: 'reorder/duplicate/delay/restart/one-Byzantine; no conflicting finality',
  };
}
