import type { UtcInstant } from '../../domain/src/time.ts';
import { valuePositions, type PresentationValuation, type ReferenceRateLookup } from '../../payments/src/fx-valuation.ts';
import { analyzeCashFlow, type CurrencyCashFlowAnalysis } from './cash-flow-analysis.ts';
import {
  freezeFinancialSnapshot,
  strengthsAndImprovements,
  type CurrencyPosition,
  type FinancialIntelligenceSnapshot,
  type GrowProfileView,
  type SnapshotAsset,
  type SnapshotGoalView,
  type SnapshotLiability,
} from './financial-snapshot.ts';
import { deterministicSnapshotId, type EconomicGraphId } from './ids.ts';
import { deriveInsights, type DerivedInsight } from './insights.ts';
import type { EconomicNode } from './node.ts';
import type { SuitabilityProfile } from './suitability.ts';
import type { EconomicActivity, HistoryPoint, InMemoryEconomicGraphStore } from './store.ts';
import type { GrowDataCategory, SerializedMoney } from './taxonomy.ts';

export type SnapshotBuildInput = {
  readonly store: InMemoryEconomicGraphStore;
  readonly graphId: EconomicGraphId;
  readonly subjectId: string;
  readonly at: UtcInstant;
  readonly valuationCurrency?: string;
  readonly rates?: ReferenceRateLookup;
};

function position(
  amount: SerializedMoney,
  source: string,
  sourceReference: string,
  at: UtcInstant,
  flags: { readonly userDeclared: boolean; readonly derived: boolean },
): CurrencyPosition {
  return Object.freeze({
    amount,
    source,
    sourceReference,
    observedAt: at,
    userDeclared: flags.userDeclared,
    derived: flags.derived,
  });
}

function cashFromAccounts(store: InMemoryEconomicGraphStore, nodes: readonly EconomicNode[], at: UtcInstant): CurrencyPosition[] {
  const byCurrency = new Map<string, { minor: bigint; refs: string[] }>();
  for (const node of nodes) {
    if (node.kind !== 'ACCOUNT') {
      continue;
    }
    const fact = store.factsForNode(node.nodeId, at).find((row) => row.key === 'derived_position');
    if (!fact || fact.value.type !== 'MONEY') {
      continue;
    }
    const current = byCurrency.get(fact.value.currency) ?? { minor: 0n, refs: [] };
    current.minor += BigInt(fact.value.minorUnits);
    current.refs.push(fact.provenance.sourceRef);
    byCurrency.set(fact.value.currency, current);
  }
  return [...byCurrency.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, value]) =>
      position(
        { minorUnits: value.minor.toString(), currency },
        'CANONICAL_LEDGER',
        value.refs[0] ?? 'ledger-backed-account',
        at,
        { userDeclared: false, derived: true },
      ),
    );
}

function assetRows(nodes: readonly EconomicNode[], kinds: ReadonlySet<EconomicNode['kind']>): SnapshotAsset[] {
  return nodes
    .filter((node) => kinds.has(node.kind))
    .map((node) => {
      const label =
        'label' in node.attributes && typeof node.attributes.label === 'string' ? node.attributes.label : node.kind;
      const estimated =
        'estimatedValue' in node.attributes && node.attributes.estimatedValue
          ? node.attributes.estimatedValue
          : null;
      return Object.freeze({
        nodeId: node.nodeId,
        kind: node.kind,
        label,
        estimatedValue: estimated,
        valuationSource: estimated ? node.provenance.sourceType : null,
        valuationDate: estimated ? node.provenance.observedAt : null,
        userDeclared: node.confidence === 'USER_DECLARED',
      });
    });
}

function liabilityRows(nodes: readonly EconomicNode[]): SnapshotLiability[] {
  return nodes
    .filter((node) => node.kind === 'DEBT' || node.kind === 'LIABILITY')
    .map((node) => {
      const label =
        'label' in node.attributes && typeof node.attributes.label === 'string' ? node.attributes.label : node.kind;
      const estimated =
        'estimatedBalance' in node.attributes && node.attributes.estimatedBalance
          ? node.attributes.estimatedBalance
          : null;
      return Object.freeze({
        nodeId: node.nodeId,
        kind: node.kind,
        label,
        estimatedBalance: estimated,
        valuationSource: estimated ? node.provenance.sourceType : null,
        valuationDate: estimated ? node.provenance.observedAt : null,
        userDeclared: node.confidence === 'USER_DECLARED',
      });
    });
}

