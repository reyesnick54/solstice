import type { AccountId } from '../../domain/src/account.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { QuoteId } from './ids.ts';

export const FX_TRADE_STATUSES = [
  'PENDING',
  'SETTLED',
  'FAILED',
  'CANCELLED',
  'RATE_MOVED',
  'PROVIDER_UNAVAILABLE',
] as const;
export type FxTradeStatus = (typeof FX_TRADE_STATUSES)[number];

export const FX_EXECUTION_MODES = [
  'NORMAL',
  'EXPIRED_QUOTE',
  'PROVIDER_UNAVAILABLE',
  'RATE_MOVED',
  'EXECUTION_PENDING',
  'EXECUTION_FAILED',
  'EXECUTION_SETTLED',
] as const;
export type FxExecutionMode = (typeof FX_EXECUTION_MODES)[number];

export type FxTradeId = string;
export type FxReconciliationRef = string;

/**
 * Provider-independent trade record. Vendor payloads never enter this type.
 */
export type FxTrade = {
  readonly tradeId: FxTradeId;
  readonly quoteId: QuoteId;
  readonly status: FxTradeStatus;
  readonly simulation: true;
  readonly live: false;
  readonly providerState: 'SIMULATED';
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly reconciliationRef: FxReconciliationRef | null;
  readonly failureCode: string | null;
};

export type FxExecution = {
  readonly executionId: string;
  readonly quoteId: QuoteId;
  readonly tradeId: FxTradeId;
  readonly sourceAccountId: AccountId;
  readonly destinationAccountId: AccountId;
  readonly status: FxTradeStatus;
  readonly journalIds: readonly string[];
  readonly evidenceId: string | null;
  readonly reconciliationRef: FxReconciliationRef | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly idempotencyKey: string;
};

export function freezeTrade(trade: FxTrade): FxTrade {
  return Object.freeze({ ...trade });
}

export function freezeExecution(execution: FxExecution): FxExecution {
  return Object.freeze({
    ...execution,
    journalIds: Object.freeze([...execution.journalIds]),
  });
}
