import type { FactConfidence } from '../../../personal-economic-graph/src/provenance.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { SerializedMoney } from '../mandate/types.ts';
import type {
  AttributionEntryId,
  AttributionGroupId,
  AttributionPeriodId,
  CounterfactualBaselineId,
  DataContributionReferenceId,
  EconomicValueDimensionId,
  EconomicValueModelVersion,
  EconomicValueProfileId,
  EconomicValueSnapshotId,
  IndexPoints,
  ValuationFormulaVersion,
} from './ids.ts';
import type {
  AttributionSourceSystem,
  AttributionType,
  CashFlowQualityState,
  DataCompletenessState,
  EconomicValueDimensionKind,
  FormulaLifecycle,
  ValueRealizationState,
} from './taxonomy.ts';

export type IndexMeasure = {
  readonly kind: 'INDEX';
  readonly points: string;
  readonly scale: 100;
  readonly unit: 'POINTS_PER_HUNDRED';
  readonly isMoney: false;
};

export type MoneyMeasure = {
  readonly kind: 'MONEY';
  readonly amount: SerializedMoney;
  readonly isIndex: false;
};

export type RationalQuantity = {
  readonly numerator: string;
  readonly denominator: string;
};

export type SourceFactRef = {
  readonly ref: string;
  readonly confidence: FactConfidence;
  readonly key: string;
};

export type FxValuationContext = {
  readonly baseCurrency: string;
  readonly rate: { readonly numerator: string; readonly denominator: string };
  readonly fromCurrency: string;
  readonly toCurrency: string;
  readonly source: string;
  readonly timestamp: UtcInstant;
  readonly conversionMethod: 'RATIONAL_HALF_EVEN';
};

export type DimensionResult = {
  readonly dimensionId: EconomicValueDimensionId;
  readonly kind: EconomicValueDimensionKind;
  readonly definition: string;
  readonly measure: IndexMeasure;
  readonly moneyCompanion?: MoneyMeasure;
  readonly meaning: string;
  readonly factsUsed: readonly SourceFactRef[];
  readonly factsMissing: readonly string[];
  readonly calculation: string;
  readonly formulaVersion: ValuationFormulaVersion;
  readonly computedAt: UtcInstant;
  readonly confidence: FactConfidence;
  readonly limitations: readonly string[];
  readonly priorPoints?: string;
  readonly changePoints?: string;
};

export type EconomicValueVector = {
  readonly dimensions: readonly DimensionResult[];
  readonly decomposable: true;
  readonly opaqueScoreForbidden: true;
};

export type CompositeIndicator = {
  readonly name: 'PEVE_COMPOSITE_INDEX';
  readonly measure: IndexMeasure;
  readonly formulaVersion: ValuationFormulaVersion;
  readonly modelVersion: EconomicValueModelVersion;
  readonly weights: Readonly<Record<EconomicValueDimensionKind, number>>;
  readonly weightDenominator: 10000;
  readonly decomposition: readonly {
    readonly kind: EconomicValueDimensionKind;
    readonly points: string;
    readonly weight: number;
    readonly weightedPoints: string;
  }[];
  readonly notHumanWorth: true;
  readonly notCreditScore: true;
  readonly notRegulatoryEligibility: true;
  readonly explanation: string;
};

export type GoalProgressView = {
  readonly goalId: string;
  readonly label: string;
  readonly target?: SerializedMoney;
  readonly currentAttributable?: SerializedMoney;
  readonly remaining?: SerializedMoney;
  readonly timeHorizon?: string;
  readonly status: string;
  readonly unrealizedMarketCounted: false;
};

export type OpportunityCapacityView = {
  readonly currency: string;
  readonly availableLiquidity?: SerializedMoney;
  readonly protectedFloor?: SerializedMoney;
  readonly scheduledObligations?: SerializedMoney;
  readonly knownDebt?: SerializedMoney;
  readonly mandateLimit?: SerializedMoney;
  readonly informationalFlexibility?: SerializedMoney;
  readonly quality: CashFlowQualityState;
  readonly mayExecute: false;
  readonly limitations: readonly string[];
};

export type ReserveCoverageView = {
  readonly currency: string;
  readonly liquidReserves?: SerializedMoney;
  readonly essentialMonthlyObligations?: SerializedMoney;
  readonly coverage: RationalQuantity | null;
  readonly quality: CashFlowQualityState;
  readonly warnings: readonly string[];
};

export type CashFlowCapacityView = {
  readonly currency: string;
  readonly knownInflows?: SerializedMoney;
  readonly knownOutflows?: SerializedMoney;
  readonly surplus?: SerializedMoney;
  readonly quality: CashFlowQualityState;
  readonly warnings: readonly string[];
};

export type DebtBurdenView = {
  readonly currency: string;
  readonly estimatedDebt?: SerializedMoney;
  readonly knownIncome?: SerializedMoney;
  readonly pressure: RationalQuantity | null;
  readonly notCreditScore: true;
  readonly notRegulatoryDti: true;
  readonly quality: CashFlowQualityState;
  readonly warnings: readonly string[];
};

