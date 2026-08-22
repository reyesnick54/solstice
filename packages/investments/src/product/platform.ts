import { Money } from '../../../money/src/money.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { Customer } from '../../../domain/src/customer.ts';
import { notionalMoney } from '../price.ts';
import { quantityFromScaledString } from '../quantity.ts';
import type { InvestmentsService } from '../service.ts';
import type { InvestmentAccountId, InstrumentId } from '../ids.ts';
import { asInvestmentAccountId, asInstrumentId } from '../ids.ts';
import type { InvestmentQuantity } from '../quantity.ts';
import { seedInstrumentProducts, type InstrumentProduct } from './instrument-catalog.ts';
import { mapCoreTypeToAssetClass } from './instrument-catalog.ts';
import { freezePortfolio, portfolioFromProfile, type InvestmentPortfolio } from './portfolio.ts';
import { aggregateRealized, averageCostFromLots, freezeHolding, type HoldingView } from './holdings.ts';
import { freshnessFromQuote as quoteFreshness } from './market-bridge.ts';
import { computePerformance, type PerformanceCashFlow, type PerformanceReport, type ValuationPoint } from './performance.ts';
import {
  defaultBalancedTarget,
  freezeTargetAllocation,
  productAllocation,
  type ProductAllocationView,
  type TargetAllocation,
} from './allocation-target.ts';
import { analyzeRebalance, type RebalanceProposal } from './rebalance.ts';
import { computeRiskMetrics, type PortfolioRiskView } from './risk-metrics.ts';
import { evaluateProductSuitability, type SuitabilityDecision, type SuitabilityInput } from './suitability.ts';
import { newOrderProposal, transitionOrderProposal, type InvestmentOrderProposal } from './order-intent.ts';
import type { InvestmentExecutionAdapter } from './execution.ts';
import { SandboxInvestmentExecutionProvider } from './sandbox.ts';
import { overlayReservation, reservedTotal, type CashReservation } from './reservation.ts';
import { opportunitiesFromInvestmentState, type GrowthInvestmentOpportunity } from './growth-port.ts';
import {
  toGrowAllocationView,
  toGrowHoldingsView,
  toGrowPerformanceView,
  toGrowPortfolioView,
  toGrowRecommendationsView,
  toGrowRiskView,
  type GrowAllocationView,
  type GrowHoldingsView,
  type GrowPerformanceView,
  type GrowPortfolioView,
  type GrowRecommendationsView,
  type GrowRiskView,
} from './views.ts';
import { asPortfolioId, type PortfolioId } from './ids.ts';
import type { InvestmentOrderSide, InvestmentSizingMode, SandboxExecutionScenario } from './types.ts';
import { LIVE_INVESTMENT_EXECUTION } from '../types.ts';

export type PlatformDenial = {
  readonly outcome: 'DENIED';
  readonly code: 'RESOURCE_NOT_OWNED' | 'NOT_FOUND' | 'INELIGIBLE' | 'PROVIDER_UNAVAILABLE' | 'REJECTED';
  readonly message: string;
};

export type PlatformResult<T> =
  | { readonly outcome: 'OK'; readonly value: T }
  | PlatformDenial;

/**
 * Productization facade over InvestmentsService.
 * Portfolio tables are not a second ledger.
 */
export class InvestmentPlatform {
  readonly products = new Map<string, InstrumentProduct>();
  readonly portfolios = new Map<string, InvestmentPortfolio>();
  readonly targets = new Map<string, TargetAllocation>();
  readonly proposals = new Map<string, InvestmentOrderProposal>();
  readonly reservations = new Map<string, CashReservation>();
  readonly cashFlows = new Map<string, PerformanceCashFlow[]>();
  readonly investments: InvestmentsService;
  readonly execution: InvestmentExecutionAdapter;
  private readonly sandbox: SandboxInvestmentExecutionProvider | undefined;

  constructor(
    investments: InvestmentsService,
    options: {
      readonly execution?: InvestmentExecutionAdapter;
      readonly seedProducts?: boolean;
    } = {},
  ) {
    this.investments = investments;
    if (LIVE_INVESTMENT_EXECUTION !== false) {
      throw new Error('live investment execution is forbidden');
    }
    if (options.seedProducts !== false) {
      for (const product of seedInstrumentProducts()) {
        this.products.set(product.instrumentId, product);
      }
    }
    if (options.execution instanceof SandboxInvestmentExecutionProvider) {
      this.sandbox = options.execution;
      this.execution = options.execution;
    } else if (options.execution) {
      this.execution = options.execution;
    } else {
      this.sandbox = new SandboxInvestmentExecutionProvider();
      this.execution = this.sandbox;
    }
  }

