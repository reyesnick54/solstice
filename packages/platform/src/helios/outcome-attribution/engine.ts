import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import { ATTRIBUTION_RULE_FLAGS } from './taxonomy.ts';
import type {
  CanonicalAttributionSourcePort,
  GrowIndependentOutcomeAttribution,
  GrowMoneyDto,
  GrowOutcomeEconomicEvent,
  GrowOutcomeFeeLine,
  GrowOutcomeIncomeLine,
  GrowOutcomePerformanceSeriesPoint,
  GrowOutcomePositionAttribution,
  GrowOutcomeRealizedLine,
  GrowOutcomeResearchCostLine,
  GrowResearchSpendInput,
} from './types.ts';

const EPOCH = asUtcInstant('1970-01-01T00:00:00.000Z');

function money(minorUnits: string, currency: string): GrowMoneyDto {
  return Object.freeze({ minorUnits, currency });
}

function sumMinor(rows: readonly { readonly minorUnits: string }[]): bigint {
  return rows.reduce((acc, row) => acc + BigInt(row.minorUnits), 0n);
}

function mapResearchClass(category: string): GrowOutcomeResearchCostLine['costClass'] {
  if (category.includes('MODEL') || category === 'INFERENCE') {
    return 'MODEL';
  }
  if (category.includes('MARKET') || category === 'MARKET_DATA') {
    return 'MARKET_DATA';
  }
  if (category.includes('TOOL')) {
    return 'TOOL';
  }
  if (category.includes('COMPUTE')) {
    return 'COMPUTE';
  }
  return 'OTHER';
}

function researchCostLines(
  records: readonly GrowResearchSpendInput[],
  customerId: string,
  currency: string,
): readonly GrowOutcomeResearchCostLine[] {
  return Object.freeze(
    records
      .filter((row) => row.customerId === customerId)
      .map((row) => {
        const amount = row.actualAmount ?? row.estimatedAmount ?? '0';
        return Object.freeze({
          spendId: row.spendId,
          costClass: mapResearchClass(row.budgetCategory),
          amount: money(amount, row.currency ?? currency),
          certainty: row.costStatus,
          workOrderId: row.workOrderId,
          taskId: row.taskId,
        });
      }),
  );
}

function dedupeEvents(input: {
  readonly fills: CanonicalAttributionSourcePort['fills'];
  readonly fees: CanonicalAttributionSourcePort['fees'];
  readonly income: CanonicalAttributionSourcePort['income'];
  readonly realized: CanonicalAttributionSourcePort['realized'];
  readonly research: readonly GrowResearchSpendInput[];
  readonly customerId: string;
}): readonly GrowOutcomeEconomicEvent[] {
  const seen = new Set<string>();
  const events: GrowOutcomeEconomicEvent[] = [];
  const push = (event: GrowOutcomeEconomicEvent) => {
    if (seen.has(event.dedupeKey)) {
      return;
    }
    seen.add(event.dedupeKey);
    events.push(event);
  };
  for (const fill of input.fills) {
    push(
      Object.freeze({
        eventId: `evt_fill_${fill.fillId}`,
        sourceRef: fill.providerFillRef,
        kind: 'FILL',
        dedupeKey: `fill:${fill.providerFillRef}`,
        recordedAt: fill.filledAt,
      }),
    );
  }
  for (const fee of input.fees) {
    push(
      Object.freeze({
        eventId: `evt_fee_${fee.feeId}`,
        sourceRef: fee.sourceRef,
        kind: 'FEE',
        dedupeKey: `fee:${fee.sourceRef}:${fee.feeType}`,
        recordedAt: input.fills.find((f) => f.fillId === fee.sourceRef)?.filledAt ?? input.fills[0]?.filledAt ?? EPOCH,
      }),
    );
  }
  for (const row of input.income) {
    push(
      Object.freeze({
        eventId: `evt_income_${row.incomeId}`,
        sourceRef: row.sourceRef,
        kind: 'INCOME',
        dedupeKey: `income:${row.incomeId}`,
        recordedAt: row.receivedAt,
      }),
    );
  }
  for (const row of input.realized) {
    push(
      Object.freeze({
        eventId: `evt_realized_${row.instrumentId}_${row.quantityUnits}`,
        sourceRef: row.lotsConsumed.join(','),
        kind: 'REALIZED',
        dedupeKey: `realized:${row.instrumentId}:${row.lotsConsumed.join(',')}:${row.realizedMinorUnits}`,
        recordedAt: input.fills.find((f) => f.side === 'SELL')?.filledAt ?? EPOCH,
      }),
    );
  }
  for (const row of input.research.filter((r) => r.customerId === input.customerId)) {
    push(
      Object.freeze({
        eventId: `evt_research_${row.spendId}`,
        sourceRef: row.spendId,
        kind: 'RESEARCH',
        dedupeKey: `research:${row.spendId}`,
        recordedAt: row.recordedAt,
      }),
    );
  }
  return Object.freeze(events);
}

