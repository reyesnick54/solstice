import type { UtcInstant } from '../../domain/src/time.ts';
import type { CurrencyCashFlowAnalysis } from './cash-flow-analysis.ts';

/** Phase C presentation valuation shape. PEG does not import payments. */
export type SnapshotPresentationValuation = {
  readonly authority: 'PRESENTATION_ONLY_NOT_LEDGER';
  readonly ledgerAuthoritative: false;
  readonly targetCurrency: string;
  readonly asOf: string;
  readonly stale: boolean;
  readonly available: boolean;
  readonly reason: string | null;
  readonly aggregateMinorUnits: string | null;
  readonly lines: readonly {
    readonly currency: string;
    readonly sourceMinorUnits: string;
    readonly convertedMinorUnits: string;
    readonly targetCurrency: string;
    readonly rateNumerator: string;
    readonly rateDenominator: string;
    readonly rateKind: 'REFERENCE';
    readonly rateTimestamp: string;
    readonly stale: boolean;
    readonly available: boolean;
  }[];
};

export type SnapshotValuationPort = {
  valuePositions(
    positions: readonly { readonly currency: string; readonly minorUnits: bigint }[],
    targetCurrency: string,
  ): SnapshotPresentationValuation | null;
};
import type { EconomicGraphId, EconomicSnapshotId } from './ids.ts';
import type { DerivedInsight } from './insights.ts';
import type { SuitabilityProfile } from './suitability.ts';
import type { GoalKind, GoalStatus, SerializedMoney } from './taxonomy.ts';

export type CurrencyPosition = {
  readonly amount: SerializedMoney;
  readonly source: string;
  readonly sourceReference: string;
  readonly observedAt: UtcInstant;
  readonly userDeclared: boolean;
  readonly derived: boolean;
};

export type SnapshotAsset = {
  readonly nodeId: string;
  readonly kind: string;
  readonly label: string;
  readonly estimatedValue: SerializedMoney | null;
  readonly valuationSource: string | null;
  readonly valuationDate: UtcInstant | null;
  readonly userDeclared: boolean;
};

export type SnapshotLiability = {
  readonly nodeId: string;
  readonly kind: string;
  readonly label: string;
  readonly estimatedBalance: SerializedMoney | null;
  readonly valuationSource: string | null;
  readonly valuationDate: UtcInstant | null;
  readonly userDeclared: boolean;
};

export type SnapshotGoalView = {
  readonly goalId: string;
  readonly name: string;
  readonly goalKind: GoalKind;
  readonly targetAmount: SerializedMoney;
  readonly currency: string;
  readonly targetDate: UtcInstant | null;
  readonly priority: number;
  readonly minimumLiquidity: SerializedMoney | null;
  readonly currentAllocatedValue: SerializedMoney | null;
  readonly status: GoalStatus;
  readonly createdAt: UtcInstant;
};

export type CurrencyExposure = {
  readonly currency: string;
  readonly cashMinorUnits: string;
  readonly investmentMinorUnits: string;
  readonly shareIsNotFxConverted: true;
};

/**
 * Client-safe financial snapshot. Unlike currencies are never summed.
 * Presentation valuation uses Phase C interfaces and is not Ledger authority.
 */
export type FinancialIntelligenceSnapshot = {
  readonly snapshotId: EconomicSnapshotId;
  readonly graphId: EconomicGraphId;
  readonly subjectId: string;
  readonly generatedAt: UtcInstant;
  readonly cash: readonly CurrencyPosition[];
  readonly investments: readonly SnapshotAsset[];
  readonly assets: readonly SnapshotAsset[];
  readonly liabilities: readonly SnapshotLiability[];
  readonly netPositionByCurrency: readonly CurrencyPosition[];
  readonly monthlyIncome: readonly CurrencyPosition[];
  readonly monthlyRecurringExpenses: readonly CurrencyPosition[];
  readonly estimatedDiscretionaryCashFlow: readonly CurrencyPosition[];
  readonly liquidity: readonly CurrencyPosition[];
  readonly financialGoals: readonly SnapshotGoalView[];
  readonly riskProfile: SuitabilityProfile | null;
  readonly investmentHorizon: SuitabilityProfile['timeHorizon'] | null;
  readonly currencyExposure: readonly CurrencyExposure[];
  readonly cashFlow: readonly CurrencyCashFlowAnalysis[];
  readonly insights: readonly DerivedInsight[];
  readonly presentationValuation: SnapshotPresentationValuation | null;
  readonly valuationContext: SnapshotPresentationValuation | null;
  readonly crossCurrencyTotal: null;
  readonly authoritativeBalance: false;
  readonly ledgerWins: true;
  readonly guaranteedReturn: false;
  readonly projectionIsCertainty: false;
};

