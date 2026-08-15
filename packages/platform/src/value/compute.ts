import type { UtcInstant } from '../../../domain/src/time.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import { Money, RoundingMode } from '../../../money/src/money.ts';
import type { FactConfidence } from '../../../personal-economic-graph/src/provenance.ts';
import type { PersonalEconomicSnapshot } from '../../../personal-economic-graph/src/snapshot.ts';
import type { CompiledEconomicMandate, SerializedMoney } from '../mandate/types.ts';
import type { GrowthPlan } from '../growth/types.ts';
import {
  asIndexPoints,
  dimensionIdFor,
  type EconomicValueSnapshotId,
  type IndexPoints,
} from './ids.ts';
import {
  DIMENSION_DEFINITIONS,
  ECONOMIC_VALUE_DIMENSIONS,
  PEVE_NOT_CREDIT_SCORE,
  PEVE_NOT_HUMAN_WORTH,
  PROTECTED_TRAIT_KEYS,
  type CashFlowQualityState,
  type DataCompletenessState,
  type EconomicValueDimensionKind,
} from './taxonomy.ts';
import type {
  AttributionEntry,
  CashFlowCapacityView,
  CompositeIndicator,
  DebtBurdenView,
  DimensionResult,
  EconomicValueVector,
  FormulaModel,
  FxValuationContext,
  GoalProgressView,
  OpportunityCapacityView,
  ReserveCoverageView,
  SourceFactRef,
} from './types.ts';
import { indexMeasure, moneyMeasure } from './types.ts';

export type ValuationInput = {
  readonly subjectId: string;
  readonly generatedAt: UtcInstant;
  readonly snapshotId: EconomicValueSnapshotId;
  readonly peg: PersonalEconomicSnapshot;
  readonly formula: FormulaModel;
  readonly attributions: readonly AttributionEntry[];
  readonly mandate?: CompiledEconomicMandate;
  readonly plan?: GrowthPlan;
  readonly prior?: {
    readonly dimensions: readonly DimensionResult[];
    readonly generatedAt: UtcInstant;
  };
  readonly fx?: FxValuationContext;
  readonly extraFacts?: Readonly<Record<string, unknown>>;
};

export type ComputeFailure = {
  readonly code:
    | 'PROTECTED_TRAIT_INPUT'
    | 'CROSS_CURRENCY_WITHOUT_FX'
    | 'INFERRED_LABELED_AUTHORITATIVE'
    | 'INVALID_FORMULA';
  readonly message: string;
};

const CONFIDENCE_RANK: Readonly<Record<FactConfidence, bigint>> = {
  AUTHORITATIVE: 4n,
  VERIFIED: 3n,
  USER_DECLARED: 2n,
  DERIVED: 1n,
  INFERRED: 0n,
};

function moneyOf(amount: SerializedMoney): Money {
  return Money.fromMinorUnitsString(amount.minorUnits, amount.currency);
}

function serialized(money: Money): SerializedMoney {
  return money.toJSON();
}

function clampIndex(value: bigint): IndexPoints {
  if (value < 0n) {
    return asIndexPoints(0n);
  }
  if (value > 10000n) {
    return asIndexPoints(10000n);
  }
  return asIndexPoints(value);
}

function ratioIndex(numerator: bigint, denominator: bigint): IndexPoints {
  if (denominator <= 0n) {
    return asIndexPoints(0n);
  }
  return clampIndex((numerator * 10000n) / denominator);
}

function weakest(confidences: readonly FactConfidence[]): FactConfidence {
  if (confidences.length === 0) {
    return 'INFERRED';
  }
  return confidences.reduce((lowest, current) =>
    CONFIDENCE_RANK[current] < CONFIDENCE_RANK[lowest] ? current : lowest,
  );
}

function strongestAllowed(facts: readonly SourceFactRef[]): FactConfidence {
  if (facts.some((item) => item.confidence === 'INFERRED')) {
    return facts.every((item) => item.confidence === 'INFERRED') ? 'INFERRED' : 'DERIVED';
  }
  return weakest(facts.map((item) => item.confidence));
}

function containsProtectedTrait(value: unknown, path = ''): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value !== 'object') {
    return undefined;
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = containsProtectedTrait(item, `${path}[${String(index)}]`);
      if (found) {
        return found;
      }
    }
    return undefined;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if ((PROTECTED_TRAIT_KEYS as readonly string[]).includes(key)) {
      return path.length === 0 ? key : `${path}.${key}`;
    }
    const found = containsProtectedTrait(child, path.length === 0 ? key : `${path}.${key}`);
    if (found) {
      return found;
    }
  }
  return undefined;
}