export type EconomicValueSnapshot = {
  readonly snapshotId: EconomicValueSnapshotId;
  readonly profileId: EconomicValueProfileId;
  readonly subjectId: string;
  readonly generatedAt: UtcInstant;
  readonly pegSnapshotId: string;
  readonly growthPlanId?: string;
  readonly formulaVersion: ValuationFormulaVersion;
  readonly modelVersion: EconomicValueModelVersion;
  readonly valuationContext: {
    readonly primaryCurrency: string;
    readonly fx?: FxValuationContext;
    readonly notHumanWorth: true;
    readonly notCreditScore: true;
    readonly notExecutionAuthority: true;
  };
  readonly vector: EconomicValueVector;
  readonly composite: CompositeIndicator;
  readonly reserveCoverage: readonly ReserveCoverageView[];
  readonly cashFlowCapacity: readonly CashFlowCapacityView[];
  readonly debtBurden: readonly DebtBurdenView[];
  readonly goalProgress: readonly GoalProgressView[];
  readonly opportunityCapacity: readonly OpportunityCapacityView[];
  readonly confidence: FactConfidence;
  readonly completeness: DataCompletenessState;
  readonly assumptions: readonly string[];
  readonly warnings: readonly string[];
  readonly sourceReferences: readonly string[];
  readonly restated: false | true;
  readonly restatementOfSnapshotId?: EconomicValueSnapshotId;
};

export type AttributionContribution = {
  readonly system: AttributionSourceSystem;
  readonly shareNumerator: number;
  readonly shareDenominator: number;
  readonly causalCertainty: 'CONTRIBUTED' | 'IDENTIFIED' | 'EXECUTED' | 'UNKNOWN';
};

export type AttributionEntry = {
  readonly entryId: AttributionEntryId;
  readonly subjectId: string;
  readonly groupId: AttributionGroupId;
  readonly periodId?: AttributionPeriodId;
  readonly sourceEventId: string;
  readonly sourceKey: string;
  readonly growthPlanId?: string;
  readonly growthActionId?: string;
  readonly baselineId?: CounterfactualBaselineId;
  readonly observedResult: string;
  readonly amount: SerializedMoney;
  readonly attributionType: AttributionType;
  readonly realization: ValueRealizationState;
  readonly calculationMethod: string;
  readonly confidence: FactConfidence;
  readonly formulaVersion: ValuationFormulaVersion;
  readonly recordedAt: UtcInstant;
  readonly contributions: readonly AttributionContribution[];
  readonly isPrimaryForGroup: boolean;
  readonly principalMovement: false;
  readonly postsJournal: false;
};

export type CounterfactualBaseline = {
  readonly baselineId: CounterfactualBaselineId;
  readonly subjectId: string;
  readonly kind: string;
  readonly assumptions: readonly string[];
  readonly comparisonPeriod: { readonly from: UtcInstant; readonly to: UtcInstant };
  readonly sourceFacts: readonly SourceFactRef[];
  readonly confidence: FactConfidence;
  readonly method: string;
  readonly formulaVersion: ValuationFormulaVersion;
  readonly guaranteed: false;
  readonly survivesRebuild: true;
};

export type FormulaModel = {
  readonly formulaVersion: ValuationFormulaVersion;
  readonly modelVersion: EconomicValueModelVersion;
  readonly lifecycle: FormulaLifecycle;
  readonly weights: Readonly<Record<EconomicValueDimensionKind, number>>;
  readonly weightDenominator: 10000;
  readonly reserveCoverageTargetMonths: number;
  readonly attributedValueScaleMinorUnits: string;
  readonly debtPressureHighNumerator: number;
  readonly debtPressureHighDenominator: number;
  readonly researchRequired: true;
  readonly activatedAt?: UtcInstant;
  readonly retiredAt?: UtcInstant;
};

export type ModelComparison = {
  readonly left: FormulaModel;
  readonly right: FormulaModel;
  readonly dimensionsAdded: readonly EconomicValueDimensionKind[];
  readonly dimensionsRemoved: readonly EconomicValueDimensionKind[];
  readonly weightsChanged: readonly {
    readonly kind: EconomicValueDimensionKind;
    readonly left: number;
    readonly right: number;
  }[];
  readonly formulaChanged: boolean;
  readonly outputDifference?: {
    readonly snapshotId: EconomicValueSnapshotId;
    readonly leftComposite: string;
    readonly rightComposite: string;
    readonly dimensionDeltas: readonly {
      readonly kind: EconomicValueDimensionKind;
      readonly left: string;
      readonly right: string;
    }[];
  };
};

export type DataContributionReference = {
  readonly referenceId: DataContributionReferenceId;
  readonly subjectId: string;
  readonly purpose: string;
  readonly consentReference?: string;
  readonly realizedCompensation?: SerializedMoney;
  readonly estimatedValue?: SerializedMoney;
  readonly estimatedLabeled: boolean;
  readonly provenance: FactConfidence;
  readonly guaranteedCompensation: false;
  readonly tokenValuation: false;
};

export type DimensionExplanation = {
  readonly dimension: DimensionResult;
  readonly value: IndexMeasure;
  readonly meaning: string;
  readonly factsUsed: readonly SourceFactRef[];
  readonly factsMissing: readonly string[];
  readonly calculations: string;
  readonly confidence: FactConfidence;
  readonly priorValue?: IndexMeasure;
  readonly change?: string;
  readonly formulaVersion: ValuationFormulaVersion;
};

export function indexMeasure(points: IndexPoints): IndexMeasure {
  return Object.freeze({
    kind: 'INDEX',
    points: points.toString(),
    scale: 100,
    unit: 'POINTS_PER_HUNDRED',
    isMoney: false,
  });
}

export function moneyMeasure(amount: SerializedMoney): MoneyMeasure {
  return Object.freeze({
    kind: 'MONEY',
    amount,
    isIndex: false,
  });
}
