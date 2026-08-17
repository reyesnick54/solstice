/**
 * Machine-account integration with Chunk 45.
 *
 * The wallet layer must not allow machines to bypass
 * MachineSpendingMandate / MachineResourceMandate enforcement.
 */

import { MachineEconomyEngine } from '../machine-economy/index.ts';
import type { MachineEconomicIdentity } from '../machine-economy/types.ts';
import type { NativeAssetId } from '../protocol/assets.ts';
import type { BlockchainAccount, WalletRejection } from './types.ts';

export function assertMachineMaySpend(input: {
  readonly engine: MachineEconomyEngine;
  readonly account: BlockchainAccount;
  readonly machineId: string;
  readonly assetId: NativeAssetId;
  readonly amount: bigint;
  readonly purpose: string;
}): { readonly ok: true; readonly identity: MachineEconomicIdentity } | WalletRejection {
  if (input.account.accountType !== 'MACHINE_ACCOUNT') {
    return { ok: false, code: 'MACHINE_MANDATE_BYPASS', detail: 'machine mandate check requires a MACHINE_ACCOUNT' };
  }
  const identity = input.engine.getIdentity(input.machineId);
  if (!identity) {
    return { ok: false, code: 'MACHINE_MANDATE_BYPASS', detail: 'machine identity is not registered' };
  }
  if (identity.status !== 'ACTIVE') {
    return { ok: false, code: 'MACHINE_MANDATE_BYPASS', detail: 'machine identity is not active' };
  }
  const mandate = identity.spendingMandate;
  if (!mandate) {
    return { ok: false, code: 'MACHINE_MANDATE_BYPASS', detail: 'machine has no spending mandate' };
  }
  if (!mandate.allowedAssetIds.includes(input.assetId)) {
    return { ok: false, code: 'MACHINE_MANDATE_BYPASS', detail: 'asset is outside the machine spending mandate' };
  }
  if (input.amount > mandate.maxPerTransaction) {
    return { ok: false, code: 'MACHINE_MANDATE_BYPASS', detail: 'amount exceeds machine maxPerTransaction' };
  }
  if (!mandate.purposeConstraints.includes(input.purpose) && mandate.purposeConstraints.length > 0) {
    return { ok: false, code: 'MACHINE_MANDATE_BYPASS', detail: 'purpose is outside the machine mandate' };
  }
  return { ok: true, identity };
}