  setSandboxScenario(scenario: SandboxExecutionScenario): void {
    this.sandbox?.setScenario(scenario);
  }

  attachPortfolio(portfolio: InvestmentPortfolio): InvestmentPortfolio {
    const frozen = freezePortfolio(portfolio);
    this.portfolios.set(frozen.portfolioId, frozen);
    if (!this.targets.has(frozen.portfolioId)) {
      this.targets.set(frozen.portfolioId, defaultBalancedTarget(frozen.portfolioId));
    }
    return frozen;
  }

  attachFromInvestmentAccount(
    investmentAccountId: InvestmentAccountId,
    extras: Parameters<typeof portfolioFromProfile>[1] = {},
  ): InvestmentPortfolio | undefined {
    const profile = this.investments.store.getProfile(investmentAccountId);
    if (!profile) {
      return undefined;
    }
    return this.attachPortfolio(portfolioFromProfile(profile, extras));
  }

  recordCashFlow(portfolioId: PortfolioId, flow: PerformanceCashFlow): void {
    const existing = this.cashFlows.get(portfolioId) ?? [];
    this.cashFlows.set(portfolioId, [...existing, flow]);
  }

  setTarget(target: TargetAllocation): TargetAllocation {
    const frozen = freezeTargetAllocation(target);
    this.targets.set(frozen.portfolioId, frozen);
    return frozen;
  }

  authorizeRead(portfolioId: string, ownerId: string): PlatformResult<InvestmentPortfolio> {
    const portfolio = this.portfolios.get(portfolioId) ?? this.portfolios.get(`pf_${portfolioId}`);
    if (!portfolio) {
      return { outcome: 'DENIED', code: 'NOT_FOUND', message: 'portfolio not found' };
    }
    if (portfolio.ownerId !== ownerId) {
      return { outcome: 'DENIED', code: 'RESOURCE_NOT_OWNED', message: 'portfolio is owned by another customer' };
    }
    return { outcome: 'OK', value: portfolio };
  }

  portfolioForOwner(ownerId: string): InvestmentPortfolio | undefined {
    return [...this.portfolios.values()].find((row) => row.ownerId === ownerId);
  }

  cashAvailable(portfolio: InvestmentPortfolio): Money {
    const posted = this.postedCash(portfolio);
    const reserved = reservedTotal(
      [...this.reservations.values()].filter((row) => row.portfolioId === portfolio.portfolioId),
      portfolio.baseCurrency,
    );
    return posted.minus(reserved);
  }

  postedCash(portfolio: InvestmentPortfolio): Money {
    const snapshot = this.investments.store.latestValuation(portfolio.investmentAccountId);
    if (snapshot) {
      return snapshot.cash;
    }
    return this.investments.valuePortfolio(portfolio.investmentAccountId).cash;
  }

  holdings(portfolio: InvestmentPortfolio, at: UtcInstant): readonly HoldingView[] {
    const snapshot = this.investments.store.latestValuation(portfolio.investmentAccountId) ?? this.investments.valuePortfolio(portfolio.investmentAccountId);
    const realizedAll = this.investments.store.listRealized();
    const incomeTotal = (this.cashFlows.get(portfolio.portfolioId) ?? [])
      .filter((row) => row.kind === 'INCOME')
      .reduce((sum, row) => sum.plus(row.amount), Money.zero(portfolio.baseCurrency));
    return Object.freeze(
      snapshot.positions.map((position) => {
        const product = this.products.get(position.instrumentId);
        const instrument = this.investments.store.getInstrument(position.instrumentId);
        const quote = this.investments.market.getValuationPrice(position.instrumentId, at);
        const freshness = quote.ok
          ? quoteFreshness(quote.value, at)
          : { source: 'UNAVAILABLE', timestamp: at, freshnessMs: 0n, quality: 'UNAVAILABLE' as const, stale: true };
        const qty = position.quantity;
        return freezeHolding({
          instrumentId: position.instrumentId,
          identifier: product?.identifier ?? instrument?.symbol ?? position.instrumentId,
          displayName: product?.displayName ?? instrument?.displayName ?? position.instrumentId,
          assetClass: product?.assetClass ?? (instrument ? mapCoreTypeToAssetClass(instrument.instrumentType) : 'OTHER_APPROVED_PRODUCT'),
          quantity: qty,
          averageCost: averageCostFromLots(position.remainingCost, qty),
          remainingCost: position.remainingCost,
          marketPrice: position.price,
          marketValue: position.marketValue,
          unrealized: position.unrealized,
          realized: aggregateRealized(realizedAll, position.instrumentId, portfolio.baseCurrency),
          income: incomeTotal,
          currency: portfolio.baseCurrency,
          valuation: freshness,
        });
      }),
    );
  }

