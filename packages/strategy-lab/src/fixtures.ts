import { asUtcInstant, type UtcInstant } from '../../domain/src/time.ts';
import { asModelId, asModelVersion } from '../../model-registry/src/ids.ts';
import { asRiskBudgetId } from '../../risk/src/ids.ts';
import { freezeMarketDataset, type MarketDataset, type MarketObservation } from './dataset.ts';
import type { StrategyExpr } from './dsl.ts';
import { asParameterSetId, asStrategyId, asStrategyVersion } from './ids.ts';
import type { StrategySpecification } from './specification.ts';
import type { TransactionCostAssumptions } from './types.ts';

export const SIM_ETF_1 = 'SIM-ETF-1';
export const SIM_ETF_2 = 'SIM-ETF-2';
export const SIM_ETF_LEAVER = 'SIM-ETF-LEAVE';

function day(offset: number): UtcInstant {
  return asUtcInstant(`2026-01-${String(1 + offset).padStart(2, '0')}T00:00:00.000Z`);
}

function bar(instrumentId: string, offset: number, close: bigint, available = true): MarketObservation {
  const at = day(offset);
  return Object.freeze({
    instrumentId,
    at,
    openMinor: close,
    highMinor: close + 50n,
    lowMinor: close - 50n,
    closeMinor: close,
    available,
  });
}

export const EXPLICIT_COSTS: TransactionCostAssumptions = Object.freeze({
  mode: 'EXPLICIT_COSTS',
  commissionMinorPerShare: 2n,
  spreadMinor: 5n,
  slippageMinor: 3n,
  otherCostMinor: 0n,
  namedExplicitly: true,
});

export const ZERO_COST: TransactionCostAssumptions = Object.freeze({
  mode: 'ZERO_COST_SIMULATION',
  commissionMinorPerShare: 0n,
  spreadMinor: 0n,
  slippageMinor: 0n,
  otherCostMinor: 0n,
  namedExplicitly: true,
});

export function syntheticTwoEtfDataset(): MarketDataset {
  const observations: MarketObservation[] = [];
  for (let i = 0; i < 28; i += 1) {
    observations.push(bar(SIM_ETF_1, i, 10_000n + BigInt(i) * 20n));
    if (i >= 7) {
      observations.push(bar(SIM_ETF_2, i, 8_000n + BigInt(i) * 15n));
    }
    if (i < 21) {
      observations.push(bar(SIM_ETF_LEAVER, i, 6_000n + BigInt(i) * 10n));
    }
  }
  observations.push(
    Object.freeze({
      instrumentId: SIM_ETF_1,
      at: asUtcInstant('2026-02-15T00:00:00.000Z'),
      openMinor: 50_000n,
      highMinor: 50_000n,
      lowMinor: 50_000n,
      closeMinor: 50_000n,
      available: true,
    }),
  );
  const frozen = freezeMarketDataset({
    version: 'mds-two-etf-v1',
    instruments: Object.freeze([SIM_ETF_1, SIM_ETF_2, SIM_ETF_LEAVER]),
    membership: Object.freeze([
      { instrumentId: SIM_ETF_1, enteredAt: day(0), leftAt: null },
      { instrumentId: SIM_ETF_2, enteredAt: day(7), leftAt: null },
      { instrumentId: SIM_ETF_LEAVER, enteredAt: day(0), leftAt: day(21) },
    ]),
    timeRange: { start: day(0), end: day(27) },
    frequency: 'DAILY',
    source: 'SYNTHETIC_FIXTURE',
    provenance: 'Chunk 22R deterministic CI fixture',
    currency: 'USD',
    corporateActionHandling: 'INVESTMENTS_SPLIT_DIVIDEND_SEMANTICS',
    completeness: 'COMPLETE_FOR_FIXTURE',
    limitations: Object.freeze([
      'Synthetic prices only. Not a live market feed.',
      'Includes an instrument that leaves the universe before period end.',
      'A future February spike exists to prove look-ahead controls.',
    ]),
    observations: Object.freeze(observations),
    corporateActions: Object.freeze([
      {
        kind: 'DIVIDEND' as const,
        instrumentId: SIM_ETF_1,
        at: day(10),
        cashMinorPerShare: 25n,
      },
      {
        kind: 'SPLIT' as const,
        instrumentId: SIM_ETF_2,
        at: day(14),
        splitNumerator: 2n,
        splitDenominator: 1n,
      },
    ]),
  });
  if (!frozen.ok) {
    throw new Error(frozen.error.message);
  }
  return frozen.value;
}

