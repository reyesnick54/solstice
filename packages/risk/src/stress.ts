import { applyRatio, ratioPercent } from './arithmetic.ts';
import {
  asStressRunId,
  asStressScenarioId,
  type PortfolioRiskSnapshotId,
  type StressRunId,
} from './ids.ts';
import type { PortfolioRiskSnapshot, StressRun, StressScenario, TriggeredLimit } from './types.ts';
import { portfolioMarketValue } from './snapshot.ts';

export const EQUITY_SHOCK_NEGATIVE_10: StressScenario = Object.freeze({
  scenarioId: asStressScenarioId('ssc_equity_neg_10'),
  kind: 'EQUITY_SHOCK_NEGATIVE_10',
  version: 'stress-v1',
  shockRatio: ratioPercent(10n),
  assumptions: Object.freeze(['Applies to EQUITY and ETF fixture positions only', 'Engineering scenario, not a forecast']),
  source: 'ENGINEERING_FIXTURE',
  status: 'ACTIVE_SIMULATION',
  predictiveClaim: false,
});

export const EQUITY_SHOCK_NEGATIVE_20: StressScenario = Object.freeze({
  scenarioId: asStressScenarioId('ssc_equity_neg_20'),
  kind: 'EQUITY_SHOCK_NEGATIVE_20',
  version: 'stress-v1',
  shockRatio: ratioPercent(20n),
  assumptions: Object.freeze(['Applies to EQUITY and ETF fixture positions only', 'Engineering scenario, not a forecast']),
  source: 'ENGINEERING_FIXTURE',
  status: 'ACTIVE_SIMULATION',
  predictiveClaim: false,
});

export const FX_SHOCK: StressScenario = Object.freeze({
  scenarioId: asStressScenarioId('ssc_fx'),
  kind: 'FX_SHOCK',
  version: 'stress-v1',
  shockRatio: ratioPercent(10n),
  assumptions: Object.freeze(['Applies to non-base-currency positions only']),
  source: 'ENGINEERING_FIXTURE',
  status: 'ACTIVE_SIMULATION',
  predictiveClaim: false,
});

export const LIQUIDITY_REDUCTION: StressScenario = Object.freeze({
  scenarioId: asStressScenarioId('ssc_liquidity'),
  kind: 'LIQUIDITY_REDUCTION',
  version: 'stress-v1',
  shockRatio: ratioPercent(15n),
  assumptions: Object.freeze(['Haircut LOW and UNKNOWN liquidity fixtures only']),
  source: 'ENGINEERING_FIXTURE',
  status: 'ACTIVE_SIMULATION',
  predictiveClaim: false,
});

export const CORRELATED_ASSET_SHOCK: StressScenario = Object.freeze({
  scenarioId: asStressScenarioId('ssc_correlated'),
  kind: 'CORRELATED_ASSET_SHOCK',
  version: 'stress-v1',
  shockRatio: ratioPercent(12n),
  assumptions: Object.freeze(['Applies the same shock to every position sharing the shocked asset class']),
  source: 'ENGINEERING_FIXTURE',
  status: 'ACTIVE_SIMULATION',
  predictiveClaim: false,
});

export const DEFAULT_STRESS_SCENARIOS: readonly StressScenario[] = Object.freeze([
  EQUITY_SHOCK_NEGATIVE_10,
  EQUITY_SHOCK_NEGATIVE_20,
  FX_SHOCK,
  LIQUIDITY_REDUCTION,
  CORRELATED_ASSET_SHOCK,
]);

function shockedValue(snapshot: PortfolioRiskSnapshot, scenario: StressScenario): bigint {
  let total = 0n;
  for (const position of snapshot.positions) {
    let apply = false;
    if (scenario.kind === 'EQUITY_SHOCK_NEGATIVE_10' || scenario.kind === 'EQUITY_SHOCK_NEGATIVE_20') {
      apply = position.instrumentType === 'EQUITY' || position.instrumentType === 'ETF';
    } else if (scenario.kind === 'FX_SHOCK') {
      apply = position.currency !== snapshot.currency;
    } else if (scenario.kind === 'LIQUIDITY_REDUCTION') {
      apply = position.liquidityClass === 'LOW' || position.liquidityClass === 'UNKNOWN';
    } else {
      apply = position.instrumentType === 'EQUITY' || position.instrumentType === 'ETF';
    }
    const haircut = apply ? applyRatio(position.marketValueMinor, scenario.shockRatio) : 0n;
    total += position.marketValueMinor - haircut;
  }
  return total + snapshot.brokerageCashMinor;
}

export function runStressScenario(input: {
  readonly snapshot: PortfolioRiskSnapshot;
  readonly scenario: StressScenario;
  readonly generatedAt: string;
  readonly maxLossMinor?: bigint;
  readonly runId?: StressRunId;
}): StressRun {
  const base = portfolioMarketValue(input.snapshot.positions) + input.snapshot.brokerageCashMinor;
  const stressed = shockedValue(input.snapshot, input.scenario);
  const loss = base > stressed ? base - stressed : 0n;
  const breached: TriggeredLimit[] = [];
  if (input.maxLossMinor !== undefined && loss > input.maxLossMinor) {
    breached.push(
      Object.freeze({
        limitId: input.scenario.scenarioId as unknown as TriggeredLimit['limitId'],
        dimension: 'LOSS_BUDGET',
        priority: 'HARD_RISK_LIMIT',
        message: 'stressed loss exceeds the configured simulation loss budget',
        observedMinor: loss,
        limitMinor: input.maxLossMinor,
      }),
    );
  }
  return Object.freeze({
    runId: input.runId ?? asStressRunId(`srun_${input.scenario.kind.toLowerCase()}`),
    scenarioId: input.scenario.scenarioId,
    snapshotId: input.snapshot.snapshotId as PortfolioRiskSnapshotId,
    estimatedLossMinor: loss,
    stressedPortfolioMinor: stressed,
    breachedLimits: Object.freeze(breached),
    generatedAt: input.generatedAt,
    mutatesFinancialState: false,
    placesOrders: false,
  });
}