export function buildIndependentGrowOutcomeAttribution(input: {
  readonly source: CanonicalAttributionSourcePort;
  readonly researchSpend: readonly GrowResearchSpendInput[];
  readonly workOrderId?: string | null;
  readonly strategyCapsuleId?: string | null;
  readonly now: UtcInstant;
}): GrowIndependentOutcomeAttribution {
  const currency = input.source.reportingCurrency;
  const positions: GrowOutcomePositionAttribution[] = input.source.positions.map((row) => {
    const pendingSettlement = input.source.settlements.some(
      (settlement) =>
        settlement.state === 'PENDING_SETTLEMENT' &&
        input.source.fills.some((fill) => fill.fillId === settlement.fillId && fill.instrumentId === row.instrumentId),
    );
    const stale = row.mark?.freshness === 'STALE';
    const resultKind =
      pendingSettlement || row.positionStatus === 'PENDING'
        ? 'PENDING'
        : stale
          ? 'ESTIMATED'
          : row.unrealizedMinorUnits === null
            ? 'PENDING'
            : 'UNREALIZED';
    return Object.freeze({
      instrumentId: row.instrumentId,
      quantityUnits: row.quantityUnits,
      remainingCostBasis: money(row.remainingCostMinorUnits, row.currency),
      marketValue: row.marketValueMinorUnits ? money(row.marketValueMinorUnits, row.currency) : null,
      unrealized: row.unrealizedMinorUnits ? money(row.unrealizedMinorUnits, row.currency) : null,
      resultKind,
      positionStatus: row.positionStatus,
      markSource: row.mark?.source ?? null,
      markAsOf: row.mark?.asOf ?? null,
      markFreshness: row.mark?.freshness ?? null,
    });
  });

  const realizedLines: GrowOutcomeRealizedLine[] = input.source.realized.map((row) =>
    Object.freeze({
      instrumentId: row.instrumentId,
      quantityUnits: row.quantityUnits,
      proceeds: money(row.proceedsMinorUnits, row.currency),
      costBasis: money(row.costBasisMinorUnits, row.currency),
      fees: money(row.feesMinorUnits, row.currency),
      realized: money(row.realizedMinorUnits, row.currency),
      resultKind: 'REALIZED',
      lotsConsumed: Object.freeze([...row.lotsConsumed]),
    }),
  );

  const fees: GrowOutcomeFeeLine[] = input.source.fees.map((row) =>
    Object.freeze({
      feeId: row.feeId,
      feeType: row.feeType as GrowOutcomeFeeLine['feeType'],
      amount: money(row.amountMinorUnits, row.currency),
      certainty: row.certainty,
      sourceRef: row.sourceRef,
    }),
  );

  const income: GrowOutcomeIncomeLine[] = input.source.income.map((row) =>
    Object.freeze({
      incomeId: row.incomeId,
      incomeType: row.incomeType as GrowOutcomeIncomeLine['incomeType'],
      amount: money(row.amountMinorUnits, row.currency),
      receivedAt: row.receivedAt,
      sourceRef: row.sourceRef,
    }),
  );

  const researchCosts = researchCostLines(input.researchSpend, input.source.customerId, currency);

  const realizedTotalMinor = sumMinor(realizedLines.map((row) => row.realized));
  const unrealizedTotalMinor = sumMinor(
    positions
      .filter((row) => row.unrealized !== null && row.resultKind !== 'PENDING')
      .map((row) => row.unrealized!),
  );
  const feeTotalMinor = sumMinor(fees.map((row) => row.amount));
  const incomeTotalMinor = sumMinor(income.map((row) => row.amount));
  const researchTotalMinor = sumMinor(researchCosts.map((row) => row.amount));

  const grossInvestmentMinor = realizedTotalMinor + unrealizedTotalMinor;
  const netInvestmentMinor = grossInvestmentMinor - feeTotalMinor;
  const netEconomicMinor = netInvestmentMinor + incomeTotalMinor - researchTotalMinor;

  const performanceSeries: GrowOutcomePerformanceSeriesPoint[] = [
    Object.freeze({
      asOf: input.now,
      netContributions: money(input.source.netContributionsMinorUnits, currency),
      investedValue: money(input.source.investedValueMinorUnits, currency),
      cash: money(input.source.cashAvailableMinorUnits, currency),
      portfolioValue: money(input.source.portfolioValueMinorUnits, currency),
      realizedCumulative: money(realizedTotalMinor.toString(), currency),
      unrealized: money(unrealizedTotalMinor.toString(), currency),
      fees: money(feeTotalMinor.toString(), currency),
      income: money(incomeTotalMinor.toString(), currency),
    }),
  ];

  const economicEvents = dedupeEvents({
    fills: input.source.fills,
    fees: input.source.fees,
    income: input.source.income,
    realized: input.source.realized,
    research: input.researchSpend,
    customerId: input.source.customerId,
  });

  return Object.freeze({
    schema: 'sunrey.helios.grow.outcome-attribution.v1',
    customerId: input.source.customerId,
    investmentAccountId: input.source.investmentAccountId,
    workOrderId: input.workOrderId ?? null,
    strategyCapsuleId: input.strategyCapsuleId ?? null,
    reportingCurrency: currency,
    costBasisMethod: input.source.costBasisMethod,
    taxAdvice: false,
    principalDeposits: money(input.source.principalDepositsMinorUnits, currency),
    netContributions: money(input.source.netContributionsMinorUnits, currency),
    capitalDeployed: money(input.source.investedValueMinorUnits, currency),
    cashAvailable: money(input.source.cashAvailableMinorUnits, currency),
    cashUnsettled: money(input.source.cashUnsettledMinorUnits, currency),
    portfolioValue: money(input.source.portfolioValueMinorUnits, currency),
    investedValue: money(input.source.investedValueMinorUnits, currency),
    grossInvestmentResult: money(grossInvestmentMinor.toString(), currency),
    tradingCosts: money(feeTotalMinor.toString(), currency),
    netInvestmentResult: money(netInvestmentMinor.toString(), currency),
    researchOperatingCost: money(researchTotalMinor.toString(), currency),
    netEconomicResult: money(netEconomicMinor.toString(), currency),
    realizedTotal: money(realizedTotalMinor.toString(), currency),
    unrealizedTotal: money(unrealizedTotalMinor.toString(), currency),
    incomeTotal: money(incomeTotalMinor.toString(), currency),
    positions: Object.freeze(positions),
    realizedLines: Object.freeze(realizedLines),
    fees: Object.freeze(fees),
    income: Object.freeze(income),
    researchCosts: Object.freeze(researchCosts),
    reconciliation: Object.freeze({
      result: input.source.reconciliation.result,
      findings: Object.freeze([...input.source.reconciliation.findings]),
      providerResultIsNotCanonical: true,
    }),
    fx: input.source.fx,
    economicEvents,
    performanceSeries: Object.freeze(performanceSeries),
    rules: ATTRIBUTION_RULE_FLAGS,
    serverOwned: true,
    frontendMathAuthoritative: false,
    generatedAt: input.now,
  });
}