export function rejectProtectedTraits(input: unknown): Result<void, ComputeFailure> {
  const found = containsProtectedTrait(input);
  if (found) {
    return err({
      code: 'PROTECTED_TRAIT_INPUT',
      message: `PEVE must not use protected personal trait '${found}' as an economic-value input`,
    });
  }
  return ok(undefined);
}

function liquidFor(peg: PersonalEconomicSnapshot, currency: string): { money: Money; refs: SourceFactRef[] } {
  let total = Money.zero(currency);
  const refs: SourceFactRef[] = [];
  for (const item of peg.liquidAssetsByCurrency) {
    if (item.amount.currency !== currency) {
      continue;
    }
    total = total.plus(moneyOf(item.amount));
    for (const ref of item.sourceRefs) {
      refs.push({ ref, confidence: item.confidence, key: 'liquid' });
    }
  }
  return { money: total, refs };
}

function incomeFor(peg: PersonalEconomicSnapshot, currency: string): { money: Money; refs: SourceFactRef[]; quality: CashFlowQualityState } {
  let total = Money.zero(currency);
  const refs: SourceFactRef[] = [];
  let estimated = false;
  for (const item of peg.income) {
    if (!item.estimatedAmount || item.estimatedAmount.currency !== currency) {
      continue;
    }
    total = total.plus(moneyOf(item.estimatedAmount));
    for (const ref of item.sourceRefs) {
      refs.push({ ref, confidence: item.confidence, key: 'income' });
    }
    if (item.confidence === 'INFERRED' || item.confidence === 'DERIVED' || item.confidence === 'USER_DECLARED') {
      estimated = true;
    }
  }
  const flow = peg.monthlyCashFlow.find((item) => item.currency === currency);
  if (total.isZero() && flow) {
    total = moneyOf(flow.income.amount);
    for (const ref of flow.income.sourceRefs) {
      refs.push({ ref, confidence: flow.income.confidence, key: 'income_flow' });
    }
    estimated = true;
  }
  const quality: CashFlowQualityState = refs.length === 0 ? 'INCOMPLETE' : estimated ? 'ESTIMATED' : 'KNOWN';
  return { money: total, refs, quality };
}

function obligationsFor(
  peg: PersonalEconomicSnapshot,
  currency: string,
): { money: Money; refs: SourceFactRef[]; quality: CashFlowQualityState } {
  let total = Money.zero(currency);
  const refs: SourceFactRef[] = [];
  let estimated = false;
  for (const item of peg.knownRecurringObligations) {
    if (item.estimatedAmount.currency !== currency) {
      continue;
    }
    total = total.plus(moneyOf(item.estimatedAmount));
    for (const ref of item.sourceRefs) {
      refs.push({ ref, confidence: item.confidence, key: 'obligation' });
    }
    if (item.confidence !== 'AUTHORITATIVE' && item.confidence !== 'VERIFIED') {
      estimated = true;
    }
  }
  const flow = peg.monthlyCashFlow.find((item) => item.currency === currency);
  if (total.isZero() && flow) {
    total = moneyOf(flow.recurringOutflows.amount);
    for (const ref of flow.recurringOutflows.sourceRefs) {
      refs.push({ ref, confidence: flow.recurringOutflows.confidence, key: 'outflow' });
    }
    estimated = true;
  }
  const quality: CashFlowQualityState = refs.length === 0 ? 'INCOMPLETE' : estimated ? 'ESTIMATED' : 'KNOWN';
  return { money: total, refs, quality };
}

function debtFor(peg: PersonalEconomicSnapshot, currency: string): { money: Money; refs: SourceFactRef[]; quality: CashFlowQualityState } {
  let total = Money.zero(currency);
  const refs: SourceFactRef[] = [];
  for (const item of peg.debt) {
    if (!item.estimatedBalance || item.estimatedBalance.currency !== currency) {
      continue;
    }
    total = total.plus(moneyOf(item.estimatedBalance));
    refs.push({ ref: item.nodeId, confidence: item.confidence, key: 'debt' });
  }
  const quality: CashFlowQualityState = refs.length === 0 ? 'INCOMPLETE' : 'ESTIMATED';
  return { money: total, refs, quality };
}

function realizedFor(entries: readonly AttributionEntry[], currency: string): Money {
  return entries
    .filter(
      (item) =>
        (item.realization === 'REALIZED' || item.realization === 'OBSERVED') &&
        item.isPrimaryForGroup &&
        item.amount.currency === currency,
    )
    .reduce((sum, item) => sum.plus(moneyOf(item.amount)), Money.zero(currency));
}

function projectedFor(entries: readonly AttributionEntry[], currency: string): Money {
  return entries
    .filter(
      (item) =>
        (item.realization === 'PROJECTED' || item.realization === 'ESTIMATED' || item.realization === 'COUNTERFACTUAL') &&
        item.isPrimaryForGroup &&
        item.amount.currency === currency,
    )
    .reduce((sum, item) => sum.plus(moneyOf(item.amount)), Money.zero(currency));
}

