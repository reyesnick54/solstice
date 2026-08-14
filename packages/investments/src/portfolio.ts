/**
 * Portfolio engine and position accounting.
 *
 * Corporate actions (splits, dividends-in-kind, mergers, spin-offs) are
 * OUT OF SCOPE for Solstice Alpha. Positions are quantity + cost basis +
 * a valuation that is never presented as cash.
 *
 * RealizedSettledProfit and UnrealizedPnL are different types. They are
 * not a flag on a single P&L object and they cannot be summed.
 */
import { Money } from '../../contracts/src/money.ts';
import type { AccountId, CustomerId } from '../../contracts/src/ids.ts';
import type { UtcInstant } from '../../contracts/src/time.ts';
import {
  SHARE_MICROS,
  type InvestmentPosition,
  type PortfolioValuation,
  type SimulatedPrice,
} from '../../contracts/src/investment-types.ts';
import { realizedSettledProfit, unrealizedPnL } from './pnl.ts';

export class PortfolioEngine {
  readonly investmentAccountId: AccountId;
  readonly customerId: CustomerId;
  private readonly positions = new Map<string, InvestmentPosition>();
  private realizedSettledMinor = 0n;
  private currency = 'USD';

  constructor(investmentAccountId: AccountId, customerId: CustomerId) {
    this.investmentAccountId = investmentAccountId;
    this.customerId = customerId;
  }

  /**
   * Apply a fill to a securities position. Cost basis uses integer
   * average-cost: (oldBasis + fillNotional) with quantity in micros.
   */
  applyFill(input: {
    readonly instrumentId: string;
    readonly side: 'BUY' | 'SELL';
    readonly quantityMicros: bigint;
    readonly priceMinorUnits: bigint;
    readonly currency: string;
    readonly accountId: AccountId;
  }): void {
    this.currency = input.currency;
    const key = input.instrumentId;
    const current = this.positions.get(key) ?? {
      instrumentId: input.instrumentId,
      quantityMicros: 0n,
      costBasis: Money.zero(input.currency),
      accountId: input.accountId,
    };
    const fillNotional = notional(input.quantityMicros, input.priceMinorUnits, input.currency);
    if (input.side === 'BUY') {
      this.positions.set(key, {
        instrumentId: input.instrumentId,
        quantityMicros: current.quantityMicros + input.quantityMicros,
        costBasis: current.costBasis.plus(fillNotional),
        accountId: input.accountId,
      });
      return;
    }
    const qty = current.quantityMicros === 0n ? 1n : current.quantityMicros;
    const avgCost = Money.fromMinorUnits(
      (current.costBasis.minorUnits * input.quantityMicros) / qty,
      input.currency,
    );
    const realized = fillNotional.minus(avgCost);
    if (realized.isPositive() || realized.isZero()) {
      this.realizedSettledMinor += realized.minorUnits;
    } else {
      this.realizedSettledMinor += realized.minorUnits;
    }
    const remainingQty = current.quantityMicros - input.quantityMicros;
    const remainingBasis = current.costBasis.minus(avgCost);
    this.positions.set(key, {
      instrumentId: input.instrumentId,
      quantityMicros: remainingQty < 0n ? 0n : remainingQty,
      costBasis: remainingBasis,
      accountId: input.accountId,
    });
  }

  recordRealizedSettled(amount: Money): void {
    this.currency = amount.currency;
    this.realizedSettledMinor += amount.minorUnits;
  }

  consumeRealizedSettled(amount: Money): void {
    this.realizedSettledMinor -= amount.minorUnits;
  }

  realizedSettled(): ReturnType<typeof realizedSettledProfit> {
    const minor = this.realizedSettledMinor < 0n ? 0n : this.realizedSettledMinor;
    return realizedSettledProfit(Money.fromMinorUnits(minor, this.currency));
  }

  listPositions(): readonly InvestmentPosition[] {
    return [...this.positions.values()];
  }

  /**
   * Valuation carries as-of and price source. It is never cash.
   */
  value(input: {
    readonly asOf: UtcInstant;
    readonly prices: readonly SimulatedPrice[];
    readonly cash: Money;
  }): PortfolioValuation {
    let market = 0n;
    let cost = 0n;
    for (const position of this.positions.values()) {
      const price = input.prices.find((p) => p.instrumentId === position.instrumentId);
      if (!price) continue;
      market += notional(position.quantityMicros, price.minorUnitsPerShare, this.currency).minorUnits;
      cost += position.costBasis.minorUnits;
    }
    const unrealizedMinor = market - cost;
    const source = input.prices[0]?.source ?? 'SIMULATED_SEEDED';
    return Object.freeze({
      investmentAccountId: this.investmentAccountId,
      customerId: this.customerId,
      asOf: input.asOf,
      priceSource: source,
      presentedAsCash: false,
      scopeLabel: 'INVESTMENT_ACCOUNT_ONLY',
      cash: input.cash,
      marketValue: Money.fromMinorUnits(market, this.currency),
      realizedSettled: this.realizedSettled(),
      unrealized: unrealizedPnL(Money.fromMinorUnits(unrealizedMinor, this.currency)),
    });
  }
}

export function notional(
  quantityMicros: bigint,
  priceMinorUnits: bigint,
  currency: string,
): Money {
  return Money.fromMinorUnits((quantityMicros * priceMinorUnits) / SHARE_MICROS, currency);
}
