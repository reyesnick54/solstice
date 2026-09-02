/**
 * Wave 8 — money integration platform.
 *
 * Connects chain wallets, custody read models, ledger postings, and exchange
 * settlement without allowing any secondary system to become a second ledger.
 */

import type { UtcInstant } from '../../../../../packages/domain/src/time.ts';
import type { WalletProductService } from '../../../../../packages/custody/src/product/service.ts';
import type { MoneyReconciliationReport } from '../../../../../packages/custody/src/product/money-reconciliation.ts';
import { reconcileMoneySurfaces } from '../../../../../packages/custody/src/product/money-reconciliation.ts';
import {
  mergeUnifiedHistory,
  fromWalletTransaction,
  fromExchangeSettlement,
  type UnifiedTransactionHistoryItem,
} from '../../../../../packages/custody/src/product/unified-transaction-history.ts';
import {
  describeBlockchainAccount,
  describeCustodialWallet,
  describeExchangeAccount,
  type WalletArchitectureDescriptor,
} from '../../../../../packages/custody/src/product/wallet-architecture.ts';
import type { NativeClearingEngine } from '../../../../../packages/sunrey-exchange/src/native-clearing/engine.ts';
import {
  mapNativeSettlementToWave8,
  wave8SettlementRecord,
  type Wave8SettlementRecord,
} from '../../../../../packages/sunrey-exchange/src/settlement-lifecycle.ts';
import { marketPriceBoundaryProof } from '../../../../../packages/sunrey-exchange/src/market-price-boundary.ts';
import {
  MOONREY_COIN_NATIVE_ASSET_ID,
  SUNREY_COIN_NATIVE_ASSET_ID,
} from '../../../../../packages/sunrey-exchange/src/ids.ts';
import type { WalletEngine } from '../../../../../packages/sunrey-chain/src/wallet/engine.ts';
import { canonicalChainBalance } from '../../../../../packages/sunrey-chain/src/wallet/balance-projection.ts';
import {
  executeNativeTransferLifecycle,
  type NativeTransferReceipt,
} from '../../../../../packages/sunrey-chain/src/wallet/transfer-lifecycle.ts';

export type MoneyIntegrationPlatform = {
  readonly schema: 'sunrey.money-integration.platform.v1';
  readonly simulation: true;
  readonly productionMoneyMovement: false;
  readonly regulatedCustodyConnected: false;
  readonly marketPriceBoundary: ReturnType<typeof marketPriceBoundaryProof>;
  describeHoldings(customerId: string): readonly HoldingView[];
  reconcile(customerId: string, assetId: string): MoneyReconciliationReport;
  transferNative(attempt: NativeTransferAttemptView): NativeTransferReceipt | { readonly ok: false; readonly code: string; readonly detail: string };
  unifiedHistory(customerId: string): readonly UnifiedTransactionHistoryItem[];
  settlementRecords(customerId: string): readonly Wave8SettlementRecord[];
};

export type HoldingView = {
  readonly schema: 'sunrey.money-integration.holding.v1';
  readonly customerId: string;
  readonly assetId: string;
  readonly availableMinorUnits: string;
  readonly pendingMinorUnits: string;
  readonly architecture: WalletArchitectureDescriptor;
  readonly authorityLabel: string;
  readonly sandboxSimulation: true;
};

export type NativeTransferAttemptView = {
  readonly walletId: string;
  readonly toAccountId: string;
  readonly toAddressText: string;
  readonly amount: bigint;
  readonly maxFee: bigint;
  readonly assetId?: 'SUNREY_COIN' | 'MOONREY_COIN';
  readonly keyIds: readonly string[];
};

export type MoneyIntegrationDeps = {
  readonly walletEngine: WalletEngine;
  readonly walletProduct: WalletProductService;
  readonly nativeClearing?: NativeClearingEngine;
  readonly nowUtc: UtcInstant;
};