function feeFriction(peg: PersonalEconomicSnapshot, entries: readonly AttributionEntry[], currency: string): Money {
  const fromEntries = entries
    .filter(
      (item) =>
        item.amount.currency === currency &&
        (item.attributionType === 'FEE_AVOIDED' || item.attributionType === 'PAYMENT_FEE_REDUCED'),
    )
    .reduce((sum, item) => sum.plus(moneyOf(item.amount)), Money.zero(currency));
  const flow = peg.monthlyCashFlow.find((item) => item.currency === currency);
  if (!fromEntries.isZero()) {
    return fromEntries;
  }
  if (flow) {
    return moneyOf(flow.variableOutflows.amount).allocate(1n, 20n, RoundingMode.FLOOR);
  }
  return Money.zero(currency);
}

function priorPoints(prior: ValuationInput['prior'], kind: EconomicValueDimensionKind): bigint | undefined {
  const found = prior?.dimensions.find((item) => item.kind === kind);
  return found ? BigInt(found.measure.points) : undefined;
}

function dimensionResult(input: {
  readonly snapshotId: EconomicValueSnapshotId;
  readonly kind: EconomicValueDimensionKind;
  readonly points: IndexPoints;
  readonly formula: FormulaModel;
  readonly computedAt: UtcInstant;
  readonly factsUsed: readonly SourceFactRef[];
  readonly factsMissing: readonly string[];
  readonly calculation: string;
  readonly meaning: string;
  readonly limitations: readonly string[];
  readonly moneyCompanion?: SerializedMoney;
  readonly prior?: ValuationInput['prior'];
}): DimensionResult {
  const previous = priorPoints(input.prior, input.kind);
  const change = previous === undefined ? undefined : input.points - previous;
  return Object.freeze({
    dimensionId: dimensionIdFor(input.kind, input.snapshotId),
    kind: input.kind,
    definition: DIMENSION_DEFINITIONS[input.kind],
    measure: indexMeasure(input.points),
    ...(input.moneyCompanion ? { moneyCompanion: moneyMeasure(input.moneyCompanion) } : {}),
    meaning: input.meaning,
    factsUsed: Object.freeze([...input.factsUsed]),
    factsMissing: Object.freeze([...input.factsMissing]),
    calculation: input.calculation,
    formulaVersion: input.formula.formulaVersion,
    computedAt: input.computedAt,
    confidence: strongestAllowed(input.factsUsed),
    limitations: Object.freeze([...input.limitations]),
    ...(previous !== undefined ? { priorPoints: previous.toString() } : {}),
    ...(change !== undefined ? { changePoints: change.toString() } : {}),
  });
}

export function assessCompleteness(input: ValuationInput, currency: string): DataCompletenessState {
  const income = incomeFor(input.peg, currency);
  const obligations = obligationsFor(input.peg, currency);
  const liquid = liquidFor(input.peg, currency);
  const debt = debtFor(input.peg, currency);
  const present = [!income.money.isZero(), !obligations.money.isZero(), !liquid.money.isZero(), !debt.money.isZero()].filter(
    Boolean,
  ).length;
  const incomeKeys = new Set(income.refs.map((item) => `${item.key}:${item.ref}`));
  const conflicted =
    input.peg.income.some((item) => item.confidence === 'INFERRED') &&
    input.peg.income.some((item) => item.confidence === 'AUTHORITATIVE') &&
    incomeKeys.size > 1;
  if (conflicted) {
    return 'CONFLICTED';
  }
  if (present <= 1) {
    return 'SPARSE';
  }
  if (present < 4 || income.quality === 'INCOMPLETE' || obligations.quality === 'INCOMPLETE') {
    return 'PARTIAL';
  }
  return 'SUFFICIENT';
}

export function computeReserveCoverage(input: ValuationInput, currency: string): ReserveCoverageView {
  const liquid = liquidFor(input.peg, currency);
  const obligations = obligationsFor(input.peg, currency);
  const warnings: string[] = [];
  if (obligations.quality === 'INCOMPLETE') {
    warnings.push('Essential monthly obligations are incomplete; coverage is not treated as complete.');
  }
  if (obligations.quality === 'ESTIMATED') {
    warnings.push('Obligation facts are estimated or user-declared; coverage confidence is reduced.');
  }
  const coverage =
    obligations.money.isZero()
      ? null
      : {
          numerator: liquid.money.minorUnits.toString(),
          denominator: obligations.money.minorUnits.toString(),
        };
  return Object.freeze({
    currency,
    ...(liquid.money.isZero() ? {} : { liquidReserves: serialized(liquid.money) }),
    ...(obligations.money.isZero() ? {} : { essentialMonthlyObligations: serialized(obligations.money) }),
    coverage,
    quality: obligations.quality === 'INCOMPLETE' || liquid.refs.length === 0 ? 'INCOMPLETE' : obligations.quality,
    warnings: Object.freeze(warnings),
  });
}