function goalRows(nodes: readonly EconomicNode[]): SnapshotGoalView[] {
  return nodes
    .filter((node) => node.kind === 'GOAL' && node.attributes.kind === 'GOAL')
    .map((node) => {
      const attrs = node.attributes;
      if (attrs.kind !== 'GOAL') {
        throw new Error('goal mismatch');
      }
      return Object.freeze({
        goalId: node.nodeId,
        name: attrs.name ?? attrs.label,
        goalKind: attrs.goalKind,
        targetAmount: attrs.target,
        currency: attrs.target.currency,
        targetDate: attrs.targetDate,
        priority: attrs.priority,
        minimumLiquidity: attrs.minimumLiquidity ?? null,
        currentAllocatedValue: attrs.currentAllocatedValue ?? null,
        status: attrs.status,
        createdAt: node.createdAt,
      });
    });
}

function netByCurrency(
  cash: readonly CurrencyPosition[],
  assets: readonly SnapshotAsset[],
  liabilities: readonly SnapshotLiability[],
  at: UtcInstant,
): CurrencyPosition[] {
  const map = new Map<string, bigint>();
  for (const row of cash) {
    map.set(row.amount.currency, (map.get(row.amount.currency) ?? 0n) + BigInt(row.amount.minorUnits));
  }
  for (const asset of assets) {
    if (!asset.estimatedValue) {
      continue;
    }
    map.set(
      asset.estimatedValue.currency,
      (map.get(asset.estimatedValue.currency) ?? 0n) + BigInt(asset.estimatedValue.minorUnits),
    );
  }
  for (const liability of liabilities) {
    if (!liability.estimatedBalance) {
      continue;
    }
    map.set(
      liability.estimatedBalance.currency,
      (map.get(liability.estimatedBalance.currency) ?? 0n) - BigInt(liability.estimatedBalance.minorUnits),
    );
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, minor]) =>
      position({ minorUnits: minor.toString(), currency }, 'DERIVED', 'peg-net-position', at, {
        userDeclared: false,
        derived: true,
      }),
    );
}

function valuationOf(
  cash: readonly CurrencyPosition[],
  target: string | undefined,
  at: UtcInstant,
  rates: ReferenceRateLookup | undefined,
): PresentationValuation | null {
  if (!target || !rates) {
    return null;
  }
  return valuePositions({
    positions: cash.map((row) => ({
      currency: row.amount.currency,
      minorUnits: BigInt(row.amount.minorUnits),
    })),
    targetCurrency: target,
    now: at,
    rates,
  });
}

export function buildFinancialSnapshot(input: SnapshotBuildInput): FinancialIntelligenceSnapshot {
  const nodes = input.store.nodesFor(input.graphId);
  const activities = input.store.activitiesFor(input.graphId);
  const cash = cashFromAccounts(input.store, nodes, input.at);
  const investments = assetRows(nodes, new Set(['INVESTMENT', 'DIGITAL_ASSET']));
  const assets = assetRows(nodes, new Set(['ASSET', 'DIGITAL_ASSET']));
  const liabilities = liabilityRows(nodes);
  const cashFlow = analyzeCashFlow({
    activities,
    at: input.at,
    cashByCurrency: cash.map((row) => row.amount),
  });
  const suitability = input.store.getSuitability(input.subjectId) ?? null;
  const insights = deriveInsights({
    graphId: input.graphId,
    at: input.at,
    nodes,
    cashByCurrency: cash.map((row) => row.amount),
    cashFlow,
    suitability,
  });
  const presentation = valuationOf(cash, input.valuationCurrency, input.at, input.rates);
  const snapshot = freezeFinancialSnapshot({
    snapshotId: deterministicSnapshotId(input.graphId, input.at),
    graphId: input.graphId,
    subjectId: input.subjectId,
    generatedAt: input.at,
    cash,
    investments,
    assets,
    liabilities,
    netPositionByCurrency: netByCurrency(cash, [...investments, ...assets], liabilities, input.at),
    monthlyIncome: cashFlow.map((flow) =>
      position(flow.income.amount, 'DERIVED', flow.income.sourceRefs[0] ?? 'cash-flow', input.at, {
        userDeclared: false,
        derived: true,
      }),
    ),
    monthlyRecurringExpenses: cashFlow.map((flow) =>
      position(flow.recurringOutflows.amount, 'DERIVED', flow.recurringOutflows.sourceRefs[0] ?? 'cash-flow', input.at, {
        userDeclared: false,
        derived: true,
      }),
    ),
    estimatedDiscretionaryCashFlow: cashFlow.map((flow) =>
      position(flow.monthlySurplusOrDeficit.amount, 'DERIVED', flow.netFlow.sourceRefs[0] ?? 'cash-flow', input.at, {
        userDeclared: false,
        derived: true,
      }),
    ),
    liquidity: cash,
    financialGoals: goalRows(nodes),
    riskProfile: suitability,
    investmentHorizon: suitability?.timeHorizon ?? null,
    currencyExposure: cash.map((row) =>
      Object.freeze({
        currency: row.amount.currency,
        cashMinorUnits: row.amount.minorUnits,
        investmentMinorUnits:
          investments
            .filter((item) => item.estimatedValue?.currency === row.amount.currency)
            .reduce((acc, item) => acc + BigInt(item.estimatedValue?.minorUnits ?? '0'), 0n)
            .toString(),
        shareIsNotFxConverted: true as const,
      }),
    ),
    cashFlow,
    insights,
    presentationValuation: presentation,
    valuationContext: presentation,
    crossCurrencyTotal: null,
    authoritativeBalance: false,
    ledgerWins: true,
    guaranteedReturn: false,
    projectionIsCertainty: false,
  });
  return snapshot;
}

