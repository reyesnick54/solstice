import type { UtcInstant } from '../../../domain/src/time.ts';
import { Money } from '../../../money/src/money.ts';
import type { Result } from '../../../domain/src/result.ts';
import type { InstrumentId } from '../ids.ts';
import type { InvestmentQuantity } from '../quantity.ts';
import type { InstrumentPrice } from '../price.ts';
import type { InvestmentOrderProposal } from './order-intent.ts';
import type { PortfolioId } from './ids.ts';
import type { InvestmentOrderState } from './types.ts';

export type ExecutionFailure = {
  readonly code:
    | 'ORDER_NOT_FOUND'
    | 'PROVIDER_UNAVAILABLE'
    | 'MARKET_UNAVAILABLE'
    | 'REJECTED'
    | 'CANNOT_CANCEL'
    | 'INSUFFICIENT_CASH'
    | 'INSUFFICIENT_POSITION'
    | 'NOT_SIMULATION';
  readonly message: string;
};

export type ExecutionFill = {
  readonly fillId: string;
  readonly orderId: string;
  readonly instrumentId: InstrumentId;
  readonly quantity: InvestmentQuantity;
  readonly price: InstrumentPrice;
  readonly notional: Money;
  readonly fee: Money;
  readonly filledAt: UtcInstant;
  readonly partial: boolean;
  readonly simulation: true;
  readonly liveSecuritiesExecution: false;
};

export type ExecutionPosition = {
  readonly instrumentId: InstrumentId;
  readonly quantity: InvestmentQuantity;
  readonly currency: string;
};

export type ExecutionStatement = {
  readonly statementId: string;
  readonly portfolioId: PortfolioId;
  readonly asOf: UtcInstant;
  readonly cash: Money;
  readonly positions: readonly ExecutionPosition[];
  readonly fills: readonly ExecutionFill[];
  readonly reconciliation: 'PROVIDER_VIEW_NOT_LEDGER_AUTHORITY';
  readonly simulation: true;
};

/**
 * Provider-independent investment execution adapter.
 * Real licensed brokers attach later through Provider Runtime.
 * This interface cannot issue Execution Authority.
 */
export interface InvestmentExecutionAdapter {
  readonly productionAuthorized: false;
  readonly liveProviderConnected: false;
  submitOrder(order: InvestmentOrderProposal, at: UtcInstant): Result<InvestmentOrderProposal, ExecutionFailure>;
  cancelOrder(order: InvestmentOrderProposal, at: UtcInstant): Result<InvestmentOrderProposal, ExecutionFailure>;
  getOrder(orderId: string): Result<InvestmentOrderProposal, ExecutionFailure>;
  getFills(orderId: string): Result<readonly ExecutionFill[], ExecutionFailure>;
  getPositions(portfolioId: PortfolioId): Result<readonly ExecutionPosition[], ExecutionFailure>;
  getCash(portfolioId: PortfolioId): Result<Money, ExecutionFailure>;
  getStatement(portfolioId: PortfolioId, at: UtcInstant): Result<ExecutionStatement, ExecutionFailure>;
}

export type AdapterOrderUpdate = {
  readonly status: InvestmentOrderState;
  readonly filledQuantity: InvestmentQuantity | null;
  readonly filledAmount: Money | null;
};
