import type { BacktestRun } from './backtest.ts';
import type { SimulationPlan } from './compiler.ts';
import type { MarketDataset } from './dataset.ts';
import type { Experiment } from './experiment.ts';
import type { KillSwitchState } from './kill-switch.ts';
import { INACTIVE_KILL_SWITCH } from './kill-switch.ts';
import type { PaperStrategyRun } from './paper.ts';
import type { StrategyPromotionReview } from './promotion.ts';
import type { ShadowDecision, ShadowRun } from './shadow.ts';
import type { StrategySpecification } from './specification.ts';
import type { DataSnoopingRecord, StrategyRecord } from './types.ts';
import type { StrategyValidationReport } from './validation.ts';
import type { WalkForwardRun } from './walk-forward.ts';

export type StrategyLabSnapshot = {
  readonly strategies: readonly StrategyRecord[];
  readonly specifications: readonly StrategySpecification[];
  readonly plans: readonly SimulationPlan[];
  readonly datasets: readonly MarketDataset[];
  readonly experiments: readonly Experiment[];
  readonly backtests: readonly BacktestRun[];
  readonly walkForwards: readonly WalkForwardRun[];
  readonly validations: readonly StrategyValidationReport[];
  readonly shadowRuns: readonly ShadowRun[];
  readonly shadowDecisions: readonly ShadowDecision[];
  readonly paperRuns: readonly PaperStrategyRun[];
  readonly reviews: readonly StrategyPromotionReview[];
  readonly snooping: readonly DataSnoopingRecord[];
  readonly killSwitch: KillSwitchState;
};

export function createEmptyStrategyLabSnapshot(): StrategyLabSnapshot {
  return Object.freeze({
    strategies: Object.freeze([]),
    specifications: Object.freeze([]),
    plans: Object.freeze([]),
    datasets: Object.freeze([]),
    experiments: Object.freeze([]),
    backtests: Object.freeze([]),
    walkForwards: Object.freeze([]),
    validations: Object.freeze([]),
    shadowRuns: Object.freeze([]),
    shadowDecisions: Object.freeze([]),
    paperRuns: Object.freeze([]),
    reviews: Object.freeze([]),
    snooping: Object.freeze([]),
    killSwitch: INACTIVE_KILL_SWITCH,
  });
}

export class StrategyLabStore {
  private readonly strategies = new Map<string, StrategyRecord>();
  private readonly specifications = new Map<string, StrategySpecification>();
  private readonly plans = new Map<string, SimulationPlan>();
  private readonly datasets = new Map<string, MarketDataset>();
  private readonly experiments: Experiment[] = [];
  private readonly backtests: BacktestRun[] = [];
  private readonly walkForwards: WalkForwardRun[] = [];
  private readonly validations: StrategyValidationReport[] = [];
  private readonly shadowRuns: ShadowRun[] = [];
  private readonly shadowDecisions: ShadowDecision[] = [];
  private readonly paperRuns: PaperStrategyRun[] = [];
  private readonly reviews: StrategyPromotionReview[] = [];
  private readonly snooping: DataSnoopingRecord[] = [];
  killSwitch: KillSwitchState = INACTIVE_KILL_SWITCH;

  private key(id: string, version: string): string {
    return `${id}@${version}`;
  }

  putStrategy(record: StrategyRecord): void {
    this.strategies.set(this.key(record.strategyId, record.version), record);
  }

  getStrategy(id: string, version: string): StrategyRecord | undefined {
    return this.strategies.get(this.key(id, version));
  }

  putSpecification(spec: StrategySpecification): void {
    this.specifications.set(this.key(spec.strategyId, spec.version), spec);
  }

  getSpecification(id: string, version: string): StrategySpecification | undefined {
    return this.specifications.get(this.key(id, version));
  }

  putPlan(plan: SimulationPlan): void {
    this.plans.set(this.key(plan.strategyId, plan.strategyVersion), plan);
  }

  getPlan(id: string, version: string): SimulationPlan | undefined {
    return this.plans.get(this.key(id, version));
  }

  putDataset(dataset: MarketDataset): void {
    this.datasets.set(this.key(dataset.datasetId, dataset.version), dataset);
  }

  getDataset(id: string, version: string): MarketDataset | undefined {
    return this.datasets.get(this.key(id, version));
  }

  putExperiment(experiment: Experiment): void {
    this.experiments.push(experiment);
  }

  putBacktest(run: BacktestRun): void {
    this.backtests.push(run);
  }

  putWalkForward(run: WalkForwardRun): void {
    this.walkForwards.push(run);
  }

  putValidation(report: StrategyValidationReport): void {
    this.validations.push(report);
  }

  putShadowRun(run: ShadowRun): void {
    this.shadowRuns.push(run);
  }

  putShadowDecision(decision: ShadowDecision): void {
    this.shadowDecisions.push(decision);
  }

  putPaperRun(run: PaperStrategyRun): void {
    this.paperRuns.push(run);
  }

  putReview(review: StrategyPromotionReview): void {
    this.reviews.push(review);
  }

  putSnooping(record: DataSnoopingRecord): void {
    this.snooping.push(record);
  }

  listBacktests(): readonly BacktestRun[] {
    return Object.freeze([...this.backtests]);
  }

  listExperiments(): readonly Experiment[] {
    return Object.freeze([...this.experiments]);
  }

  listShadowDecisions(): readonly ShadowDecision[] {
    return Object.freeze([...this.shadowDecisions]);
  }

  listSnooping(): readonly DataSnoopingRecord[] {
    return Object.freeze([...this.snooping]);
  }

  snapshot(): StrategyLabSnapshot {
    return Object.freeze({
      strategies: Object.freeze([...this.strategies.values()]),
      specifications: Object.freeze([...this.specifications.values()]),
      plans: Object.freeze([...this.plans.values()]),
      datasets: Object.freeze([...this.datasets.values()]),
      experiments: Object.freeze([...this.experiments]),
      backtests: Object.freeze([...this.backtests]),
      walkForwards: Object.freeze([...this.walkForwards]),
      validations: Object.freeze([...this.validations]),
      shadowRuns: Object.freeze([...this.shadowRuns]),
      shadowDecisions: Object.freeze([...this.shadowDecisions]),
      paperRuns: Object.freeze([...this.paperRuns]),
      reviews: Object.freeze([...this.reviews]),
      snooping: Object.freeze([...this.snooping]),
      killSwitch: this.killSwitch,
    });
  }
}