export function projectAttributionToPaperPerformance(
  attribution: GrowIndependentOutcomeAttribution,
): {
  readonly initialPaperAllocation: GrowMoneyDto;
  readonly netContributions: GrowMoneyDto;
  readonly currentPaperValue: GrowMoneyDto;
  readonly realizedPaperPnl: GrowMoneyDto;
  readonly unrealizedPaperChange: GrowMoneyDto;
  readonly simulatedFees: GrowMoneyDto;
  readonly simulatedSpreadSlippage: GrowMoneyDto;
  readonly netPaperResult: GrowMoneyDto;
  readonly resultKind: 'PAPER_SIMULATION';
  readonly notLiveCustomerReturn: true;
} {
  const spreadEstimated = attribution.fees
    .filter((row) => row.feeType === 'SPREAD' || row.feeType === 'SLIPPAGE')
    .reduce((sum, row) => sum + BigInt(row.amount.minorUnits), 0n);
  const commissionFees = attribution.fees
    .filter((row) => row.feeType !== 'SPREAD' && row.feeType !== 'SLIPPAGE')
    .reduce((sum, row) => sum + BigInt(row.amount.minorUnits), 0n);
  return Object.freeze({
    initialPaperAllocation: attribution.netContributions,
    netContributions: attribution.netContributions,
    currentPaperValue: attribution.portfolioValue,
    realizedPaperPnl: attribution.realizedTotal,
    unrealizedPaperChange: attribution.unrealizedTotal,
    simulatedFees: money(commissionFees.toString(), attribution.reportingCurrency),
    simulatedSpreadSlippage: money(spreadEstimated.toString(), attribution.reportingCurrency),
    netPaperResult: attribution.netInvestmentResult,
    resultKind: 'PAPER_SIMULATION',
    notLiveCustomerReturn: true,
  });
}
