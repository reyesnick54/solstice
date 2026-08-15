import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { RiskBudgetId } from '../../risk/src/ids.ts';
import { collectInstrumentIds, validateStrategyAst, type StrategyExpr } from './dsl.ts';
import {
  asStrategySpecificationId,
  type StrategyId,
  type StrategySpecificationId,
  type StrategyVersion,
} from './ids.ts';
import {
  STRATEGY_RESOURCE_LIMITS,
  type ModelDependency,
  type StrategyFailure,
  type TransactionCostAssumptions,
} from './types.ts';

export type EligibilityFilter = {
  readonly instrumentType?: 'ETF' | 'EQUITY' | 'BOND' | 'FUND' | 'CASH_EQUIVALENT';
  readonly currency?: string;
  readonly requireMembership: true;
};

export type StrategySpecification = {
  readonly specificationId: StrategySpecificationId;
  readonly strategyId: StrategyId;
  readonly version: StrategyVersion;
  readonly instrumentUniverse: readonly string[];
  readonly eligibilityFilters: readonly EligibilityFilter[];
  readonly approvedSignalRefs: readonly ModelDependency[];
  readonly rebalanceCadence: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  readonly targetAllocation: StrategyExpr;
  readonly entryConditions: StrategyExpr;
  readonly exitConditions: StrategyExpr;
  readonly cashAllocationBps: number;
  readonly riskBudgetId: RiskBudgetId;
  readonly mandateCompatibility: readonly string[];
  readonly transactionCosts: TransactionCostAssumptions;
  readonly requiredData: readonly string[];
  readonly requiredModels: readonly ModelDependency[];
  readonly createdAt: UtcInstant;
  readonly executableCode: false;
};

export function freezeSpecification(
  input: Omit<StrategySpecification, 'specificationId' | 'executableCode'> & {
    readonly specificationId?: StrategySpecificationId;
  },
): Result<StrategySpecification, StrategyFailure> {
  if (input.instrumentUniverse.length === 0) {
    return err({ code: 'UNVERSIONED_STRATEGY', message: 'instrument universe is required' });
  }
  if (input.instrumentUniverse.length > STRATEGY_RESOURCE_LIMITS.maximumInstruments) {
    return err({
      code: 'RESOURCE_LIMIT',
      message: `instrument universe exceeds maximumInstruments=${String(STRATEGY_RESOURCE_LIMITS.maximumInstruments)}`,
    });
  }
  if (input.cashAllocationBps < 0 || input.cashAllocationBps > 10_000) {
    return err({ code: 'LEVERAGE_FORBIDDEN', message: 'cash allocation must be between 0 and 10000 bps' });
  }
  if (input.transactionCosts.mode !== 'ZERO_COST_SIMULATION' && input.transactionCosts.mode !== 'EXPLICIT_COSTS') {
    return err({ code: 'HIDDEN_COST_FORBIDDEN', message: 'transaction costs must be named EXPLICIT_COSTS or ZERO_COST_SIMULATION' });
  }
  if (
    input.transactionCosts.mode === 'ZERO_COST_SIMULATION' &&
    (input.transactionCosts.commissionMinorPerShare !== 0n ||
      input.transactionCosts.spreadMinor !== 0n ||
      input.transactionCosts.slippageMinor !== 0n ||
      input.transactionCosts.otherCostMinor !== 0n)
  ) {
    return err({
      code: 'HIDDEN_COST_FORBIDDEN',
      message: 'ZERO_COST_SIMULATION must set every cost component to zero',
    });
  }
  const target = validateStrategyAst(input.targetAllocation);
  if (!target.ok) {
    return target;
  }
  const entry = validateStrategyAst(input.entryConditions);
  if (!entry.ok) {
    return entry;
  }
  const exit = validateStrategyAst(input.exitConditions);
  if (!exit.ok) {
    return exit;
  }
  const referenced = new Set([
    ...collectInstrumentIds(target.value),
    ...collectInstrumentIds(entry.value),
    ...collectInstrumentIds(exit.value),
  ]);
  for (const instrumentId of referenced) {
    if (instrumentId !== 'CASH' && !input.instrumentUniverse.includes(instrumentId)) {
      return err({
        code: 'INVALID_OPERATOR',
        message: `DSL references instrument ${instrumentId} outside the declared universe`,
      });
    }
  }
  return ok(
    Object.freeze({
      ...input,
      specificationId: input.specificationId ?? asStrategySpecificationId(`ssp_${input.strategyId.slice(4)}_${input.version}`),
      instrumentUniverse: Object.freeze([...input.instrumentUniverse]),
      eligibilityFilters: Object.freeze([...input.eligibilityFilters]),
      approvedSignalRefs: Object.freeze([...input.approvedSignalRefs]),
      mandateCompatibility: Object.freeze([...input.mandateCompatibility]),
      requiredData: Object.freeze([...input.requiredData]),
      requiredModels: Object.freeze([...input.requiredModels]),
      targetAllocation: target.value,
      entryConditions: entry.value,
      exitConditions: exit.value,
      executableCode: false,
    }),
  );
}
