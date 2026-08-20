import type { NativeCustodyAssetId } from '../native-assets.ts';
import type { ProviderOperationalBalance } from './types.ts';

export type DualAssetReconciliationScope = {
  readonly chainQuantity: bigint;
  readonly providerQuantity: bigint;
  readonly internalAttribution: bigint;
  readonly exchangeReserved: bigint;
  readonly pendingWithdrawals: bigint;
  readonly assetId: NativeCustodyAssetId;
};

export type CustodyCandidateReconciliationReport = {
  readonly outcome: 'MATCHED' | 'MISMATCH';
  readonly notes: readonly string[];
  readonly autoCorrectedLedger: false;
  readonly autoChangedChainState: false;
  readonly providerBalanceIsAssetSupplyBook: false;
  readonly providerBalanceIsNativeSupply: false;
};

export function reconcileCustodyCandidate(scopes: readonly DualAssetReconciliationScope[]): CustodyCandidateReconciliationReport {
  const notes: string[] = [];
  for (const scope of scopes) {
    const expected = scope.internalAttribution + scope.exchangeReserved + scope.pendingWithdrawals;
    if (scope.chainQuantity !== scope.internalAttribution) {
      notes.push(
        `${scope.assetId} chain ${scope.chainQuantity} attribution ${scope.internalAttribution} mismatch`,
      );
    }
    if (scope.providerQuantity !== expected && scope.providerQuantity !== scope.chainQuantity) {
      notes.push(`${scope.assetId} provider operational balance ${scope.providerQuantity} does not match chain`);
    }
  }
  return Object.freeze({
    outcome: notes.length === 0 ? 'MATCHED' : 'MISMATCH',
    notes: Object.freeze(notes),
    autoCorrectedLedger: false,
    autoChangedChainState: false,
    providerBalanceIsAssetSupplyBook: false,
    providerBalanceIsNativeSupply: false,
  });
}

export function asProviderOperationalBalance(
  assetId: NativeCustodyAssetId,
  quantity: bigint,
): ProviderOperationalBalance {
  return Object.freeze({
    assetId,
    quantity,
    isAssetSupplyBook: false,
    isNativeSupply: false,
    isCustomerFiatLedgerBalance: false,
    reconciliationEvidenceOnly: true,
  });
}
