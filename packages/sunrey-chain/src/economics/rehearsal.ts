/**
 * Chunk 70 launch-rehearsal adapter over the real monetary constitution.
 *
 * Rehearsal supply remains REHEARSAL_ONLY and does not become a
 * production allocation.
 */

import { emptyAllocationManifest } from '../mainnet/allocation.ts';
import { nativeAssetConstitution } from './constitution.ts';
import { verifyGenesisAllocationManifest } from './genesis.ts';
import { MonetaryPolicySimulator } from './simulator.ts';
import { REHEARSAL_ONLY, type NativeAssetConstitution } from './types.ts';

export function rehearsalMonetaryConstitution(): NativeAssetConstitution {
  return nativeAssetConstitution('PRODUCTION_CANDIDATE');
}

export function rehearseMonetaryConstitution() {
  const constitution = rehearsalMonetaryConstitution();
  const genesis = verifyGenesisAllocationManifest(emptyAllocationManifest(), {
    rehearsalMigration: false,
  });
  const simulator = new MonetaryPolicySimulator();
  const rehearsalFlow = simulator.run({
    genesisAllocations: { SUNREY_COIN: 0n, MOONREY_COIN: 0n },
    events: [
      { kind: 'ISSUE_SUNREY', account: 'rehearsal.alice', quantity: 1_000n, replay: 'rehearsal-sunrey' },
      { kind: 'TRANSFER', asset: 'SUNREY_COIN', from: 'rehearsal.alice', to: 'rehearsal.bob', quantity: 240n },
      { kind: 'LOCK', asset: 'SUNREY_COIN', account: 'rehearsal.bob', lockId: 'reh-lock', quantity: 40n, lockClass: 'ORDER_RESERVATION' },
      { kind: 'FEE', asset: 'SUNREY_COIN', account: 'rehearsal.alice', quantity: 10n, burn: true },
      { kind: 'ISSUE_MOONREY', account: 'rehearsal.producer', quantity: 75n, replay: 'rehearsal-moonrey', contributionId: 'contrib_rehearsal_1' },
    ],
  });
  return Object.freeze({
    constitutionId: constitution.constitutionId,
    policyVersion: constitution.assets[0]!.policyVersion.versionId,
    genesisOk: genesis.ok,
    zeroProductionGenesis: true,
    rehearsalSupplyClass: REHEARSAL_ONLY,
    productionAllocation: false,
    sunreyTransfer: rehearsalFlow.final.SUNREY_COIN.circulating > 0n,
    moonreyIssuance: rehearsalFlow.final.MOONREY_COIN.issuedPostGenesis === 75n,
    fees: rehearsalFlow.final.SUNREY_COIN.burned === 10n,
    locks: rehearsalFlow.final.SUNREY_COIN.locked === 40n,
    supplyReconciled: rehearsalFlow.ok,
    productionValueClaim: false,
    units: REHEARSAL_ONLY,
    classification: rehearsalFlow.classification,
  });
}