export function computeCashFlowCapacity(input: ValuationInput, currency: string): CashFlowCapacityView {
  const income = incomeFor(input.peg, currency);
  const obligations = obligationsFor(input.peg, currency);
  const warnings: string[] = [];
  if (income.quality === 'INCOMPLETE' || obligations.quality === 'INCOMPLETE') {
    warnings.push('Cash-flow capacity is incomplete because inflows or outflows are missing.');
  }
  const quality: CashFlowQualityState =
    income.quality === 'INCOMPLETE' || obligations.quality === 'INCOMPLETE'
      ? 'INCOMPLETE'
      : income.quality === 'ESTIMATED' || obligations.quality === 'ESTIMATED'
        ? 'ESTIMATED'
        : 'KNOWN';
  const surplus = income.money.minus(obligations.money);
  return Object.freeze({
    currency,
    ...(income.money.isZero() ? {} : { knownInflows: serialized(income.money) }),
    ...(obligations.money.isZero() ? {} : { knownOutflows: serialized(obligations.money) }),
    ...(income.refs.length === 0 && obligations.refs.length === 0 ? {} : { surplus: serialized(surplus) }),
    quality,
    warnings: Object.freeze(warnings),
  });
}

export function computeDebtBurden(input: ValuationInput, currency: string): DebtBurdenView {
  const debt = debtFor(input.peg, currency);
  const income = incomeFor(input.peg, currency);
  const warnings = [PEVE_NOT_CREDIT_SCORE];
  if (income.quality === 'INCOMPLETE') {
    warnings.push('Income is incomplete; debt pressure is not a DTI compliance figure.');
  }
  const pressure =
    income.money.isZero()
      ? null
      : {
          numerator: debt.money.minorUnits.toString(),
          denominator: income.money.minorUnits.toString(),
        };
  return Object.freeze({
    currency,
    ...(debt.money.isZero() ? {} : { estimatedDebt: serialized(debt.money) }),
    ...(income.money.isZero() ? {} : { knownIncome: serialized(income.money) }),
    pressure,
    notCreditScore: true,
    notRegulatoryDti: true,
    quality: debt.quality === 'INCOMPLETE' || income.quality === 'INCOMPLETE' ? 'INCOMPLETE' : 'ESTIMATED',
    warnings: Object.freeze(warnings),
  });
}

export function computeGoalProgress(input: ValuationInput, currency: string): readonly GoalProgressView[] {
  const liquid = liquidFor(input.peg, currency).money;
  const views: GoalProgressView[] = [];
  for (const goal of input.peg.goals) {
    const target = goal.target.currency === currency ? moneyOf(goal.target) : undefined;
    const current = target ? (liquid.cmp(target) < 0 ? liquid : target) : undefined;
    views.push({
      goalId: goal.nodeId,
      label: goal.label,
      ...(target ? { target: serialized(target) } : {}),
      ...(current ? { currentAttributable: serialized(current) } : {}),
      ...(target && current ? { remaining: serialized(target.minus(current)) } : {}),
      ...(goal.targetDate ? { timeHorizon: goal.targetDate } : {}),
      status: goal.status,
      unrealizedMarketCounted: false,
    });
  }
  if (input.mandate) {
    for (const goal of input.mandate.goals) {
      if (goal.currency !== currency) {
        continue;
      }
      const target = goal.target ? moneyOf(goal.target) : undefined;
      const current = target ? (liquid.cmp(target) < 0 ? liquid : target) : undefined;
      views.push({
        goalId: goal.goalId,
        label: goal.label,
        ...(target ? { target: serialized(target) } : {}),
        ...(current ? { currentAttributable: serialized(current) } : {}),
        ...(target && current ? { remaining: serialized(target.minus(current)) } : {}),
        ...(goal.timeHorizon?.date
          ? { timeHorizon: goal.timeHorizon.date }
          : goal.timeHorizon?.days
            ? { timeHorizon: `${String(goal.timeHorizon.days)}_days` }
            : {}),
        status: goal.status,
        unrealizedMarketCounted: false,
      });
    }
  }
  return Object.freeze(views);
}

