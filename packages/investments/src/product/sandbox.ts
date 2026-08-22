import type { UtcInstant } from '../../../domain/src/time.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import { Money } from '../../../money/src/money.ts';
import { asFillId } from '../ids.ts';
import { quantityFromScaledString, zeroQuantity } from '../quantity.ts';
import type { InvestmentOrderProposal } from './order-intent.ts';
import { transitionOrderProposal } from './order-intent.ts';
import type {
  ExecutionFailure,
  ExecutionFill,
  ExecutionPosition,
  ExecutionStatement,
  InvestmentExecutionAdapter,
} from './execution.ts';
import type { PortfolioId } from './ids.ts';
import type { SandboxExecutionScenario } from './types.ts';

/**
 * Deterministic simulation-only investment execution provider.
 * A filled sandbox order is not a live securities execution.
 */
export class SandboxInvestmentExecutionProvider implements InvestmentExecutionAdapter {
  readonly productionAuthorized = false as const;
  readonly liveProviderConnected = false as const;
  private readonly orders = new Map<string, InvestmentOrderProposal>();
  private readonly fills = new Map<string, ExecutionFill[]>();
  private readonly positions = new Map<string, ExecutionPosition[]>();
  private readonly cash = new Map<string, Money>();
  private scenario: SandboxExecutionScenario = 'FILLED';
  private unavailable = false;

  setScenario(scenario: SandboxExecutionScenario): void {
    this.scenario = scenario;
    this.unavailable = scenario === 'MARKET_UNAVAILABLE';
  }

  setCash(portfolioId: PortfolioId, amount: Money): void {
    this.cash.set(portfolioId, amount);
  }

  setPositions(portfolioId: PortfolioId, rows: readonly ExecutionPosition[]): void {
    this.positions.set(portfolioId, [...rows]);
  }

  submitOrder(order: InvestmentOrderProposal, at: UtcInstant): Result<InvestmentOrderProposal, ExecutionFailure> {
    if (order.simulation !== true || order.liveExecution !== false) {
      return err({ code: 'NOT_SIMULATION', message: 'sandbox rejects non-simulation orders' });
    }
    if (this.unavailable || this.scenario === 'MARKET_UNAVAILABLE') {
      return err({ code: 'MARKET_UNAVAILABLE', message: 'sandbox market is unavailable' });
    }
    if (this.scenario === 'REJECTED') {
      const rejected = transitionOrderProposal({ ...order, status: 'AUTHORIZED' }, 'SUBMITTED');
      const failed = transitionOrderProposal(rejected, 'REJECTED', { updatedAt: at });
      this.orders.set(failed.proposalId, failed);
      return ok(failed);
    }
    if (this.scenario === 'CANCELLED') {
      const submitted = transitionOrderProposal({ ...order, status: 'AUTHORIZED' }, 'SUBMITTED');
      const cancelled = transitionOrderProposal(submitted, 'CANCELLED', { updatedAt: at });
      this.orders.set(cancelled.proposalId, cancelled);
      return ok(cancelled);
    }
    const submitted = transitionOrderProposal({ ...order, status: 'AUTHORIZED' }, 'SUBMITTED', { updatedAt: at });
    if (this.scenario === 'PENDING') {
      this.orders.set(submitted.proposalId, submitted);
      return ok(submitted);
    }
    const fillQty = order.quantity ?? zeroQuantity();
    const half =
      this.scenario === 'PARTIAL_FILL'
        ? { units: fillQty.units / 2n, scale: fillQty.scale }
        : fillQty;
    const parsed = quantityFromScaledString(half.units.toString());
    const quantity = parsed.ok ? parsed.value : half;
    const currency = order.amount ? order.amount.currency : 'USD';
    const notional = order.amount ?? Money.zero(currency);
    const fillNotional =
      this.scenario === 'PARTIAL_FILL' && order.amount
        ? Money.fromMinorUnits(order.amount.minorUnits / 2n, order.amount.currency)
        : notional;
    const fill: ExecutionFill = Object.freeze({
      fillId: asFillId(`sfill_${order.proposalId}`),
      orderId: order.proposalId,
      instrumentId: order.instrumentId,
      quantity,
      price: { minorUnits: 10_000n, currency: fillNotional.currency || 'USD' },
      notional: fillNotional,
      fee: Money.zero(fillNotional.currency || 'USD'),
      filledAt: at,
      partial: this.scenario === 'PARTIAL_FILL',
      simulation: true,
      liveSecuritiesExecution: false,
    });
    this.fills.set(order.proposalId, [fill]);
    const nextStatus = this.scenario === 'PARTIAL_FILL' ? 'PARTIALLY_FILLED' : 'FILLED';
    const filled = transitionOrderProposal(submitted, nextStatus, {
      filledQuantity: quantity,
      filledAmount: fillNotional,
      updatedAt: at,
    });
    this.orders.set(filled.proposalId, filled);
    return ok(filled);
  }

  cancelOrder(order: InvestmentOrderProposal, at: UtcInstant): Result<InvestmentOrderProposal, ExecutionFailure> {
    const existing = this.orders.get(order.proposalId);
    if (!existing) {
      return err({ code: 'ORDER_NOT_FOUND', message: 'sandbox does not know this order' });
    }
    if (existing.status === 'FILLED' || existing.status === 'REJECTED' || existing.status === 'CANCELLED') {
      return err({ code: 'CANNOT_CANCEL', message: `cannot cancel ${existing.status}` });
    }
    const cancelled = transitionOrderProposal(existing, 'CANCELLED', { updatedAt: at });
    this.orders.set(cancelled.proposalId, cancelled);
    return ok(cancelled);
  }

  getOrder(orderId: string): Result<InvestmentOrderProposal, ExecutionFailure> {
    const existing = this.orders.get(orderId);
    if (!existing) {
      return err({ code: 'ORDER_NOT_FOUND', message: 'sandbox does not know this order' });
    }
    return ok(existing);
  }

  getFills(orderId: string): Result<readonly ExecutionFill[], ExecutionFailure> {
    return ok(this.fills.get(orderId) ?? []);
  }

  getPositions(portfolioId: PortfolioId): Result<readonly ExecutionPosition[], ExecutionFailure> {
    if (this.unavailable) {
      return err({ code: 'PROVIDER_UNAVAILABLE', message: 'sandbox provider is unavailable' });
    }
    return ok(this.positions.get(portfolioId) ?? []);
  }

  getCash(portfolioId: PortfolioId): Result<Money, ExecutionFailure> {
    if (this.unavailable) {
      return err({ code: 'PROVIDER_UNAVAILABLE', message: 'sandbox provider is unavailable' });
    }
    return ok(this.cash.get(portfolioId) ?? Money.zero('USD'));
  }

  getStatement(portfolioId: PortfolioId, at: UtcInstant): Result<ExecutionStatement, ExecutionFailure> {
    const cash = this.getCash(portfolioId);
    const positions = this.getPositions(portfolioId);
    if (!cash.ok) {
      return cash;
    }
    if (!positions.ok) {
      return positions;
    }
    return ok(
      Object.freeze({
        statementId: `stmt_${portfolioId}_${at}`,
        portfolioId,
        asOf: at,
        cash: cash.value,
        positions: positions.value,
        fills: Object.freeze([...this.fills.values()].flat()),
        reconciliation: 'PROVIDER_VIEW_NOT_LEDGER_AUTHORITY',
        simulation: true,
      }),
    );
  }
}