  allocation(portfolio: InvestmentPortfolio): ProductAllocationView {
    const snapshot = this.investments.store.latestValuation(portfolio.investmentAccountId) ?? this.investments.valuePortfolio(portfolio.investmentAccountId);
    const instruments = new Map(this.investments.store.listInstruments().map((row) => [row.instrumentId, row] as const));
    return productAllocation(snapshot, instruments, this.products);
  }

  performance(portfolio: InvestmentPortfolio, from: UtcInstant, to: UtcInstant): PerformanceReport {
    const valuations = this.investments.store
      .listValuations()
      .filter((row) => row.investmentAccountId === portfolio.investmentAccountId && row.asOf >= from && row.asOf <= to);
    const points: ValuationPoint[] = valuations.map((row) => ({
      at: row.asOf,
      marketValue: row.marketValue,
      cash: row.cash,
    }));
    if (points.length === 0) {
      const current = this.investments.valuePortfolio(portfolio.investmentAccountId);
      points.push({ at: current.asOf, marketValue: current.marketValue, cash: current.cash });
    }
    const realized = this.investments.store.listRealized().reduce((sum, row) => sum.plus(row.realized), Money.zero(portfolio.baseCurrency));
    const latest = points[points.length - 1];
    const first = points[0];
    const unrealized = latest && first ? latest.marketValue.minus(first.marketValue) : Money.zero(portfolio.baseCurrency);
    const income = (this.cashFlows.get(portfolio.portfolioId) ?? [])
      .filter((row) => row.kind === 'INCOME')
      .reduce((sum, row) => sum.plus(row.amount), Money.zero(portfolio.baseCurrency));
    return computePerformance({
      from,
      to,
      points,
      cashFlows: this.cashFlows.get(portfolio.portfolioId) ?? [],
      realized,
      unrealized: latest && first ? latest.marketValue.minus(first.marketValue) : unrealized,
      income,
    });
  }

  risk(portfolio: InvestmentPortfolio, at: UtcInstant): PortfolioRiskView {
    const allocation = this.allocation(portfolio);
    const holdings = this.holdings(portfolio, at);
    const history = this.investments.store
      .listValuations()
      .filter((row) => row.investmentAccountId === portfolio.investmentAccountId)
      .map((row) => ({ at: row.asOf, marketValue: row.marketValue, cash: row.cash }));
    return computeRiskMetrics({ allocation, holdings, history });
  }

  rebalance(portfolio: InvestmentPortfolio, at: UtcInstant): RebalanceProposal {
    return analyzeRebalance({
      portfolioId: portfolio.portfolioId,
      allocation: this.allocation(portfolio),
      target: this.targets.get(portfolio.portfolioId) ?? defaultBalancedTarget(portfolio.portfolioId),
      holdings: this.holdings(portfolio, at),
      products: this.products,
    });
  }

  opportunities(portfolio: InvestmentPortfolio, at: UtcInstant): readonly GrowthInvestmentOpportunity[] {
    return opportunitiesFromInvestmentState({
      portfolio,
      allocation: this.allocation(portfolio),
      risk: this.risk(portfolio, at),
      performance: this.performance(portfolio, portfolio.createdAt, at),
      rebalance: this.rebalance(portfolio, at),
    });
  }

  suitability(input: SuitabilityInput): SuitabilityDecision {
    return evaluateProductSuitability(input);
  }