export function computeOpportunityCapacity(input: ValuationInput, currency: string): OpportunityCapacityView {
  const liquid = liquidFor(input.peg, currency).money;
  const obligations = obligationsFor(input.peg, currency);
  const debt = debtFor(input.peg, currency);
  const floorConstraint = input.mandate?.hardConstraints.find(
    (item) =>
      (item.kind === 'NEVER_SPEND_BELOW_LIQUIDITY_FLOOR' || item.kind === 'MINIMUM_CASH_RESERVE') &&
      item.amount?.currency === currency,
  );
  const floor = floorConstraint?.amount ? moneyOf(floorConstraint.amount) : Money.zero(currency);
  const limitConstraint = input.mandate?.hardConstraints.find(
    (item) => item.kind === 'MAXIMUM_MONTHLY_ACTION_BUDGET' && item.amount?.currency === currency,
  );
  let available = liquid.minus(floor).minus(obligations.money);
  if (available.isNegative()) {
    available = Money.zero(currency);
  }
  const quality: CashFlowQualityState =
    obligations.quality === 'INCOMPLETE' ? 'INCOMPLETE' : obligations.quality === 'ESTIMATED' ? 'ESTIMATED' : 'KNOWN';
  return Object.freeze({
    currency,
    availableLiquidity: serialized(liquid),
    ...(floor.isZero() ? {} : { protectedFloor: serialized(floor) }),
    ...(obligations.money.isZero() ? {} : { scheduledObligations: serialized(obligations.money) }),
    ...(debt.money.isZero() ? {} : { knownDebt: serialized(debt.money) }),
    ...(limitConstraint?.amount ? { mandateLimit: limitConstraint.amount } : {}),
    informationalFlexibility: serialized(available),
    quality,
    mayExecute: false,
    limitations: Object.freeze([
      'Opportunity capacity is informational. It does not authorize movement or issue Execution Authority.',
    ]),
  });
}

