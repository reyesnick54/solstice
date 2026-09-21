import type { UtcInstant } from '@solstice/domain';
import type { GrowIndependentOutcomeAttribution } from '../../outcome-attribution/types.ts';
import {
  buildPaperGrowCash,
  buildPaperGrowOverview,
  type PaperGrowReadModelInput,
} from '../../paper-grow/read-model.ts';
import type { ConsumerGrowStatus } from '../../paper-grow/status-semantics.ts';
import { resolveInstrumentMetadata } from './instrument-metadata.ts';
import { resolveOperatingMode } from './mode.ts';
import type {
  GrowEconomicImprovementBreakdown,
  GrowMoneyDto,
  GrowPerformancePeriod,
  GrowProductPerformanceResponse,
  GrowProductPerformanceSlice,
  GrowProductPosition,
  GrowProductPositionsResponse,
  GrowProductRiskState,
  GrowProductStrategiesResponse,
  GrowProductStrategySummary,
  GrowProductSummaryResponse,
  GrowPositionExitState,
} from './types.ts';

export type GrowProductContractContext = {
  readonly readModel: PaperGrowReadModelInput;
  readonly attribution: GrowIndependentOutcomeAttribution | null;
  readonly deploymentPaused?: boolean;
};

function money(minorUnits: string, currency: string): GrowMoneyDto {
  return Object.freeze({ minorUnits, currency });
}

function zero(currency: string): GrowMoneyDto {
  return money('0', currency);
}

function deriveRiskState(input: {
  readonly consumerStatus: ConsumerGrowStatus;
  readonly deploymentPaused: boolean;
  readonly degradedReasons: readonly string[];
}): GrowProductRiskState {
  if (input.degradedReasons.some((r) => r === 'AUTHORITY_REVOKED' || r === 'INSUFFICIENT_SANDBOX_CAPITAL')) {
    return 'BLOCKED';
  }
  if (input.deploymentPaused) {
    return 'PAUSED';
  }
  if (input.degradedReasons.length > 0) {
    return 'RESTRICTED';
  }
  if (input.consumerStatus === 'AWAITING_YOUR_DECISION' || input.consumerStatus === 'UNDER_REVIEW') {
    return 'ELEVATED';
  }
  return 'NORMAL';
}

function deriveExitState(
  positionStatus: 'OPEN' | 'CLOSED' | 'PENDING',
  pendingClose: boolean,
): GrowPositionExitState {
  if (positionStatus === 'CLOSED') {
    return 'CLOSED';
  }
  if (pendingClose || positionStatus === 'PENDING') {
    return 'EXIT_PENDING';
  }
  if (positionStatus === 'OPEN') {
    return 'OPEN';
  }
  return 'NONE';
}

function entryPriceFromPosition(
  remainingCostMinorUnits: string,
  quantityUnits: string,
  currency: string,
): GrowMoneyDto | null {
  if (!/^\d+$/.test(quantityUnits) || quantityUnits === '0') {
    return null;
  }
  const qty = BigInt(quantityUnits);
  if (qty === 0n) {
    return null;
  }
  const cost = BigInt(remainingCostMinorUnits);
  return money((cost / qty).toString(), currency);
}

function referencePriceFromPosition(
  marketValueMinorUnits: string | null,
  quantityUnits: string,
  currency: string,
): GrowMoneyDto | null {
  if (!marketValueMinorUnits || !/^\d+$/.test(quantityUnits) || quantityUnits === '0') {
    return null;
  }
  const qty = BigInt(quantityUnits);
  if (qty === 0n) {
    return null;
  }
  return money((BigInt(marketValueMinorUnits) / qty).toString(), currency);
}

function buildEconomicImprovement(
  attribution: GrowIndependentOutcomeAttribution | null,
  currency: string,
): GrowEconomicImprovementBreakdown {
  if (!attribution) {
    return Object.freeze({
      deposits: zero(currency),
      withdrawals: zero(currency),
      realizedInvestmentPnl: zero(currency),
      unrealizedInvestmentPnl: zero(currency),
      fees: zero(currency),
      cashYield: zero(currency),
      rewards: zero(currency),
      savings: zero(currency),
      otherEconomicImprovement: zero(currency),
      principalDepositsAreNotGrowth: true,
      unrealizedIsNotWithdrawable: true,
    });
  }
  const feeTotal = attribution.fees.reduce((sum, row) => sum + BigInt(row.amount.minorUnits), 0n);
  const incomeTotal = attribution.income.reduce((sum, row) => sum + BigInt(row.amount.minorUnits), 0n);
  const researchTotal = attribution.researchCosts.reduce(
    (sum, row) => sum + BigInt(row.amount.minorUnits),
    0n,
  );
  const netContributions = BigInt(attribution.netContributions.minorUnits);
  const deposits = BigInt(attribution.principalDeposits.minorUnits);
  const withdrawals =
    netContributions >= deposits ? '0' : (deposits - netContributions).toString();
  return Object.freeze({
    deposits: money(deposits.toString(), currency),
    withdrawals: money(withdrawals, currency),
    realizedInvestmentPnl: attribution.realizedTotal,
    unrealizedInvestmentPnl: attribution.unrealizedTotal,
    fees: money(feeTotal.toString(), currency),
    cashYield: money(incomeTotal.toString(), currency),
    rewards: zero(currency),
    savings: zero(currency),
    otherEconomicImprovement: money(researchTotal.toString(), currency),
    principalDepositsAreNotGrowth: true,
    unrealizedIsNotWithdrawable: true,
  });
}