export function createMoneyIntegrationPlatform(deps: MoneyIntegrationDeps): MoneyIntegrationPlatform {
  const { walletEngine, walletProduct, nativeClearing } = deps;

  return Object.freeze({
    schema: 'sunrey.money-integration.platform.v1',
    simulation: true,
    productionMoneyMovement: false,
    regulatedCustodyConnected: false,
    marketPriceBoundary: marketPriceBoundaryProof(),

    describeHoldings(customerId: string): readonly HoldingView[] {
      const wallets = walletProduct.listWallets(customerId);
      const holdings: HoldingView[] = [];
      for (const wallet of wallets) {
        const architecture =
          wallet.custodyModel === 'SUNREY_NATIVE'
            ? describeCustodialWallet({
                walletId: wallet.walletId,
                accountId: wallet.custodyAccountId,
                assetId: wallet.assetId,
                custodyModel: wallet.custodyModel,
              })
            : describeBlockchainAccount({
                walletId: wallet.walletId,
                accountId: wallet.custodyAccountId,
                assetId: wallet.assetId,
              });
        holdings.push(
          Object.freeze({
            schema: 'sunrey.money-integration.holding.v1',
            customerId,
            assetId: wallet.assetId,
            availableMinorUnits: wallet.balance.availableMinorUnits,
            pendingMinorUnits: wallet.balance.pendingMinorUnits,
            architecture,
            authorityLabel: architecture.balanceAuthority,
            sandboxSimulation: true,
          }),
        );
      }
      if (nativeClearing) {
        const account = [...nativeClearing.accounts.values()].find((row) => row.customerId === customerId);
        if (account) {
          for (const assetId of [SUNREY_COIN_NATIVE_ASSET_ID, MOONREY_COIN_NATIVE_ASSET_ID] as const) {
            const position = nativeClearing.position(account.accountId, assetId);
            holdings.push(
              Object.freeze({
                schema: 'sunrey.money-integration.holding.v1',
                customerId,
                assetId,
                availableMinorUnits: position.available.toString(),
                pendingMinorUnits: position.pendingSettlement.toString(),
                architecture: describeExchangeAccount({
                  walletId: `xacct_${customerId}`,
                  accountId: account.accountId,
                  assetId,
                }),
                authorityLabel: 'EXCHANGE_INTERNAL_POSITION',
                sandboxSimulation: true,
              }),
            );
          }
        }
      }
      return Object.freeze(holdings);
    },

    reconcile(customerId: string, assetId: string): MoneyReconciliationReport {
      const wallets = walletProduct.listWallets(customerId).filter((w) => w.assetId === assetId);
      const custodyQty = wallets.reduce((sum, w) => sum + BigInt(w.balance.availableMinorUnits), 0n);
      const chainAccount = wallets[0]?.custodyAccountId ?? `acct_${customerId}`;
      const chainQty = canonicalChainBalance(walletEngine, chainAccount, assetId as 'SUNREY_COIN').availableMinorUnits;
      let exchangeQty = 0n;
      if (nativeClearing) {
        const account = [...nativeClearing.accounts.values()].find((row) => row.customerId === customerId);
        if (account) {
          exchangeQty = nativeClearing.position(account.accountId, assetId).available;
        }
      }
      return reconcileMoneySurfaces({
        assetId,
        chainQuantity: chainQty,
        custodyQuantity: custodyQty,
        exchangeQuantity: exchangeQty,
        customerReadModelQuantity: custodyQty,
      });
    },

    transferNative(attempt: NativeTransferAttemptView) {
      return executeNativeTransferLifecycle(walletEngine, attempt);
    },

    unifiedHistory(customerId: string): readonly UnifiedTransactionHistoryItem[] {
      const items: UnifiedTransactionHistoryItem[] = [];
      for (const wallet of walletProduct.listWallets(customerId)) {
        const listed = walletProduct.listTransactions(customerId, wallet.walletId);
        if (listed.ok) {
          for (const tx of listed.value) {
            items.push(fromWalletTransaction(customerId, tx));
          }
        }
      }
      if (nativeClearing) {
        const account = [...nativeClearing.accounts.values()].find((row) => row.customerId === customerId);
        if (account) {
          for (const trade of nativeClearing.trades.values()) {
            if (trade.buyer !== account.accountId && trade.seller !== account.accountId) {
              continue;
            }
            const settlementId = nativeClearing.settlementsByTrade.get(trade.tradeId);
            const settlement = settlementId ? nativeClearing.settlements.get(settlementId) : undefined;
            items.push(
              fromExchangeSettlement({
                customerId,
                settlementId: settlementId ?? trade.tradeId,
                tradeId: trade.tradeId,
                baseAssetId: trade.baseAsset,
                quoteAssetId: trade.quoteAsset,
                amountMinorUnits: trade.quantity.scaledUnits,
                finalized: settlement?.status === 'FINALIZED',
                chainTxRef: settlement?.transactionId ?? null,
                occurredAt: trade.matchedAt,
              }),
            );
          }
        }
      }
      return mergeUnifiedHistory(items);
    },

    settlementRecords(customerId: string): readonly Wave8SettlementRecord[] {
      if (!nativeClearing) {
        return Object.freeze([]);
      }
      const account = [...nativeClearing.accounts.values()].find((row) => row.customerId === customerId);
      if (!account) {
        return Object.freeze([]);
      }
      const records: Wave8SettlementRecord[] = [];
      for (const trade of nativeClearing.trades.values()) {
        if (trade.buyer !== account.accountId && trade.seller !== account.accountId) {
          continue;
        }
        const settlementId = nativeClearing.settlementsByTrade.get(trade.tradeId);
        const settlement = settlementId ? nativeClearing.settlements.get(settlementId) : undefined;
        records.push(
          wave8SettlementRecord({
            settlementId: settlementId ?? trade.tradeId,
            tradeId: trade.tradeId,
            state: settlement ? mapNativeSettlementToWave8(settlement.status) : 'MATCHED',
            baseAssetId: trade.baseAsset,
            quoteAssetId: trade.quoteAsset,
            canonicalChainTxRef: settlement?.transactionId ?? null,
          }),
        );
      }
      return Object.freeze(records);
    },
  });
}