  proposeOrder(input: {
    readonly proposalId: string;
    readonly portfolio: InvestmentPortfolio;
    readonly instrumentId: InstrumentId;
    readonly side: InvestmentOrderSide;
    readonly sizing: InvestmentSizingMode;
    readonly quantity?: InvestmentQuantity;
    readonly amount?: Money;
    readonly at: UtcInstant;
    readonly customer?: Customer;
    readonly jurisdiction?: string;
    readonly identityVerified?: boolean;
  }): PlatformResult<InvestmentOrderProposal> {
    const product = this.products.get(input.instrumentId);
    if (!product) {
      return { outcome: 'DENIED', code: 'NOT_FOUND', message: 'instrument is not in the product catalog' };
    }
    const decision = evaluateProductSuitability({
      customer: input.customer,
      identityVerified: input.identityVerified ?? true,
      identityUsable: input.identityVerified ?? true,
      jurisdiction: input.jurisdiction,
      investorClassification: 'RETAIL',
      experience: 'LIMITED',
      riskTolerance: 'MODERATE',
      liquidityNeed: 'MEDIUM',
      providerAvailable: !this.sandbox || this.execution.liveProviderConnected === false,
      productRestriction: input.portfolio.restrictions,
      instrument: product,
    });
    if (decision.status !== 'ELIGIBLE_SIMULATION') {
      return { outcome: 'DENIED', code: 'INELIGIBLE', message: decision.reasons.join('; ') };
    }
    let quantity = input.quantity ?? null;
    let amount = input.amount ?? null;
    if (input.sizing === 'AMOUNT' && input.amount) {
      const quote = this.investments.market.getQuote(input.instrumentId, input.at);
      if (!quote.ok) {
        return { outcome: 'DENIED', code: 'PROVIDER_UNAVAILABLE', message: quote.error.message };
      }
      if (quoteFreshness(quote.value, input.at).stale) {
        return { outcome: 'DENIED', code: 'REJECTED', message: 'market quote is stale' };
      }
      const units = (input.amount.minorUnits * 100_000_000n) / quote.value.price.minorUnits;
      const parsed = quantityFromScaledString(units.toString());
      if (!parsed.ok) {
        return { outcome: 'DENIED', code: 'REJECTED', message: parsed.error.message };
      }
      quantity = parsed.value;
      const notion = notionalMoney(quantity, quote.value.price);
      if (!notion.ok) {
        return { outcome: 'DENIED', code: 'REJECTED', message: notion.error.message };
      }
      amount = notion.value;
    }
    const proposal = newOrderProposal({
      proposalId: input.proposalId,
      portfolioId: input.portfolio.portfolioId,
      ownerId: input.portfolio.ownerId,
      instrumentId: input.instrumentId,
      side: input.side,
      sizing: input.sizing,
      quantity,
      amount,
      createdAt: input.at,
      idempotencyKey: input.proposalId,
    });
    if (input.side === 'BUY' && amount) {
      const available = this.cashAvailable(input.portfolio);
      if (available.cmp(amount) < 0) {
        return { outcome: 'DENIED', code: 'REJECTED', message: 'insufficient available cash after reservations' };
      }
      const reservation = overlayReservation({
        reservationId: `res_${input.proposalId}`,
        portfolioId: input.portfolio.portfolioId,
        proposalId: proposal.proposalId,
        brokerageCashAccountId: input.portfolio.brokerageCashAccountId,
        pendingSettlementAccountId: input.portfolio.pendingSettlementAccountId,
        amount,
        createdAt: input.at,
      });
      this.reservations.set(reservation.reservationId, reservation);
      const reserved = { ...proposal, reservationId: reservation.reservationId };
      this.proposals.set(reserved.proposalId, reserved);
      return { outcome: 'OK', value: reserved };
    }
    this.proposals.set(proposal.proposalId, proposal);
    return { outcome: 'OK', value: proposal };
  }