export function buildGrowProductSummary(context: GrowProductContractContext): GrowProductSummaryResponse {
  const overview = buildPaperGrowOverview(context.readModel);
  const cash = buildPaperGrowCash(context.readModel);
  const currency = context.readModel.ledgerCash.currency;
  const attribution = context.attribution;
  const authorized =
    BigInt(overview.allocate.amountAssigned.minorUnits) +
    BigInt(overview.allocate.deployedCapital.minorUnits) +
    BigInt(overview.allocate.reservedAmount.minorUnits);
  const portfolioEquity = attribution?.portfolioValue ?? overview.performance.currentPaperValue;
  const verifiedReturn = attribution?.netInvestmentResult ?? overview.performance.netPaperResult;
  return Object.freeze({
    schema: 'sunrey.consumer.grow.summary.v1',
    customerId: context.readModel.customerId,
    subjectId: context.readModel.subjectId,
    operatingMode: resolveOperatingMode(context.readModel),
    operatingState: overview.consumerStatus,
    cycleStatus: overview.cycleStatus,
    riskState: deriveRiskState({
      consumerStatus: overview.consumerStatus,
      deploymentPaused: context.deploymentPaused ?? false,
      degradedReasons: context.readModel.degradedReasons,
    }),
    totalAuthorizedGrowCapital: money(authorized.toString(), currency),
    activeDeployedCapital: overview.allocate.deployedCapital,
    reservedCapital: overview.allocate.reservedAmount,
    settledCash: cash.totalCanonicalSandboxCash,
    availableCapital: cash.availableUnreserved,
    withdrawableCash: cash.settledWithdrawable,
    portfolioEquity,
    realizedPnl: attribution?.realizedTotal ?? overview.performance.realizedPaperPnl,
    unrealizedPnl: attribution?.unrealizedTotal ?? overview.performance.unrealizedPaperChange,
    totalVerifiedInvestmentReturn: verifiedReturn,
    economicImprovement: buildEconomicImprovement(attribution, currency),
    disclosure: overview.disclosure,
    valuationFreshness: context.readModel.valuationFreshness ?? null,
    frontendMathAuthoritative: false,
    serverOwned: true,
  });
}

export function buildGrowProductPositions(context: GrowProductContractContext): readonly GrowProductPosition[] {
  const overview = buildPaperGrowOverview(context.readModel);
  const currency = context.readModel.ledgerCash.currency;
  const strategyRef = overview.activeCapital.strategies[0]?.strategyRef ?? 'grow-primary';
  const strategyLabel = overview.activeCapital.strategies[0]?.displayName ?? 'Grow primary strategy';
  const riskState = deriveRiskState({
    consumerStatus: overview.consumerStatus,
    deploymentPaused: context.deploymentPaused ?? false,
    degradedReasons: context.readModel.degradedReasons,
  });
  const pendingClose = context.deploymentPaused;
  const positions: GrowProductPosition[] = [];

  if (context.attribution) {
    for (const row of context.attribution.positions) {
      const meta = resolveInstrumentMetadata(row.instrumentId);
      const realizedForInstrument = context.attribution.realizedLines
        .filter((line) => line.instrumentId === row.instrumentId)
        .reduce((sum, line) => sum + BigInt(line.realized.minorUnits), 0n);
      positions.push(
        Object.freeze({
          positionId: `pos_${row.instrumentId}_${context.readModel.customerId}`,
          instrumentId: row.instrumentId,
          instrumentLabel: meta.displayLabel,
          strategyRef,
          strategyLabel,
          assetClass: meta.assetClass,
          quantity: row.quantityUnits,
          entryPrice: entryPriceFromPosition(row.remainingCostBasis.minorUnits, row.quantityUnits, currency),
          currentReferencePrice: referencePriceFromPosition(
            row.marketValue?.minorUnits ?? null,
            row.quantityUnits,
            currency,
          ),
          unrealizedPnl: row.unrealized,
          realizedPnl: money(realizedForInstrument.toString(), currency),
          positionAgeDays: null,
          openedAt: row.markAsOf,
          riskState,
          exitState: deriveExitState(row.positionStatus, pendingClose),
          positionStatus: row.positionStatus,
        }),
      );
    }
    return Object.freeze(positions);
  }

  for (const row of overview.activeCapital.paperPositions) {
    const meta = resolveInstrumentMetadata(row.instrumentId);
    positions.push(
      Object.freeze({
        positionId: `pos_${row.instrumentId}_${context.readModel.customerId}`,
        instrumentId: row.instrumentId,
        instrumentLabel: meta.displayLabel,
        strategyRef,
        strategyLabel,
        assetClass: meta.assetClass,
        quantity: row.quantityUnits,
        entryPrice: null,
        currentReferencePrice: referencePriceFromPosition(
          row.marketValue?.minorUnits ?? null,
          row.quantityUnits,
          currency,
        ),
        unrealizedPnl: row.unrealized,
        realizedPnl: zero(currency),
        positionAgeDays: null,
        openedAt: null,
        riskState,
        exitState: deriveExitState(row.positionStatus, pendingClose),
        positionStatus: row.positionStatus,
      }),
    );
  }
  return Object.freeze(positions);
}