function computeDimensions(input: ValuationInput, currency: string): readonly DimensionResult[] {
  const liquid = liquidFor(input.peg, currency);
  const income = incomeFor(input.peg, currency);
  const obligations = obligationsFor(input.peg, currency);
  const debt = debtFor(input.peg, currency);
  const realized = realizedFor(input.attributions, currency);
  const coverageMonths = BigInt(input.formula.reserveCoverageTargetMonths);
  const targetReserve = obligations.money.allocate(coverageMonths, 1n, RoundingMode.FLOOR);
  const liquidityPoints = obligations.money.isZero()
    ? asIndexPoints(0n)
    : ratioIndex(liquid.money.minorUnits, targetReserve.minorUnits === 0n ? 1n : targetReserve.minorUnits);
  const surplus = income.money.minus(obligations.money);
  const cashFlowPoints = income.money.isZero()
    ? asIndexPoints(0n)
    : ratioIndex(surplus.isNegative() ? 0n : surplus.minorUnits, income.money.minorUnits);
  const savingsPoints = cashFlowPoints;
  const debtPoints = income.money.isZero()
    ? asIndexPoints(0n)
    : clampIndex(10000n - ratioIndex(debt.money.minorUnits, income.money.minorUnits));
  const goals = computeGoalProgress(input, currency);
  const goalPoints = (() => {
    const withTarget = goals.filter((item) => item.target && item.currentAttributable);
    if (withTarget.length === 0) {
      return asIndexPoints(0n);
    }
    let acc = 0n;
    for (const goal of withTarget) {
      const target = BigInt(goal.target?.minorUnits ?? '0');
      const current = BigInt(goal.currentAttributable?.minorUnits ?? '0');
      acc += target === 0n ? 0n : (current * 10000n) / target;
    }
    return clampIndex(acc / BigInt(withTarget.length));
  })();
  const opportunity = computeOpportunityCapacity(input, currency);
  const flexibility = opportunity.informationalFlexibility
    ? moneyOf(opportunity.informationalFlexibility)
    : Money.zero(currency);
  const opportunityPoints = liquid.money.isZero()
    ? asIndexPoints(0n)
    : ratioIndex(flexibility.minorUnits, liquid.money.minorUnits);
  const incomeSources = input.peg.income.filter((item) => !item.estimatedAmount || item.estimatedAmount.currency === currency)
    .length;
  const diversificationPoints = clampIndex(BigInt(incomeSources) * 2500n);
  const friction = feeFriction(input.peg, input.attributions, currency);
  const frictionPoints = income.money.isZero()
    ? asIndexPoints(0n)
    : clampIndex(10000n - ratioIndex(friction.minorUnits, income.money.minorUnits));
  const resiliencePoints = clampIndex(
    (liquidityPoints * 5n + cashFlowPoints * 3n + debtPoints * 2n) / 10n,
  );
  const scale = BigInt(input.formula.attributedValueScaleMinorUnits);
  const attributedPoints = ratioIndex(realized.minorUnits, scale === 0n ? 1n : scale);
  const provenanceFacts = [...liquid.refs, ...income.refs, ...obligations.refs, ...debt.refs];
  const provenanceRank =
    provenanceFacts.length === 0
      ? 0n
      : provenanceFacts.reduce((sum, item) => sum + CONFIDENCE_RANK[item.confidence], 0n) /
        BigInt(provenanceFacts.length);
  const provenancePoints = clampIndex(provenanceRank * 2500n);
  const priorResilience = priorPoints(input.prior, 'ECONOMIC_RESILIENCE');
  const progressFromPrior =
    priorResilience === undefined ? 5000n : clampIndex(5000n + (resiliencePoints - priorResilience));
  const progressFromValue = ratioIndex(realized.minorUnits, scale === 0n ? 1n : scale);
  const progressPoints = clampIndex((progressFromPrior + progressFromValue) / 2n);

  const missingIncome = income.refs.length === 0 ? ['monthly_income'] : [];
  const missingObligations = obligations.refs.length === 0 ? ['essential_monthly_obligations'] : [];
  const missingLiquid = liquid.refs.length === 0 ? ['liquid_reserves'] : [];
  const missingDebt = debt.refs.length === 0 ? ['debt_balance'] : [];

  const results: DimensionResult[] = [
    dimensionResult({
      snapshotId: input.snapshotId,
      kind: 'LIQUIDITY_RESILIENCE',
      points: liquidityPoints,
      formula: input.formula,
      computedAt: input.generatedAt,
      factsUsed: [...liquid.refs, ...obligations.refs],
      factsMissing: [...missingLiquid, ...missingObligations],
      calculation: `min(10000, liquid * 10000 / (obligations * ${String(input.formula.reserveCoverageTargetMonths)})) using integer division`,
      meaning: 'How many versioned reserve-months known liquid funds cover.',
      limitations: [
        ...(obligations.quality === 'INCOMPLETE'
          ? ['Incomplete obligations; coverage is not silently treated as complete.']
          : []),
        'Target months are a versioned engineering threshold, not a universal correct reserve.',
      ],
      moneyCompanion: serialized(liquid.money),
      prior: input.prior,
    }),
    dimensionResult({
      snapshotId: input.snapshotId,
      kind: 'CASH_FLOW_STABILITY',
      points: cashFlowPoints,
      formula: input.formula,
      computedAt: input.generatedAt,
      factsUsed: [...income.refs, ...obligations.refs],
      factsMissing: [...missingIncome, ...missingObligations],
      calculation: 'max(0, knownInflows - knownOutflows) * 10000 / knownInflows',
      meaning: 'Known recurring surplus relative to known income.',
      limitations: [
        `Cash-flow quality is ${income.quality === 'INCOMPLETE' || obligations.quality === 'INCOMPLETE' ? 'INCOMPLETE' : income.quality}.`,
        'Model-generated arithmetic is not used.',
      ],
      moneyCompanion: serialized(surplus),
      prior: input.prior,
    }),
    dimensionResult({
      snapshotId: input.snapshotId,
      kind: 'SAVINGS_CAPACITY',
      points: savingsPoints,
      formula: input.formula,
      computedAt: input.generatedAt,
      factsUsed: [...income.refs, ...obligations.refs],
      factsMissing: [...missingIncome, ...missingObligations],
      calculation: 'same integer surplus/income ratio as cash-flow capacity',
      meaning: 'Known surplus that could be allocated without inventing missing expenses.',
      limitations: ['INCOMPLETE outflows reduce confidence rather than assuming zero expenses.'],
      moneyCompanion: serialized(surplus.isNegative() ? Money.zero(currency) : surplus),
      prior: input.prior,
    }),
    dimensionResult({
      snapshotId: input.snapshotId,
      kind: 'DEBT_BURDEN',
      points: debtPoints,
      formula: input.formula,
      computedAt: input.generatedAt,
      factsUsed: [...debt.refs, ...income.refs],
      factsMissing: [...missingDebt, ...missingIncome],
      calculation: '10000 - min(10000, estimatedDebt * 10000 / knownIncome)',
      meaning: 'Higher index means lower observed debt pressure. Not a credit score.',
      limitations: [PEVE_NOT_CREDIT_SCORE],
      moneyCompanion: serialized(debt.money),
      prior: input.prior,
    }),
    dimensionResult({
      snapshotId: input.snapshotId,
      kind: 'GOAL_PROGRESS',
      points: goalPoints,
      formula: input.formula,
      computedAt: input.generatedAt,
      factsUsed: goals.map((item) => ({ ref: item.goalId, confidence: 'USER_DECLARED' as const, key: 'goal' })),
      factsMissing: goals.length === 0 ? ['confirmed_goals'] : [],
      calculation: 'average of currentAttributable * 10000 / target across goals in the primary currency',
      meaning: 'Attributable progress toward known goals. Unrealized market returns are excluded.',
      limitations: ['Investment-market returns are not marked achieved before realization.'],
      prior: input.prior,
    }),
    dimensionResult({
      snapshotId: input.snapshotId,
      kind: 'ECONOMIC_RESILIENCE',
      points: resiliencePoints,
      formula: input.formula,
      computedAt: input.generatedAt,
      factsUsed: [...liquid.refs, ...income.refs, ...obligations.refs, ...debt.refs],
      factsMissing: [...missingLiquid, ...missingIncome, ...missingObligations, ...missingDebt],
      calculation: '(liquidity*5 + cashFlow*3 + debtBurden*2) / 10',
      meaning: 'Versioned resilience combination. Thresholds are research-required engineering values.',
      limitations: ['No universal correct resilience threshold is claimed.'],
      prior: input.prior,
    }),
    dimensionResult({
      snapshotId: input.snapshotId,
      kind: 'OPPORTUNITY_CAPACITY',
      points: opportunityPoints,
      formula: input.formula,
      computedAt: input.generatedAt,
      factsUsed: [...liquid.refs, ...obligations.refs],
      factsMissing: [...missingLiquid, ...missingObligations],
      calculation: 'max(0, liquid - floor - obligations) * 10000 / liquid',
      meaning: 'Informational flexibility under the current mandate. Does not authorize movement.',
      limitations: ['A high opportunity-capacity index never means automatically execute.'],
      moneyCompanion: serialized(flexibility),
      prior: input.prior,
    }),
    dimensionResult({
      snapshotId: input.snapshotId,
      kind: 'INCOME_DIVERSIFICATION',
      points: diversificationPoints,
      formula: input.formula,
      computedAt: input.generatedAt,
      factsUsed: income.refs,
      factsMissing: missingIncome,
      calculation: 'min(10000, distinctIncomeSources * 2500)',
      meaning: 'How many distinct known income sources appear in the economic system.',
      limitations: ['Concentration is disclosed; it is not an underwriting decision.'],
      prior: input.prior,
    }),
    dimensionResult({
      snapshotId: input.snapshotId,
      kind: 'FINANCIAL_FRICTION',
      points: frictionPoints,
      formula: input.formula,
      computedAt: input.generatedAt,
      factsUsed: income.refs,
      factsMissing: income.money.isZero() ? ['income_for_friction'] : [],
      calculation: '10000 - min(10000, knownFriction * 10000 / knownIncome)',
      meaning: 'Lower known fee friction produces a higher index. Missing fees do not invent zero friction.',
      limitations: ['Fee facts may be incomplete; confidence falls rather than assuming no friction.'],
      prior: input.prior,
    }),
    dimensionResult({
      snapshotId: input.snapshotId,
      kind: 'ECONOMIC_PROGRESS',
      points: progressPoints,
      formula: input.formula,
      computedAt: input.generatedAt,
      factsUsed: input.attributions
        .filter((item) => item.realization === 'REALIZED' && item.isPrimaryForGroup)
        .map((item) => ({ ref: item.entryId, confidence: item.confidence, key: 'realized_attribution' })),
      factsMissing: input.prior ? [] : ['prior_snapshot'],
      calculation: 'average of (5000 + resilienceChange) and realizedAttributed / scale; projected excluded',
      meaning: 'Change versus the prior snapshot plus realized attributed benefit only.',
      limitations: [
        'Projected and counterfactual amounts are excluded from progress.',
        ...(input.prior ? [] : ['No prior snapshot; progress is a labeled baseline, not a restated history.']),
      ],
      moneyCompanion: serialized(realized),
      prior: input.prior,
    }),
    dimensionResult({
      snapshotId: input.snapshotId,
      kind: 'ATTRIBUTED_VALUE_CREATED',
      points: attributedPoints,
      formula: input.formula,
      computedAt: input.generatedAt,
      factsUsed: input.attributions
        .filter((item) => (item.realization === 'REALIZED' || item.realization === 'OBSERVED') && item.isPrimaryForGroup)
        .map((item) => ({ ref: item.entryId, confidence: item.confidence, key: 'realized_attribution' })),
      factsMissing: realized.isZero() ? ['realized_attribution_entries'] : [],
      calculation: `min(10000, realizedMinor * 10000 / ${input.formula.attributedValueScaleMinorUnits}); projected excluded`,
      meaning: 'Index mapping of realized attributed benefit. The index is not a dollar amount.',
      limitations: [
        'Do not read this index as a money value. Realized money is the companion field.',
        `Projected total ${projectedFor(input.attributions, currency).toJSON().minorUnits} is excluded.`,
      ],
      moneyCompanion: serialized(realized),
      prior: input.prior,
    }),
    dimensionResult({
      snapshotId: input.snapshotId,
      kind: 'DATA_PROVENANCE_STRENGTH',
      points: provenancePoints,
      formula: input.formula,
      computedAt: input.generatedAt,
      factsUsed: provenanceFacts,
      factsMissing: provenanceFacts.length === 0 ? ['any_economic_facts'] : [],
      calculation: 'average(confidenceRank) * 2500 where AUTHORITATIVE=4 ... INFERRED=0',
      meaning: 'Input-quality strength. Inferred facts cannot masquerade as authoritative.',
      limitations: ['Weak inferred data never receives the same confidence as authoritative ledger facts.'],
      prior: input.prior,
    }),
  ];
  return Object.freeze(results);
}

