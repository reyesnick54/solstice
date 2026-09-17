import type { UtcInstant } from '@solstice/domain';
import type {
  AttributionResultKind,
  CostBasisMethod,
  FeeCertainty,
  FeeType,
  IncomeType,
  ResearchCostClass,
} from './taxonomy.ts';

export type GrowMoneyDto = {
  readonly minorUnits: string;
  readonly currency: string;
};

export type GrowOutcomeEconomicEvent = {
  readonly eventId: string;
  readonly sourceRef: string;
  readonly kind: 'FILL' | 'FEE' | 'INCOME' | 'REALIZED' | 'RESEARCH';
  readonly dedupeKey: string;
  readonly recordedAt: UtcInstant;
};

export type GrowOutcomeFeeLine = {
  readonly feeId: string;
  readonly feeType: FeeType;
  readonly amount: GrowMoneyDto;
  readonly certainty: FeeCertainty;
  readonly sourceRef: string;
};

export type GrowOutcomeIncomeLine = {
  readonly incomeId: string;
  readonly incomeType: IncomeType;
  readonly amount: GrowMoneyDto;
  readonly receivedAt: UtcInstant;
  readonly sourceRef: string;
};

export type GrowOutcomeResearchCostLine = {
  readonly spendId: string;
  readonly costClass: ResearchCostClass;
  readonly amount: GrowMoneyDto;
  readonly certainty: FeeCertainty;
  readonly workOrderId: string | null;
  readonly taskId: string | null;
};

export type GrowOutcomePositionAttribution = {
  readonly instrumentId: string;
  readonly quantityUnits: string;
  readonly remainingCostBasis: GrowMoneyDto;
  readonly marketValue: GrowMoneyDto | null;
  readonly unrealized: GrowMoneyDto | null;
  readonly resultKind: AttributionResultKind;
  readonly positionStatus: 'OPEN' | 'CLOSED' | 'PENDING';
  readonly markSource: string | null;
  readonly markAsOf: UtcInstant | null;
  readonly markFreshness: 'FRESH' | 'STALE' | 'UNKNOWN' | null;
};

export type GrowOutcomeRealizedLine = {
  readonly instrumentId: string;
  readonly quantityUnits: string;
  readonly proceeds: GrowMoneyDto;
  readonly costBasis: GrowMoneyDto;
  readonly fees: GrowMoneyDto;
  readonly realized: GrowMoneyDto;
  readonly resultKind: 'REALIZED';
  readonly lotsConsumed: readonly string[];
};

export type GrowOutcomeFxContext = {
  readonly sourceCurrency: string;
  readonly reportingCurrency: string;
  readonly rateNumerator: string;
  readonly rateDenominator: string;
  readonly asOf: UtcInstant;
  readonly methodology: string;
  readonly reference: string;
} | null;

export type GrowOutcomeReconciliation = {
  readonly result: string;
  readonly findings: readonly string[];
  readonly providerResultIsNotCanonical: true;
};

export type GrowOutcomePerformanceSeriesPoint = {
  readonly asOf: UtcInstant;
  readonly netContributions: GrowMoneyDto;
  readonly investedValue: GrowMoneyDto;
  readonly cash: GrowMoneyDto;
  readonly portfolioValue: GrowMoneyDto;
  readonly realizedCumulative: GrowMoneyDto;
  readonly unrealized: GrowMoneyDto;
  readonly fees: GrowMoneyDto;
  readonly income: GrowMoneyDto;
};