export function buildGrowProductPositionsResponse(context: GrowProductContractContext): GrowProductPositionsResponse {
  const overview = buildPaperGrowOverview(context.readModel);
  return Object.freeze({
    schema: 'sunrey.consumer.grow.positions.v1',
    customerId: context.readModel.customerId,
    items: buildGrowProductPositions(context),
    nextCursor: null,
    hasMore: false,
    disclosure: overview.disclosure,
    frontendMathAuthoritative: false,
    serverOwned: true,
  });
}

export function buildGrowProductStrategies(context: GrowProductContractContext): GrowProductStrategiesResponse {
  const overview = buildPaperGrowOverview(context.readModel);
  const currency = context.readModel.ledgerCash.currency;
  const attribution = context.attribution;
  const riskState = deriveRiskState({
    consumerStatus: overview.consumerStatus,
    deploymentPaused: context.deploymentPaused ?? false,
    degradedReasons: context.readModel.degradedReasons,
  });
  const items: GrowProductStrategySummary[] = overview.activeCapital.strategies.map((strategy) => {
    const capsule = overview.activeCapital.strategyCapsules[0] ?? null;
    const instruments = overview.activeCapital.paperPositions.map((row) => row.instrumentId);
    return Object.freeze({
      strategyRef: strategy.strategyRef,
      strategyFamily: capsule ? 'MULTI_ASSET_CAPSULE' : 'GROW_PRIMARY',
      strategyVersion: overview.plan.planVersion ? `v${String(overview.plan.planVersion)}` : 'v1',
      displayName: strategy.displayName,
      status: strategy.status,
      instruments: Object.freeze(instruments),
      paperEligible: true as const,
      liveEligible: false as const,
      allocation: strategy.deployedAmount,
      performanceAttribution: Object.freeze({
        realized: attribution?.realizedTotal ?? overview.performance.realizedPaperPnl,
        unrealized: attribution?.unrealizedTotal ?? overview.performance.unrealizedPaperChange,
        fees: attribution
          ? money(
              attribution.fees.reduce((sum, row) => sum + BigInt(row.amount.minorUnits), 0n).toString(),
              currency,
            )
          : overview.performance.simulatedFees,
        netVerifiedReturn: attribution?.netInvestmentResult ?? overview.performance.netPaperResult,
      }),
      riskContribution: riskState,
      strategyCapsuleId: capsule?.capsuleId ?? attribution?.strategyCapsuleId ?? null,
    });
  });
  return Object.freeze({
    schema: 'sunrey.consumer.grow.strategies.v1',
    customerId: context.readModel.customerId,
    items: Object.freeze(items),
    disclosure: overview.disclosure,
    frontendMathAuthoritative: false,
    serverOwned: true,
  });
}

function periodStart(period: GrowPerformancePeriod, endAt: UtcInstant): UtcInstant | null {
  const endMs = Date.parse(endAt);
  if (Number.isNaN(endMs)) {
    return null;
  }
  const dayMs = 86_400_000;
  switch (period) {
    case 'daily':
      return new Date(endMs - dayMs).toISOString() as UtcInstant;
    case 'weekly':
      return new Date(endMs - 7 * dayMs).toISOString() as UtcInstant;
    case 'monthly':
      return new Date(endMs - 30 * dayMs).toISOString() as UtcInstant;
    case 'since_inception':
      return null;
    default:
      return null;
  }
}