export function composeIndex(
  dimensions: readonly DimensionResult[],
  formula: FormulaModel,
): CompositeIndicator {
  let weighted = 0n;
  const decomposition = ECONOMIC_VALUE_DIMENSIONS.map((kind) => {
    const dimension = dimensions.find((item) => item.kind === kind);
    const points = BigInt(dimension?.measure.points ?? '0');
    const weight = BigInt(formula.weights[kind]);
    const part = (points * weight) / 10000n;
    weighted += points * weight;
    return {
      kind,
      points: points.toString(),
      weight: formula.weights[kind],
      weightedPoints: part.toString(),
    };
  });
  const composite = clampIndex(weighted / 10000n);
  return Object.freeze({
    name: 'PEVE_COMPOSITE_INDEX',
    measure: indexMeasure(composite),
    formulaVersion: formula.formulaVersion,
    modelVersion: formula.modelVersion,
    weights: formula.weights,
    weightDenominator: 10000,
    decomposition: Object.freeze(decomposition),
    notHumanWorth: true,
    notCreditScore: true,
    notRegulatoryEligibility: true,
    explanation: `${PEVE_NOT_HUMAN_WORTH} Composite = sum(dimensionPoints * weight) / 10000 using integer arithmetic. Weights are exposed exactly.`,
  });
}