export function recordHistoryFromSnapshot(
  store: InMemoryEconomicGraphStore,
  snapshot: FinancialIntelligenceSnapshot,
): readonly HistoryPoint[] {
  const points: HistoryPoint[] = [];
  for (const row of snapshot.netPositionByCurrency) {
    points.push(
      store.putHistory({
        historyId: `peg_h_net_${snapshot.graphId}_${row.amount.currency}_${snapshot.generatedAt.replace(/[:.]/g, '')}`,
        graphId: snapshot.graphId,
        capturedAt: snapshot.generatedAt,
        series: 'NET_POSITION',
        currency: row.amount.currency,
        minorUnits: row.amount.minorUnits,
        sourceSnapshotId: snapshot.snapshotId,
      }),
    );
  }
  for (const flow of snapshot.cashFlow) {
    points.push(
      store.putHistory({
        historyId: `peg_h_cf_${snapshot.graphId}_${flow.currency}_${snapshot.generatedAt.replace(/[:.]/g, '')}`,
        graphId: snapshot.graphId,
        capturedAt: snapshot.generatedAt,
        series: 'CASH_FLOW',
        currency: flow.currency,
        minorUnits: flow.netFlow.amount.minorUnits,
        sourceSnapshotId: snapshot.snapshotId,
      }),
    );
  }
  for (const goal of snapshot.financialGoals) {
    points.push(
      store.putHistory({
        historyId: `peg_h_goal_${goal.goalId}_${snapshot.generatedAt.replace(/[:.]/g, '')}`,
        graphId: snapshot.graphId,
        capturedAt: snapshot.generatedAt,
        series: 'GOAL_PROGRESS',
        currency: goal.currency,
        minorUnits: goal.currentAllocatedValue?.minorUnits ?? '0',
        sourceSnapshotId: snapshot.snapshotId,
      }),
    );
  }
  return Object.freeze(points);
}

export function toGrowProfile(snapshot: FinancialIntelligenceSnapshot, allowed?: readonly GrowDataCategory[]): GrowProfileView {
  const narrative = strengthsAndImprovements(snapshot.insights);
  const permit = new Set(allowed ?? []);
  const all = allowed === undefined;
  const include = (category: GrowDataCategory): boolean => all || permit.has(category);
  return Object.freeze({
    schema: 'sunrey.grow.profile.v1',
    subjectId: snapshot.subjectId,
    generatedAt: snapshot.generatedAt,
    netPositionByCurrency: include('CASH_POSITION') ? snapshot.netPositionByCurrency : Object.freeze([]),
    cash: include('CASH_POSITION') ? snapshot.cash : Object.freeze([]),
    investments: include('INVESTMENT_POSITION') ? snapshot.investments : Object.freeze([]),
    income: include('INCOME') ? snapshot.monthlyIncome : Object.freeze([]),
    expenses: include('EXPENSE') ? snapshot.monthlyRecurringExpenses : Object.freeze([]),
    goals: include('GOAL') ? snapshot.financialGoals : Object.freeze([]),
    riskProfile: include('RISK_PROFILE') ? snapshot.riskProfile : null,
    liquidity: include('CASH_POSITION') ? snapshot.liquidity : Object.freeze([]),
    financialStrengths: include('INSIGHT') ? narrative.strengths : Object.freeze([]),
    areasToImprove: include('INSIGHT') ? narrative.improvements : Object.freeze([]),
    presentationValuation: snapshot.presentationValuation,
    authoritativeBalance: false,
    ledgerWins: true,
    userEditable: Object.freeze([
      'goals',
      'incomeAssumptions',
      'declaredAssets',
      'declaredLiabilities',
      'riskQuestionnaire',
      'preferences',
      'activityClassifications',
    ]),
    serverAuthoritative: Object.freeze([
      'cash',
      'sunreyAccountBalances',
      'investmentsFromService',
      'derivedInsights',
      'suitabilityAssessment',
    ]),
  });
}

export type { CurrencyCashFlowAnalysis, DerivedInsight };
