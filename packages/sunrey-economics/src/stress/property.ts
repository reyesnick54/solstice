/**
 * Mixed multi-subsystem property stream.
 *
 * After each operation the full economic invariant set is checked.
 */

import { createIntegratedEconomicStack } from '../../sunrey-chain/src/economics/stack.ts';
import { DeterministicRng } from '../seed.ts';
import { checkInvariants, type LabAuxState } from './invariants.ts';
import type { EconomicInvariantResult } from './types.ts';

const OPERATIONS = [
  'SUNREY_ISSUANCE',
  'MOONREY_ISSUANCE',
  'TRANSFER_FEE',
  'BURN_FEE',
  'LOCK',
  'VALIDATOR_REWARD',
  'VALIDATOR_PENALTY',
  'EXCHANGE_DVP',
  'MACHINE_ESCROW',
] as const;

export function runPropertyStream(seed = 76, steps = 12): {
  readonly steps: number;
  readonly operations: readonly string[];
  readonly invariants: readonly EconomicInvariantResult[];
  readonly held: boolean;
} {
  const rng = new DeterministicRng(seed);
  const stack = createIntegratedEconomicStack();
  stack.registerProductiveObject({
    objectId: 'obj.energy.0',
    category: 'ENERGY',
    unit: 'kWh',
    owner: 'ctl.op_0',
  });
  const operations: string[] = [];
  const aux: LabAuxState = {
    exchangeConserved: true,
    custodyReconciled: true,
    machineMandatesHold: true,
    oracleFabricated: false,
    dvpDuplicated: false,
    custodyBlindResubmit: false,
  };
  for (let step = 0; step < steps; step += 1) {
    const operation = OPERATIONS[rng.nextBounded(OPERATIONS.length)]!;
    operations.push(operation);
    switch (operation) {
      case 'SUNREY_ISSUANCE':
        stack.issueSunRey('household', 10n, `prop-sun-${step}`);
        break;
      case 'MOONREY_ISSUANCE':
        stack.issueMoonReyFromClaim({
          claimId: `claim.prop.${step}`,
          objectId: 'obj.energy.0',
          category: 'ENERGY',
          quantity: 8n,
          unit: 'kWh',
          controller: 'ctl.op_0',
          epoch: step + 1,
          providerCount: 3,
        });
        break;
      case 'TRANSFER_FEE':
      case 'BURN_FEE':
        stack.executeTransferFee({ label: `prop-fee-${step}`, amount: 2n, maxFee: 20_000n });
        break;
      case 'LOCK':
      case 'MACHINE_ESCROW':
        try {
          stack.lockNative('household', `prop-lock-${step}`, 1n, operation === 'MACHINE_ESCROW' ? 'MACHINE_ESCROW' : 'ORDER_RESERVATION');
        } catch {
          // insufficient circulating is a valid fail-closed outcome
        }
        break;
      case 'VALIDATOR_REWARD':
        stack.settleValidatorEpoch();
        break;
      case 'VALIDATOR_PENALTY':
        stack.applyValidatorPenalty('val_a', `prop-ev-${step}`);
        break;
      case 'EXCHANGE_DVP':
        stack.executeTransferFee({
          label: `prop-dvp-${step}`,
          amount: 1n,
          maxFee: 20_000n,
          exchangeDvpLegs: 2,
        });
        break;
      default:
        break;
    }
    const after = checkInvariants(stack, aux);
    if (!after.every((row) => row.held)) {
      return Object.freeze({
        steps: step + 1,
        operations: Object.freeze(operations),
        invariants: after,
        held: false,
      });
    }
  }
  return Object.freeze({
    steps,
    operations: Object.freeze(operations),
    invariants: checkInvariants(stack, aux),
    held: true,
  });
}
