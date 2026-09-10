/**
 * Exchange clearing chain port.
 *
 * SunRey Chain remains authority for native balances, transactions, block
 * inclusion, finality, and transaction identifiers. Exchange supplies
 * settlement intents only.
 */

import type {
  ChainHolding,
  ChainLock,
  ChainQueryResult,
  ChainSettlementTx,
  ExchangeSettlementIntent,
} from './types.ts';

export const EXCHANGE_CLEARING_CHAIN_MODE = 'SIMULATION_ONLY' as const;

export type ExchangeClearingChainPort = {
  readonly mode: typeof EXCHANGE_CLEARING_CHAIN_MODE;
  readonly networkId: string;
  readonly chainId: string;
  readonly available: boolean;
  height: bigint;
  blockId: string;
  stateRoot: string;
  readonly holdings: Map<string, ChainHolding>;
  readonly locks: Map<string, ChainLock>;
  readonly txs: Map<string, ChainSettlementTx>;
  readonly usedSettlements: ReadonlySet<string>;
  readonly settledTrades: ReadonlySet<string>;
  readonly usedNonces: ReadonlySet<string>;
  readonly exchangeKeys: ReadonlySet<string>;
  readonly issued: ReadonlyMap<string, bigint>;
  readonly mempool: readonly string[];

  key(owner: string, assetId: string): string;
  holding(owner: string, assetId: string): ChainHolding;
  registerExchangeKey(signature: string): void;
  issue(owner: string, assetId: string, quantity: bigint): string;
  transfer(from: string, to: string, assetId: string, quantity: bigint): string;
  lock(lockId: string, owner: string, assetId: string, quantity: bigint): string;
  unlock(lockId: string): string;
  submitSettlement(intent: ExchangeSettlementIntent): ChainSettlementTx;
  finalize(transactionId: string): ChainSettlementTx;
  rejectPending(transactionId: string, code: string): ChainSettlementTx;
  query(transactionId: string): ChainQueryResult;
  applySettlement(intent: ExchangeSettlementIntent): void;
  reconcile(): void;
  forceUnavailable(reason?: string): void;
  restoreAvailability(): void;
};
