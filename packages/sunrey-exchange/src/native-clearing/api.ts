import type { ExchangeAccountId, TradeId } from '../ids.ts';
import type { NativeClearingEngine } from './engine.ts';

export function nativeExchangeApi(engine: NativeClearingEngine) {
  return {
    depositAddress(accountId: ExchangeAccountId): string {
      return engine.allocateDepositAddress(accountId);
    },
    depositStatus(depositId: string) {
      return engine.deposits.get(depositId) ?? null;
    },
    availableNativePositions(accountId: ExchangeAccountId) {
      return [engine.market.baseAsset, engine.market.quoteAsset].map((assetId) => engine.position(accountId, assetId));
    },
    reservations(accountId?: ExchangeAccountId) {
      return [...engine.reservations.values()].filter((item) => !accountId || item.accountId === accountId);
    },
    settlements(accountId?: ExchangeAccountId) {
      return [...engine.settlements.values()].filter(
        (item) => !accountId || item.intent.buyer === accountId || item.intent.seller === accountId,
      );
    },
    settlementReceipt(tradeId: TradeId) {
      return engine.receipt(tradeId) ?? null;
    },
    withdrawalStatus(withdrawalId: string) {
      return engine.withdrawals.get(withdrawalId) ?? null;
    },
    reconciliationState() {
      return engine.reconcile();
    },
  };
}