export type GrowIndependentOutcomeAttribution = {
  readonly schema: 'sunrey.helios.grow.outcome-attribution.v1';
  readonly customerId: string;
  readonly investmentAccountId: string;
  readonly workOrderId: string | null;
  readonly strategyCapsuleId: string | null;
  readonly reportingCurrency: string;
  readonly costBasisMethod: CostBasisMethod;
  readonly taxAdvice: false;
  readonly principalDeposits: GrowMoneyDto;
  readonly netContributions: GrowMoneyDto;
  readonly capitalDeployed: GrowMoneyDto;
  readonly cashAvailable: GrowMoneyDto;
  readonly cashUnsettled: GrowMoneyDto;
  readonly portfolioValue: GrowMoneyDto;
  readonly investedValue: GrowMoneyDto;
  readonly grossInvestmentResult: GrowMoneyDto;
  readonly tradingCosts: GrowMoneyDto;
  readonly netInvestmentResult: GrowMoneyDto;
  readonly researchOperatingCost: GrowMoneyDto;
  readonly netEconomicResult: GrowMoneyDto;
  readonly realizedTotal: GrowMoneyDto;
  readonly unrealizedTotal: GrowMoneyDto;
  readonly incomeTotal: GrowMoneyDto;
  readonly positions: readonly GrowOutcomePositionAttribution[];
  readonly realizedLines: readonly GrowOutcomeRealizedLine[];
  readonly fees: readonly GrowOutcomeFeeLine[];
  readonly income: readonly GrowOutcomeIncomeLine[];
  readonly researchCosts: readonly GrowOutcomeResearchCostLine[];
  readonly reconciliation: GrowOutcomeReconciliation;
  readonly fx: GrowOutcomeFxContext;
  readonly economicEvents: readonly GrowOutcomeEconomicEvent[];
  readonly performanceSeries: readonly GrowOutcomePerformanceSeriesPoint[];
  readonly rules: typeof import('./taxonomy.ts').ATTRIBUTION_RULE_FLAGS;
  readonly serverOwned: true;
  readonly frontendMathAuthoritative: false;
  readonly generatedAt: UtcInstant;
};

export type GrowResearchSpendInput = {
  readonly spendId: string;
  readonly workOrderId: string;
  readonly taskId: string;
  readonly customerId: string;
  readonly budgetCategory: string;
  readonly actualAmount: string | null;
  readonly estimatedAmount: string | null;
  readonly costStatus: 'ACTUAL' | 'ESTIMATED' | 'UNKNOWN';
  readonly currency: string | null;
  readonly recordedAt: UtcInstant;
};

export type CanonicalAttributionSourcePort = {
  readonly customerId: string;
  readonly investmentAccountId: string;
  readonly reportingCurrency: string;
  readonly costBasisMethod: 'FIFO_SIMULATION_ACCOUNTING_METHOD';
  readonly taxAdvice: false;
  readonly positions: readonly {
    readonly instrumentId: string;
    readonly quantityUnits: string;
    readonly settledQuantityUnits: string;
    readonly unsettledQuantityUnits: string;
    readonly remainingCostMinorUnits: string;
    readonly marketValueMinorUnits: string | null;
    readonly unrealizedMinorUnits: string | null;
    readonly currency: string;
    readonly positionStatus: 'OPEN' | 'CLOSED' | 'PENDING';
    readonly mark: {
      readonly source: string;
      readonly asOf: UtcInstant;
      readonly staleAfter: UtcInstant | null;
      readonly freshness: 'FRESH' | 'STALE' | 'UNKNOWN';
      readonly methodology: string;
    } | null;
  }[];
  readonly realized: readonly {
    readonly instrumentId: string;
    readonly quantityUnits: string;
    readonly proceedsMinorUnits: string;
    readonly costBasisMinorUnits: string;
    readonly feesMinorUnits: string;
    readonly realizedMinorUnits: string;
    readonly currency: string;
    readonly lotsConsumed: readonly string[];
  }[];
  readonly fills: readonly {
    readonly fillId: string;
    readonly providerFillRef: string;
    readonly side: 'BUY' | 'SELL';
    readonly feeMinorUnits: string;
    readonly currency: string;
    readonly filledAt: UtcInstant;
  }[];
  readonly settlements: readonly {
    readonly settlementId: string;
    readonly fillId: string;
    readonly state: 'TRADE_DATE' | 'PENDING_SETTLEMENT' | 'SETTLED';
    readonly feeMinorUnits: string;
    readonly currency: string;
  }[];
  readonly fees: readonly {
    readonly feeId: string;
    readonly feeType: string;
    readonly amountMinorUnits: string;
    readonly currency: string;
    readonly certainty: 'ACTUAL' | 'ESTIMATED' | 'UNKNOWN';
    readonly sourceRef: string;
  }[];
  readonly income: readonly {
    readonly incomeId: string;
    readonly incomeType: string;
    readonly amountMinorUnits: string;
    readonly currency: string;
    readonly receivedAt: UtcInstant;
    readonly sourceRef: string;
  }[];
  readonly principalDepositsMinorUnits: string;
  readonly netContributionsMinorUnits: string;
  readonly cashAvailableMinorUnits: string;
  readonly cashUnsettledMinorUnits: string;
  readonly portfolioValueMinorUnits: string;
  readonly investedValueMinorUnits: string;
  readonly reconciliation: {
    readonly result: string;
    readonly findings: readonly string[];
  };
  readonly fx: GrowOutcomeFxContext;
  readonly extractedAt: UtcInstant;
};
