import type { HoldingView } from './holdings.ts';
import type { ProductAllocationView } from './allocation-target.ts';
import type { PerformanceReport } from './performance.ts';
import type { PortfolioRiskView } from './risk-metrics.ts';
import type { InvestmentPortfolio } from './portfolio.ts';
import type { GrowthInvestmentOpportunity } from './growth-port.ts';
import type { RebalanceProposal } from './rebalance.ts';

export type MoneyDto = {
  readonly minorUnits: string;
  readonly currency: string;
};

export type GrowPortfolioView = {
  readonly schema: 'sunrey.grow.portfolio.v1';
  readonly portfolioId: string;
  readonly ownerId: string;
  readonly status: string;
  readonly baseCurrency: string;
  readonly displayCurrency: string;
  readonly strategyRef: string | null;
  readonly riskProfileRef: string | null;
  readonly goalLinks: readonly string[];
  readonly restrictions: readonly string[];
  readonly cash: MoneyDto;
  readonly invested: MoneyDto;
  readonly total: MoneyDto;
  readonly environment: 'simulation';
  readonly liveState: false;
  readonly securitiesBrokerageLive: false;
  readonly authoritativeCalculator: 'INVESTMENT_PLATFORM';
  readonly frontendMathAuthoritative: false;
};

export type GrowHoldingsView = {
  readonly schema: 'sunrey.grow.holdings.v1';
  readonly portfolioId: string;
  readonly holdings: readonly {
    readonly instrumentId: string;
    readonly identifier: string;
    readonly displayName: string;
    readonly assetClass: string;
    readonly quantityUnits: string;
    readonly averageCost: MoneyDto;
    readonly remainingCost: MoneyDto;
    readonly marketPriceMinorUnits: string | null;
    readonly marketValue: MoneyDto | null;
    readonly unrealized: MoneyDto | null;
    readonly realized: MoneyDto;
    readonly income: MoneyDto;
    readonly currency: string;
    readonly valuation: {
      readonly source: string;
      readonly timestamp: string;
      readonly freshnessMs: string;
      readonly quality: string;
      readonly stale: boolean;
    };
  }[];
  readonly frontendMathAuthoritative: false;
};

export type GrowPerformanceView = {
  readonly schema: 'sunrey.grow.performance.v1';
  readonly methodology: string;
  readonly formula: string;
  readonly absoluteReturn: MoneyDto;
  readonly periodReturnBps: string | null;
  readonly realized: MoneyDto;
  readonly unrealized: MoneyDto;
  readonly income: MoneyDto;
  readonly cashFlows: readonly { readonly at: string; readonly kind: string; readonly amount: MoneyDto }[];
  readonly benchmark: { readonly benchmarkId: string; readonly periodReturnBps: string; readonly deltaBps: string | null } | null;
  readonly insufficientData: boolean;
  readonly llmAuthoritative: false;
  readonly frontendMathAuthoritative: false;
};

export type GrowAllocationView = {
  readonly schema: 'sunrey.grow.allocation.v1';
  readonly actual: {
    readonly byAssetClass: readonly { readonly key: string; readonly weightBps: string; readonly marketValue: MoneyDto }[];
    readonly byInstrument: readonly { readonly key: string; readonly weightBps: string; readonly marketValue: MoneyDto }[];
    readonly byCurrency: readonly { readonly key: string; readonly weightBps: string; readonly marketValue: MoneyDto }[];
    readonly byRiskClass: readonly { readonly key: string; readonly weightBps: string; readonly marketValue: MoneyDto }[];
  };
  readonly target: {
    readonly cashTargetBps: string;
    readonly weights: readonly { readonly key: string; readonly weightBps: string }[];
  } | null;
  readonly frontendMathAuthoritative: false;
};

export type GrowRiskView = {
  readonly schema: 'sunrey.grow.risk.v1';
  readonly concentration: { readonly largestInstrumentId: string | null; readonly largestWeightBps: string };
  readonly drawdownBps: string | null;
  readonly volatilityBps: string | null;
  readonly volatilityAvailable: boolean;
  readonly currencyExposure: readonly { readonly currency: string; readonly weightBps: string }[];
  readonly liquidityExposure: readonly { readonly liquidity: string; readonly weightBps: string }[];
  readonly assetClassExposure: readonly { readonly assetClass: string; readonly weightBps: string }[];
  readonly fabricatedStatistics: false;
  readonly frontendMathAuthoritative: false;
};

export type GrowRecommendationsView = {
  readonly schema: 'sunrey.grow.recommendations.v1';
  readonly items: readonly GrowthInvestmentOpportunity[];
  readonly rebalanceProposalId: string | null;
  readonly executes: false;
};

function moneyDto(value: { readonly minorUnits: bigint; readonly currency: string } | null): MoneyDto | null {
  if (!value) {
    return null;
  }
  return { minorUnits: value.minorUnits.toString(), currency: value.currency };
}

function moneyRequired(value: { readonly minorUnits: bigint; readonly currency: string }): MoneyDto {
  return { minorUnits: value.minorUnits.toString(), currency: value.currency };
}

export function toGrowPortfolioView(
  portfolio: InvestmentPortfolio,
  cash: { readonly minorUnits: bigint; readonly currency: string },
  invested: { readonly minorUnits: bigint; readonly currency: string },
): GrowPortfolioView {
  return Object.freeze({
    schema: 'sunrey.grow.portfolio.v1',
    portfolioId: portfolio.portfolioId,
    ownerId: portfolio.ownerId,
    status: portfolio.status,
    baseCurrency: portfolio.baseCurrency,
    displayCurrency: portfolio.displayCurrency,
    strategyRef: portfolio.strategyRef,
    riskProfileRef: portfolio.riskProfileRef,
    goalLinks: portfolio.goalLinks,
    restrictions: portfolio.restrictions,
    cash: moneyRequired(cash),
    invested: moneyRequired(invested),
    total: {
      minorUnits: (cash.minorUnits + invested.minorUnits).toString(),
      currency: cash.currency,
    },
    environment: 'simulation',
    liveState: false,
    securitiesBrokerageLive: false,
    authoritativeCalculator: 'INVESTMENT_PLATFORM',
    frontendMathAuthoritative: false,
  });
}