function filterSeriesByPeriod<T extends { readonly asOf: UtcInstant }>(
  series: readonly T[],
  period: GrowPerformancePeriod,
  endAt: UtcInstant,
): readonly T[] {
  const start = periodStart(period, endAt);
  if (!start) {
    return series;
  }
  return Object.freeze(series.filter((row) => row.asOf >= start && row.asOf <= endAt));
}

function deltaMoney(current: GrowMoneyDto, baseline: GrowMoneyDto | null): GrowMoneyDto {
  if (!baseline) {
    return current;
  }
  const delta = BigInt(current.minorUnits) - BigInt(baseline.minorUnits);
  return money(delta.toString(), current.currency);
}

export function buildGrowProductPerformance(
  context: GrowProductContractContext,
  period: GrowPerformancePeriod,
): GrowProductPerformanceResponse {
  const overview = buildPaperGrowOverview(context.readModel);
  const attribution = context.attribution;
  const endAt = attribution?.generatedAt ?? context.readModel.valuationFreshness ?? overview.plan.updatedAt ?? overview.plan.createdAt;
  const currency = context.readModel.ledgerCash.currency;
  if (!endAt) {
    const empty = zero(currency);
    const slice: GrowProductPerformanceSlice = Object.freeze({
      period,
      startAt: null,
      endAt: context.readModel.valuationFreshness ?? ('1970-01-01T00:00:00.000Z' as UtcInstant),
      netContributions: overview.performance.netContributions,
      portfolioValue: overview.performance.currentPaperValue,
      realizedInvestmentPnl: overview.performance.realizedPaperPnl,
      unrealizedInvestmentPnl: overview.performance.unrealizedPaperChange,
      fees: overview.performance.simulatedFees,
      cashYield: zero(currency),
      rewards: zero(currency),
      savings: zero(currency),
      otherEconomicImprovement: overview.performance.operatingResearchCost,
      totalVerifiedInvestmentReturn: overview.performance.netPaperResult,
      depositsAreNotPerformance: true,
      unrealizedIsNotWithdrawable: true,
    });
    return Object.freeze({
      schema: 'sunrey.consumer.grow.product-performance.v1',
      customerId: context.readModel.customerId,
      period,
      slice,
      disclosure: overview.disclosure,
      frontendMathAuthoritative: false,
      serverOwned: true,
    });
  }

  const series = attribution ? filterSeriesByPeriod(attribution.performanceSeries, period, endAt) : [];
  const baseline = series.length > 0 ? series[0] : null;
  const latest = series.length > 0 ? series[series.length - 1] : null;
  const improvement = buildEconomicImprovement(attribution, currency);
  const slice: GrowProductPerformanceSlice = Object.freeze({
    period,
    startAt: periodStart(period, endAt),
    endAt,
    netContributions: latest
      ? deltaMoney(latest.netContributions, baseline?.netContributions ?? null)
      : overview.performance.netContributions,
    portfolioValue: latest?.portfolioValue ?? overview.performance.currentPaperValue,
    realizedInvestmentPnl: latest
      ? deltaMoney(latest.realizedCumulative, baseline?.realizedCumulative ?? null)
      : improvement.realizedInvestmentPnl,
    unrealizedInvestmentPnl: latest?.unrealized ?? improvement.unrealizedInvestmentPnl,
    fees: latest ? deltaMoney(latest.fees, baseline?.fees ?? null) : improvement.fees,
    cashYield: latest ? deltaMoney(latest.income, baseline?.income ?? null) : improvement.cashYield,
    rewards: improvement.rewards,
    savings: improvement.savings,
    otherEconomicImprovement: improvement.otherEconomicImprovement,
    totalVerifiedInvestmentReturn: attribution?.netInvestmentResult ?? overview.performance.netPaperResult,
    depositsAreNotPerformance: true,
    unrealizedIsNotWithdrawable: true,
  });
  return Object.freeze({
    schema: 'sunrey.consumer.grow.product-performance.v1',
    customerId: context.readModel.customerId,
    period,
    slice,
    disclosure: overview.disclosure,
    frontendMathAuthoritative: false,
    serverOwned: true,
  });
}

export function parseGrowPerformancePeriod(raw: string | undefined): GrowPerformancePeriod | null {
  if (!raw || raw === 'since_inception') {
    return 'since_inception';
  }
  if (raw === 'daily' || raw === 'weekly' || raw === 'monthly') {
    return raw;
  }
  return null;
}