  submitSandbox(proposalId: string, at: UtcInstant): PlatformResult<InvestmentOrderProposal> {
    const existing = this.proposals.get(proposalId);
    if (!existing) {
      return { outcome: 'DENIED', code: 'NOT_FOUND', message: 'proposal not found' };
    }
    const awaiting = existing.status === 'PROPOSED' ? transitionOrderProposal(existing, 'AWAITING_APPROVAL', { updatedAt: at }) : existing;
    const authorized =
      awaiting.status === 'AWAITING_APPROVAL' ? transitionOrderProposal(awaiting, 'AUTHORIZED', { updatedAt: at }) : awaiting;
    const submitted = this.execution.submitOrder(authorized, at);
    if (!submitted.ok) {
      if (submitted.error.code === 'MARKET_UNAVAILABLE' || submitted.error.code === 'PROVIDER_UNAVAILABLE') {
        return { outcome: 'DENIED', code: 'PROVIDER_UNAVAILABLE', message: submitted.error.message };
      }
      return { outcome: 'DENIED', code: 'REJECTED', message: submitted.error.message };
    }
    this.proposals.set(submitted.value.proposalId, submitted.value);
    const reservation = [...this.reservations.values()].find((row) => row.proposalId === proposalId);
    if (reservation && (submitted.value.status === 'FILLED' || submitted.value.status === 'PARTIALLY_FILLED')) {
      this.reservations.set(reservation.reservationId, { ...reservation, state: 'CAPTURED' });
    }
    if (reservation && (submitted.value.status === 'REJECTED' || submitted.value.status === 'CANCELLED' || submitted.value.status === 'FAILED')) {
      this.reservations.set(reservation.reservationId, { ...reservation, state: 'RELEASED' });
    }
    return { outcome: 'OK', value: submitted.value };
  }

  growPortfolio(ownerId: string): PlatformResult<GrowPortfolioView> {
    const portfolio = this.portfolioForOwner(ownerId);
    if (!portfolio) {
      return { outcome: 'DENIED', code: 'NOT_FOUND', message: 'portfolio not found' };
    }
    const allocation = this.allocation(portfolio);
    return { outcome: 'OK', value: toGrowPortfolioView(portfolio, allocation.cash, allocation.invested) };
  }

  growHoldings(ownerId: string, at: UtcInstant): PlatformResult<GrowHoldingsView> {
    const portfolio = this.portfolioForOwner(ownerId);
    if (!portfolio) {
      return { outcome: 'DENIED', code: 'NOT_FOUND', message: 'portfolio not found' };
    }
    return { outcome: 'OK', value: toGrowHoldingsView(portfolio.portfolioId, this.holdings(portfolio, at)) };
  }

  growPerformance(ownerId: string, from: UtcInstant, to: UtcInstant): PlatformResult<GrowPerformanceView> {
    const portfolio = this.portfolioForOwner(ownerId);
    if (!portfolio) {
      return { outcome: 'DENIED', code: 'NOT_FOUND', message: 'portfolio not found' };
    }
    return { outcome: 'OK', value: toGrowPerformanceView(this.performance(portfolio, from, to)) };
  }

  growAllocation(ownerId: string): PlatformResult<GrowAllocationView> {
    const portfolio = this.portfolioForOwner(ownerId);
    if (!portfolio) {
      return { outcome: 'DENIED', code: 'NOT_FOUND', message: 'portfolio not found' };
    }
    const target = this.targets.get(portfolio.portfolioId) ?? null;
    return { outcome: 'OK', value: toGrowAllocationView(this.allocation(portfolio), target) };
  }

  growRisk(ownerId: string, at: UtcInstant): PlatformResult<GrowRiskView> {
    const portfolio = this.portfolioForOwner(ownerId);
    if (!portfolio) {
      return { outcome: 'DENIED', code: 'NOT_FOUND', message: 'portfolio not found' };
    }
    return { outcome: 'OK', value: toGrowRiskView(this.risk(portfolio, at)) };
  }

  growRecommendations(ownerId: string, at: UtcInstant): PlatformResult<GrowRecommendationsView> {
    const portfolio = this.portfolioForOwner(ownerId);
    if (!portfolio) {
      return { outcome: 'DENIED', code: 'NOT_FOUND', message: 'portfolio not found' };
    }
    const rebalance = this.rebalance(portfolio, at);
    return {
      outcome: 'OK',
      value: toGrowRecommendationsView(this.opportunities(portfolio, at), rebalance),
    };
  }
}

export function portfolioIdForAccount(investmentAccountId: string): PortfolioId {
  return asPortfolioId(`pf_${investmentAccountId}`);
}

export function asOwnedInstrumentId(value: string): InstrumentId {
  return asInstrumentId(value);
}

export function asOwnedAccountId(value: string): InvestmentAccountId {
  return asInvestmentAccountId(value);
}