export function freezeFinancialSnapshot(snapshot: FinancialIntelligenceSnapshot): FinancialIntelligenceSnapshot {
  return Object.freeze({
    ...snapshot,
    cash: Object.freeze([...snapshot.cash]),
    investments: Object.freeze([...snapshot.investments]),
    assets: Object.freeze([...snapshot.assets]),
    liabilities: Object.freeze([...snapshot.liabilities]),
    netPositionByCurrency: Object.freeze([...snapshot.netPositionByCurrency]),
    monthlyIncome: Object.freeze([...snapshot.monthlyIncome]),
    monthlyRecurringExpenses: Object.freeze([...snapshot.monthlyRecurringExpenses]),
    estimatedDiscretionaryCashFlow: Object.freeze([...snapshot.estimatedDiscretionaryCashFlow]),
    liquidity: Object.freeze([...snapshot.liquidity]),
    financialGoals: Object.freeze([...snapshot.financialGoals]),
    currencyExposure: Object.freeze([...snapshot.currencyExposure]),
    cashFlow: Object.freeze([...snapshot.cashFlow]),
    insights: Object.freeze([...snapshot.insights]),
    presentationValuation: snapshot.presentationValuation,
    valuationContext: snapshot.valuationContext,
    crossCurrencyTotal: null,
    authoritativeBalance: false,
    ledgerWins: true,
    guaranteedReturn: false,
    projectionIsCertainty: false,
  });
}

export type GrowProfileView = {
  readonly schema: 'sunrey.grow.profile.v1';
  readonly subjectId: string;
  readonly generatedAt: UtcInstant;
  readonly netPositionByCurrency: readonly CurrencyPosition[];
  readonly cash: readonly CurrencyPosition[];
  readonly investments: readonly SnapshotAsset[];
  readonly income: readonly CurrencyPosition[];
  readonly expenses: readonly CurrencyPosition[];
  readonly goals: readonly SnapshotGoalView[];
  readonly riskProfile: SuitabilityProfile | null;
  readonly liquidity: readonly CurrencyPosition[];
  readonly financialStrengths: readonly string[];
  readonly areasToImprove: readonly string[];
  readonly presentationValuation: SnapshotPresentationValuation | null;
  readonly authoritativeBalance: false;
  readonly ledgerWins: true;
  readonly userEditable: readonly ['goals', 'incomeAssumptions', 'declaredAssets', 'declaredLiabilities', 'riskQuestionnaire', 'preferences', 'activityClassifications'];
  readonly serverAuthoritative: readonly ['cash', 'sunreyAccountBalances', 'investmentsFromService', 'derivedInsights', 'suitabilityAssessment'];
};

export function strengthsAndImprovements(insights: readonly DerivedInsight[]): {
  readonly strengths: readonly string[];
  readonly improvements: readonly string[];
} {
  const improvements = insights
    .filter((item) => item.severity === 'ATTENTION' || item.severity === 'HIGH' || item.severity === 'WATCH')
    .map((item) => item.evidence[0] ?? item.type);
  const strengths = insights.filter((item) => item.type === 'UNUSED_RECURRING_SURPLUS').map((item) => item.evidence[0] ?? item.type);
  return {
    strengths: Object.freeze(strengths.length > 0 ? strengths : ['no derived strength signals in the current window']),
    improvements: Object.freeze(improvements),
  };
}
