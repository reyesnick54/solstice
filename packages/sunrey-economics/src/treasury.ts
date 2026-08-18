/**
 * Chunk 75 long-horizon hook: model protocol treasury across abstract epochs.
 */

import { disposeFeeV2, developmentFeeDispositionPolicyV2 } from '../../sunrey-chain/src/fees/v2/disposition.ts';
import { ProtocolTreasuryEngine } from '../../sunrey-chain/src/economics/treasury/engine.ts';
import { ENGINEERING_SIMULATION } from '../../sunrey-chain/src/economics/types.ts';

export function modelTreasuryAcrossEpochs(epochs: number, feeIncome: bigint): {
  readonly classification: typeof ENGINEERING_SIMULATION;
  readonly epochs: number;
  readonly feeTreasuryInflow: bigint;
  readonly reconciled: boolean;
  readonly productionTreasuryInactive: true;
} {
  const engine = new ProtocolTreasuryEngine();
  let inflow = 0n;
  for (let epoch = 1; epoch <= epochs; epoch += 1) {
    engine.advance(BigInt(epoch), BigInt(epoch * 10));
    const disposition = disposeFeeV2(developmentFeeDispositionPolicyV2(), 'SUNREY_COIN', feeIncome);
    const funded = engine.applyFeeDispositionV2(disposition, `dual-fee-${epoch}`, BigInt(epoch), BigInt(epoch * 10));
    if (funded.ok) {
      inflow += funded.value.quantity;
    }
  }
  return Object.freeze({
    classification: ENGINEERING_SIMULATION,
    epochs,
    feeTreasuryInflow: inflow,
    reconciled: engine.reconcile().ok,
    productionTreasuryInactive: true,
  });
}