export function syntheticBenchmarkDataset(): MarketDataset {
  const observations: MarketObservation[] = [];
  for (let i = 0; i < 28; i += 1) {
    observations.push(bar('SIM-BENCH', i, 10_000n + BigInt(i) * 8n));
  }
  const frozen = freezeMarketDataset({
    version: 'mds-bench-v1',
    instruments: Object.freeze(['SIM-BENCH']),
    membership: Object.freeze([{ instrumentId: 'SIM-BENCH', enteredAt: day(0), leftAt: null }]),
    timeRange: { start: day(0), end: day(27) },
    frequency: 'DAILY',
    source: 'SYNTHETIC_FIXTURE',
    provenance: 'Explicit synthetic benchmark fixture',
    currency: 'USD',
    corporateActionHandling: 'INVESTMENTS_SPLIT_DIVIDEND_SEMANTICS',
    completeness: 'COMPLETE_FOR_FIXTURE',
    limitations: Object.freeze(['Synthetic benchmark. Not a hidden or cherry-picked live index.']),
    observations: Object.freeze(observations),
    corporateActions: Object.freeze([]),
  });
  if (!frozen.ok) {
    throw new Error(frozen.error.message);
  }
  return frozen.value;
}

const SIGNAL_MODEL = {
  modelId: asModelId('mdl_investment_pretrade'),
  version: asModelVersion('risk-model-v1'),
};

export function equalWeightSpec(costs: TransactionCostAssumptions = EXPLICIT_COSTS): Omit<
  StrategySpecification,
  'specificationId' | 'executableCode'
> {
  const allocation: StrategyExpr = {
    op: 'ALLOCATION',
    weightsBps: { [SIM_ETF_1]: 4_000, [SIM_ETF_2]: 4_000, CASH: 2_000 },
  };
  const entry: StrategyExpr = {
    op: 'COMPARE',
    left: { kind: 'CLOSE', instrumentId: SIM_ETF_1 },
    comparator: 'GT',
    right: { kind: 'THRESHOLD', minorUnits: 9_000n },
  };
  const exit: StrategyExpr = {
    op: 'RISK_CONDITION',
    kind: 'CASH_BELOW_BPS',
    bps: 500,
  };
  return {
    strategyId: asStrategyId('str_two_etf_cash'),
    version: asStrategyVersion('v1'),
    instrumentUniverse: Object.freeze([SIM_ETF_1, SIM_ETF_2]),
    eligibilityFilters: Object.freeze([{ instrumentType: 'ETF', currency: 'USD', requireMembership: true }]),
    approvedSignalRefs: Object.freeze([SIGNAL_MODEL]),
    rebalanceCadence: 'WEEKLY',
    targetAllocation: allocation,
    entryConditions: entry,
    exitConditions: exit,
    cashAllocationBps: 2_000,
    riskBudgetId: asRiskBudgetId('rbdg_default_simulation'),
    mandateCompatibility: Object.freeze(['paper-simulation']),
    transactionCosts: costs,
    requiredData: Object.freeze(['daily-close', 'membership', 'corporate-actions']),
    requiredModels: Object.freeze([SIGNAL_MODEL]),
    createdAt: day(0),
  };
}

export function overfitSpec(): Omit<StrategySpecification, 'specificationId' | 'executableCode'> {
  const clauses: StrategyExpr[] = [];
  for (let i = 0; i < 8; i += 1) {
    clauses.push({
      op: 'THRESHOLD',
      fact: { kind: 'CLOSE', instrumentId: SIM_ETF_1 },
      minMinor: 9_000n + BigInt(i),
      maxMinor: 20_000n,
    });
  }
  return {
    ...equalWeightSpec(),
    strategyId: asStrategyId('str_overfit_fixture'),
    version: asStrategyVersion('v-overfit'),
    entryConditions: { op: 'AND', clauses },
    targetAllocation: {
      op: 'ALLOCATION',
      weightsBps: { [SIM_ETF_1]: 8_000, CASH: 2_000 },
    },
  };
}

export const DEFAULT_PARAMETER_SET = Object.freeze({
  parameterSetId: asParameterSetId('par_default_equal_weight'),
  values: Object.freeze({ cashBps: '2000', cadence: 'WEEKLY' }),
});
