/**
 * Post-stress recovery verification.
 *
 * Recoverable events must keep the same canonical state chain,
 * reconcile native supplies, and allow Explorer rebuild.
 */

import { explorerSupplyReport } from '../../../sunrey-chain/src/economics/explorer.ts';
import type { IntegratedEconomicStack } from '../../../sunrey-chain/src/economics/stack.ts';
import type { LabAuxState } from './invariants.ts';
import type { EconomicRecoveryResult, EconomicStressScenario } from './types.ts';

export function recoverFromStress(
  stack: IntegratedEconomicStack,
  scenario: EconomicStressScenario,
  aux: LabAuxState,
): EconomicRecoveryResult {
  if (!stack.finalityAvailable && scenario.recoverable) {
    stack.finalityAvailable = true;
  }
  const recon = stack.reconcile();
  const explorer = explorerSupplyReport([stack.sunrey, stack.moonrey], { SUNREY_COIN: stack.feeBurned });
  const explorerRebuilds = explorer.assets.every((row) => row.reconciliation === 'EXACT');
  const sameCanonicalStateChain = recon.ok && aux.exchangeConserved && aux.custodyReconciled;
  const unresolved = !sameCanonicalStateChain || !explorerRebuilds;
  return Object.freeze({
    attempted: scenario.recoverable,
    recoveredAutomatically: scenario.recoverable && sameCanonicalStateChain && !unresolved,
    requiredOperatorAction: !stack.finalityAvailable || unresolved,
    sameCanonicalStateChain,
    explorerRebuilds,
    unresolvedFinding: unresolved,
    detail: recon.ok
      ? 'canonical supplies, fees, validator entitlements, and Explorer rebuild'
      : 'reconciliation incomplete after recovery',
  });
}