export function toGrowHoldingsView(portfolioId: string, holdings: readonly HoldingView[]): GrowHoldingsView {
  return Object.freeze({
    schema: 'sunrey.grow.holdings.v1',
    portfolioId,
    holdings: Object.freeze(
      holdings.map((row) =>
        Object.freeze({
          instrumentId: row.instrumentId,
          identifier: row.identifier,
          displayName: row.displayName,
          assetClass: row.assetClass,
          quantityUnits: row.quantity.units.toString(),
          averageCost: moneyRequired(row.averageCost),
          remainingCost: moneyRequired(row.remainingCost),
          marketPriceMinorUnits: row.marketPrice ? row.marketPrice.minorUnits.toString() : null,
          marketValue: moneyDto(row.marketValue),
          unrealized: moneyDto(row.unrealized ? row.unrealized.unrealized : null),
          realized: moneyRequired(row.realized),
          income: moneyRequired(row.income),
          currency: row.currency,
          valuation: {
            source: row.valuation.source,
            timestamp: row.valuation.timestamp,
            freshnessMs: row.valuation.freshnessMs.toString(),
            quality: row.valuation.quality,
            stale: row.valuation.stale,
          },
        }),
      ),
    ),
    frontendMathAuthoritative: false,
  });
}

export function toGrowPerformanceView(report: PerformanceReport): GrowPerformanceView {
  return Object.freeze({
    schema: 'sunrey.grow.performance.v1',
    methodology: report.methodology,
    formula: report.formula,
    absoluteReturn: moneyRequired(report.absoluteReturn),
    periodReturnBps: report.periodReturnBps === null ? null : report.periodReturnBps.toString(),
    realized: moneyRequired(report.realized),
    unrealized: moneyRequired(report.unrealized),
    income: moneyRequired(report.income),
    cashFlows: Object.freeze(
      report.cashFlows.map((row) =>
        Object.freeze({ at: row.at, kind: row.kind, amount: moneyRequired(row.amount) }),
      ),
    ),
    benchmark: report.benchmark
      ? {
          benchmarkId: report.benchmark.benchmarkId,
          periodReturnBps: report.benchmark.periodReturnBps.toString(),
          deltaBps: report.benchmark.deltaBps === null ? null : report.benchmark.deltaBps.toString(),
        }
      : null,
    insufficientData: report.insufficientData,
    llmAuthoritative: false,
    frontendMathAuthoritative: false,
  });
}

export function toGrowAllocationView(
  allocation: ProductAllocationView,
  target: { readonly cashTargetBps: bigint; readonly weights: readonly { readonly key: string; readonly weightBps: bigint }[] } | null,
): GrowAllocationView {
  const slice = (rows: readonly { readonly key: string; readonly weightBps: bigint; readonly marketValue: { readonly minorUnits: bigint; readonly currency: string } }[]) =>
    Object.freeze(
      rows.map((row) =>
        Object.freeze({
          key: row.key,
          weightBps: row.weightBps.toString(),
          marketValue: moneyRequired(row.marketValue),
        }),
      ),
    );
  return Object.freeze({
    schema: 'sunrey.grow.allocation.v1',
    actual: {
      byAssetClass: slice(allocation.byAssetClass),
      byInstrument: slice(allocation.byInstrument),
      byCurrency: slice(allocation.byCurrency),
      byRiskClass: slice(allocation.byRiskClass),
    },
    target: target
      ? {
          cashTargetBps: target.cashTargetBps.toString(),
          weights: Object.freeze(target.weights.map((row) => Object.freeze({ key: row.key, weightBps: row.weightBps.toString() }))),
        }
      : null,
    frontendMathAuthoritative: false,
  });
}

export function toGrowRiskView(risk: PortfolioRiskView): GrowRiskView {
  return Object.freeze({
    schema: 'sunrey.grow.risk.v1',
    concentration: {
      largestInstrumentId: risk.concentration.largestInstrumentId,
      largestWeightBps: risk.concentration.largestWeightBps.toString(),
    },
    drawdownBps: risk.drawdown.drawdownBps === null ? null : risk.drawdown.drawdownBps.toString(),
    volatilityBps: risk.volatility.stdevBps === null ? null : risk.volatility.stdevBps.toString(),
    volatilityAvailable: risk.volatility.availability === 'AVAILABLE',
    currencyExposure: Object.freeze(risk.currencyExposure.map((row) => Object.freeze({ currency: row.currency, weightBps: row.weightBps.toString() }))),
    liquidityExposure: Object.freeze(risk.liquidityExposure.map((row) => Object.freeze({ liquidity: row.liquidity, weightBps: row.weightBps.toString() }))),
    assetClassExposure: Object.freeze(risk.assetClassExposure.map((row) => Object.freeze({ assetClass: row.assetClass, weightBps: row.weightBps.toString() }))),
    fabricatedStatistics: false,
    frontendMathAuthoritative: false,
  });
}

export function toGrowRecommendationsView(
  items: readonly GrowthInvestmentOpportunity[],
  rebalance: RebalanceProposal | null,
): GrowRecommendationsView {
  return Object.freeze({
    schema: 'sunrey.grow.recommendations.v1',
    items,
    rebalanceProposalId: rebalance?.proposalId ?? null,
    executes: false,
  });
}
