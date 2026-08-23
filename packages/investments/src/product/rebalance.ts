import { Money } from '../../../money/src/money.ts';
import type { InstrumentId } from '../ids.ts';
import { notionalMoney } from '../price.ts';
import { quantityFromWholeString, type InvestmentQuantity } from '../quantity.ts';
import type { InstrumentProduct } from './instrument-catalog.ts';
import type { HoldingView } from './holdings.ts';
import type { AllocationDrift, ProductAllocationView, TargetAllocation } from './allocation-target.ts';
import { compareToTarget } from './allocation-target.ts';
import { asInvestmentProposalId } from './ids.ts';
import type { InvestmentOrderSide } from './types.ts';

export type RebalanceConstraint = {
  readonly minTradeMinorUnits: bigint;
  readonly feeBps: bigint;
  readonly taxBps: bigint;
  readonly driftThresholdBps: bigint;
};

export type CandidateTrade = {
  readonly instrumentId: InstrumentId;
  readonly side: InvestmentOrderSide;
  readonly sizing: 'AMOUNT';
  readonly amount: Money;
  readonly quantity: InvestmentQuantity | null;
  readonly estimatedFee: Money;
  readonly estimatedTax: Money;
  readonly reason: string;
  readonly executes: false;
};

export type RebalanceProposal = {
  readonly proposalId: string;
  readonly portfolioId: string;
  readonly status: 'PROPOSED';
  readonly drifts: readonly AllocationDrift[];
  readonly trades: readonly CandidateTrade[];
  readonly availableCash: Money;
  readonly residualCash: Money;
  readonly assumptions: readonly string[];
  readonly executes: false;
  readonly liveExecution: false;
};

const DEFAULT_CONSTRAINTS: RebalanceConstraint = {
  minTradeMinorUnits: 100n,
  feeBps: 0n,
  taxBps: 0n,
  driftThresholdBps: 200n,
};

export function analyzeRebalance(input: {
  readonly portfolioId: string;
  readonly allocation: ProductAllocationView;
  readonly target: TargetAllocation;
  readonly holdings: readonly HoldingView[];
  readonly products: ReadonlyMap<string, InstrumentProduct>;
  readonly constraints?: Partial<RebalanceConstraint>;
}): RebalanceProposal {
  const constraints = { ...DEFAULT_CONSTRAINTS, ...input.constraints };
  const drifts = compareToTarget(input.allocation, input.target);
  const trades: CandidateTrade[] = [];
  let cash = input.allocation.cash;
  const assumptions = [
    'Rebalance analysis is a structured proposal. It does not execute.',
    'Simulation only. Not a live securities order.',
    `Fee assumption ${constraints.feeBps.toString()} bps; tax assumption ${constraints.taxBps.toString()} bps.`,
  ];

  for (const drift of drifts) {
    if (drift.key === 'CASH') {
      continue;
    }
    const absDrift = drift.driftBps < 0n ? -drift.driftBps : drift.driftBps;
    if (absDrift < constraints.driftThresholdBps) {
      continue;
    }
    if (drift.driftBps > 0n) {
      const sell = pickHolding(input.holdings, drift.key, input.products, 'SELL');
      if (!sell) {
        assumptions.push(`No holding available to reduce ${drift.key}.`);
        continue;
      }
      const amount = minMoney(drift.actualValue.minus(drift.targetValue), sell.marketValue ?? Money.zero(cash.currency));
      if (amount.minorUnits < constraints.minTradeMinorUnits) {
        continue;
      }
      const fee = amount.allocate(constraints.feeBps, 10_000n, 'FLOOR');
      const tax = amount.allocate(constraints.taxBps, 10_000n, 'FLOOR');
      trades.push(trade(sell.instrumentId, 'SELL', amount, fee, tax, `Reduce overweight ${drift.key}`));
      cash = cash.plus(amount).minus(fee).minus(tax);
    } else {
      const buy = pickHolding(input.holdings, drift.key, input.products, 'BUY') ?? catalogBuy(drift.key, input.products);
      if (!buy) {
        assumptions.push(`No available instrument to increase ${drift.key}.`);
        continue;
      }
      const needed = drift.targetValue.minus(drift.actualValue);
      const affordable = needed.cmp(cash) <= 0 ? needed : cash;
      if (affordable.minorUnits < constraints.minTradeMinorUnits) {
        assumptions.push(`Insufficient cash to deploy into ${drift.key}.`);
        continue;
      }
      const fee = affordable.allocate(constraints.feeBps, 10_000n, 'FLOOR');
      const tax = Money.zero(affordable.currency);
      const net = affordable.minus(fee);
      if (net.minorUnits <= 0n) {
        continue;
      }
      trades.push(trade(buy.instrumentId, 'BUY', net, fee, tax, `Increase underweight ${drift.key}`));
      cash = cash.minus(affordable);
    }
  }

  return Object.freeze({
    proposalId: asInvestmentProposalId(`reb_${input.portfolioId}`),
    portfolioId: input.portfolioId,
    status: 'PROPOSED',
    drifts,
    trades: Object.freeze(trades),
    availableCash: input.allocation.cash,
    residualCash: cash,
    assumptions: Object.freeze(assumptions),
    executes: false,
    liveExecution: false,
  });
}

function trade(
  instrumentId: InstrumentId,
  side: InvestmentOrderSide,
  amount: Money,
  fee: Money,
  tax: Money,
  reason: string,
): CandidateTrade {
  return Object.freeze({
    instrumentId,
    side,
    sizing: 'AMOUNT',
    amount,
    quantity: null,
    estimatedFee: fee,
    estimatedTax: tax,
    reason,
    executes: false,
  });
}

function pickHolding(
  holdings: readonly HoldingView[],
  assetClass: string,
  products: ReadonlyMap<string, InstrumentProduct>,
  side: InvestmentOrderSide,
): HoldingView | null {
  const matches = holdings.filter((row) => {
    const product = products.get(row.instrumentId);
    if (product?.assetClass !== assetClass && row.assetClass !== assetClass) {
      return false;
    }
    if (side === 'SELL') {
      return row.quantity.units > 0n && row.marketValue !== null;
    }
    return product?.status === 'AVAILABLE_SIMULATION';
  });
  matches.sort((left, right) => (right.marketValue ?? Money.zero(left.currency)).cmp(left.marketValue ?? Money.zero(left.currency)));
  return matches[0] ?? null;
}

function catalogBuy(
  assetClass: string,
  products: ReadonlyMap<string, InstrumentProduct>,
): { readonly instrumentId: InstrumentId } | null {
  for (const product of products.values()) {
    if (product.assetClass === assetClass && product.status === 'AVAILABLE_SIMULATION' && product.paperTradable) {
      return { instrumentId: product.instrumentId };
    }
  }
  return null;
}

function minMoney(left: Money, right: Money): Money {
  return left.cmp(right) <= 0 ? left : right;
}

export function quantityForAmount(
  amount: Money,
  priceMinorUnits: bigint,
): ReturnType<typeof notionalMoney> | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } } {
  if (priceMinorUnits <= 0n) {
    return { ok: false, error: { code: 'INVALID_PRICE', message: 'price must be positive' } };
  }
  const units = (amount.minorUnits * 100_000_000n) / priceMinorUnits;
  const qty = quantityFromWholeString('0');
  if (!qty.ok) {
    return qty;
  }
  const quantity = { units, scale: 8 as const };
  return notionalMoney(quantity, { minorUnits: priceMinorUnits, currency: amount.currency });
}