export function computeVector(input: ValuationInput): Result<
  {
    readonly vector: EconomicValueVector;
    readonly composite: CompositeIndicator;
    readonly completeness: DataCompletenessState;
    readonly confidence: FactConfidence;
    readonly warnings: readonly string[];
    readonly reserveCoverage: readonly ReserveCoverageView[];
    readonly cashFlowCapacity: readonly CashFlowCapacityView[];
    readonly debtBurden: readonly DebtBurdenView[];
    readonly goalProgress: readonly GoalProgressView[];
    readonly opportunityCapacity: readonly OpportunityCapacityView[];
  },
  ComputeFailure
> {
  const traits = rejectProtectedTraits({ peg: input.peg, extraFacts: input.extraFacts ?? {} });
  if (!traits.ok) {
    return traits;
  }
  const currencies = new Set<string>([
    ...input.peg.liquidAssetsByCurrency.map((item) => item.amount.currency),
    ...input.peg.income.flatMap((item) => (item.estimatedAmount ? [item.estimatedAmount.currency] : [])),
    input.mandate?.currency ?? 'USD',
  ]);
  if (currencies.size > 1 && !input.fx) {
    return err({
      code: 'CROSS_CURRENCY_WITHOUT_FX',
      message: 'Consolidated valuation requires an explicit timestamped FX valuation context. No magical mixed-currency total.',
    });
  }
  const currency = input.fx?.baseCurrency ?? input.mandate?.currency ?? [...currencies][0] ?? 'USD';
  const dimensions = computeDimensions(input, currency);
  const composite = composeIndex(dimensions, input.formula);
  const completeness = assessCompleteness(input, currency);
  const warnings: string[] = [PEVE_NOT_HUMAN_WORTH, PEVE_NOT_CREDIT_SCORE];
  if (completeness === 'SPARSE' && BigInt(composite.measure.points) > 5000n) {
    warnings.push('Composite index is based on sparse data and must not be treated as a complete measurement.');
  }
  if (completeness === 'PARTIAL') {
    warnings.push('Data completeness is PARTIAL; missing facts reduce confidence rather than inventing values.');
  }
  if (completeness === 'CONFLICTED') {
    warnings.push('Conflicting facts of equal confidence are present.');
  }
  if (dimensions.some((item) => item.factsUsed.some((fact) => fact.confidence === 'INFERRED'))) {
    warnings.push('Inferred facts were used and remain labeled INFERRED; they are not authoritative.');
  }
  return ok({
    vector: Object.freeze({
      dimensions,
      decomposable: true,
      opaqueScoreForbidden: true,
    }),
    composite,
    completeness,
    confidence: weakest(dimensions.map((item) => item.confidence)),
    warnings: Object.freeze(warnings),
    reserveCoverage: Object.freeze([computeReserveCoverage(input, currency)]),
    cashFlowCapacity: Object.freeze([computeCashFlowCapacity(input, currency)]),
    debtBurden: Object.freeze([computeDebtBurden(input, currency)]),
    goalProgress: computeGoalProgress(input, currency),
    opportunityCapacity: Object.freeze([computeOpportunityCapacity(input, currency)]),
  });
}
