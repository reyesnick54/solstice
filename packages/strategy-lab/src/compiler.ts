import { createHash } from 'node:crypto';

import { err, ok, type Result } from '../../domain/src/result.ts';
import { APPROVED_OPERATORS, validateStrategyAst, type ApprovedOperator } from './dsl.ts';
import { asStrategyCompilerVersion, type StrategyCompilerVersion } from './ids.ts';
import type { StrategySpecification } from './specification.ts';
import type { ModelDependency, RiskDependency, StrategyFailure } from './types.ts';

export const STRATEGY_COMPILER_VERSION = asStrategyCompilerVersion('strategy-compiler-v1');

export type SimulationPlan = {
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly compilerVersion: StrategyCompilerVersion;
  readonly compiledHash: string;
  readonly operatorSet: readonly ApprovedOperator[];
  readonly inputSchema: string;
  readonly modelDependencies: readonly ModelDependency[];
  readonly riskDependencies: readonly RiskDependency[];
  readonly datasetRequirements: readonly string[];
  readonly specificationId: string;
};

function collectOperators(value: unknown, into: Set<ApprovedOperator>): void {
  if (!value || typeof value !== 'object') {
    return;
  }
  if ('op' in value && typeof value.op === 'string' && (APPROVED_OPERATORS as readonly string[]).includes(value.op)) {
    into.add(value.op as ApprovedOperator);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectOperators(item, into);
    }
    return;
  }
  for (const item of Object.values(value)) {
    collectOperators(item, into);
  }
}

export function compileStrategy(
  specification: StrategySpecification,
  risk: RiskDependency,
): Result<SimulationPlan, StrategyFailure> {
  const target = validateStrategyAst(specification.targetAllocation);
  if (!target.ok) {
    return target;
  }
  const entry = validateStrategyAst(specification.entryConditions);
  if (!entry.ok) {
    return entry;
  }
  const exit = validateStrategyAst(specification.exitConditions);
  if (!exit.ok) {
    return exit;
  }
  const operators = new Set<ApprovedOperator>();
  collectOperators(specification.targetAllocation, operators);
  collectOperators(specification.entryConditions, operators);
  collectOperators(specification.exitConditions, operators);
  const canonical = JSON.stringify(
    {
      specificationId: specification.specificationId,
      strategyId: specification.strategyId,
      version: specification.version,
      compilerVersion: STRATEGY_COMPILER_VERSION,
      universe: specification.instrumentUniverse,
      eligibility: specification.eligibilityFilters,
      signals: specification.approvedSignalRefs,
      rebalance: specification.rebalanceCadence,
      target: specification.targetAllocation,
      entry: specification.entryConditions,
      exit: specification.exitConditions,
      cashBps: specification.cashAllocationBps,
      riskBudgetId: specification.riskBudgetId,
      costs: {
        mode: specification.transactionCosts.mode,
        commission: specification.transactionCosts.commissionMinorPerShare.toString(),
        spread: specification.transactionCosts.spreadMinor.toString(),
        slippage: specification.transactionCosts.slippageMinor.toString(),
        other: specification.transactionCosts.otherCostMinor.toString(),
      },
      models: specification.requiredModels,
      risk,
    },
    (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
  );
  return ok(
    Object.freeze({
      strategyId: specification.strategyId,
      strategyVersion: specification.version,
      compilerVersion: STRATEGY_COMPILER_VERSION,
      compiledHash: createHash('sha256').update(canonical).digest('hex'),
      operatorSet: Object.freeze([...operators].sort()),
      inputSchema: 'MarketDataset@T + StrategySpecification + ParameterSet',
      modelDependencies: Object.freeze([...specification.requiredModels, ...specification.approvedSignalRefs]),
      riskDependencies: Object.freeze([risk]),
      datasetRequirements: Object.freeze([...specification.requiredData]),
      specificationId: specification.specificationId,
    }),
  );
}

export function compiledHashFor(plan: SimulationPlan): string {
  return plan.compiledHash;
}
