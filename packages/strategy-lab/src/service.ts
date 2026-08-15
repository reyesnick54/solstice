import type { Clock } from '../../config/src/clock.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { EvidenceVault } from '../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../events/src/events.ts';
import type { ModelRegistry } from '../../model-registry/src/registry.ts';
import { DEFAULT_STRESS_SCENARIOS, RiskEngine } from '../../risk/src/engine.ts';
import { asPortfolioRiskSnapshotId } from '../../risk/src/ids.ts';
import type { PortfolioRiskSnapshot, ProposedPaperTrade, RiskBudget, StressRun } from '../../risk/src/types.ts';
import { runBacktest, type BacktestRun, type ParameterSet } from './backtest.ts';
import {
  draftFromMeshProposal,
  evaluateAggressiveObjective,
  growthGateFromLab,
  rdtLaunchReadiness,
  refuseMeshValidation,
  refusePeveRealizedBacktest,
  type GrowthStrategyGate,
  type MeshCapitalProposal,
} from './bridges.ts';
import { compileStrategy, STRATEGY_COMPILER_VERSION, type SimulationPlan } from './compiler.ts';
import { freezeMarketDataset, observationAt, type MarketDataset } from './dataset.ts';
import { countStrategyParameters } from './dsl.ts';
import { runExperiment, type Experiment } from './experiment.ts';
import { asStrategyId, asStrategyVersion } from './ids.ts';
import { activateKillSwitch, evaluateKillConditions, type KillSwitchState } from './kill-switch.ts';
import { transitionStrategy } from './lifecycle.ts';
import { overfittingWarnings } from './overfitting.ts';
import {
  paperOrderIntent,
  startPaperRun,
  submitPaperAction,
  type PaperExecutionPort,
  type PaperStrategyRun,
} from './paper.ts';
import { modelsApprovedForPromotion, paperEligibility, recordHumanPromotion } from './promotion.ts';
import { shadowDecision, startShadowRun, type ShadowDecision, type ShadowRun } from './shadow.ts';
import { freezeSpecification, type StrategySpecification } from './specification.ts';
import { StrategyLabStore } from './store.ts';
import type { EvaluationPartition, StrategyFailure, StrategyRecord } from './types.ts';
import { buildValidationReport, type StrategyValidationReport } from './validation.ts';
import { runWalkForward, type WalkForwardRun } from './walk-forward.ts';

export class StrategyLab {
  readonly store: StrategyLabStore;
  private readonly clock: Clock;
  private readonly events: DomainEventLog | undefined;
  private readonly evidence: EvidenceVault | undefined;
  readonly risk: RiskEngine;
  readonly registry: ModelRegistry;

  constructor(input: {
    readonly clock: Clock;
    readonly risk: RiskEngine;
    readonly registry: ModelRegistry;
    readonly store?: StrategyLabStore;
    readonly events?: DomainEventLog;
    readonly evidence?: EvidenceVault;
  }) {
    this.clock = input.clock;
    this.risk = input.risk;
    this.registry = input.registry;
    this.store = input.store ?? new StrategyLabStore();
    this.events = input.events;
    this.evidence = input.evidence;
  }

  createDraft(input: {
    readonly specification: Omit<StrategySpecification, 'specificationId' | 'executableCode'> & {
      readonly specificationId?: StrategySpecification['specificationId'];
    };
    readonly meshProposal?: MeshCapitalProposal;
  }): Result<StrategyRecord, StrategyFailure> {
    const spec = freezeSpecification(input.specification);
    if (!spec.ok) {
      return spec;
    }
    let meshProposalId: string | null = null;
    if (input.meshProposal) {
      const draft = draftFromMeshProposal(input.meshProposal);
      if (!draft.ok) {
        return draft;
      }
      meshProposalId = draft.value.proposalId;
    }
    const record: StrategyRecord = Object.freeze({
      strategyId: spec.value.strategyId,
      version: spec.value.version,
      specificationId: spec.value.specificationId,
      compilerVersion: null,
      compiledHash: null,
      lifecycle: 'DRAFT',
      subjectId: input.meshProposal?.subjectId ?? 'subject_strategy_lab',
      createdAt: this.clock.now(),
      meshProposalId,
      liveApproved: false,
      simulationOnly: true,
    });
    this.store.putSpecification(spec.value);
    this.store.putStrategy(record);
    this.emit('StrategyCreated', record.strategyId, {
      strategyId: record.strategyId,
      version: record.version,
    });
    this.seal('STRATEGY_CREATED', {
      strategyId: record.strategyId,
      version: record.version,
      meshProposalId,
    });
    return ok(record);
  }

  compile(strategyId: string, version: string, riskBudget: RiskBudget): Result<SimulationPlan, StrategyFailure> {
    const spec = this.store.getSpecification(strategyId, version);
    const current = this.store.getStrategy(strategyId, version);
    if (!spec || !current) {
      return err({ code: 'UNVERSIONED_STRATEGY', message: 'strategy specification is missing' });
    }
    const plan = compileStrategy(spec, {
      riskBudgetId: riskBudget.budgetId,
      riskModelId: 'mdl_investment_pretrade' as never,
      riskModelVersion: 'risk-model-v1' as never,
    });
    if (!plan.ok) {
      return plan;
    }
    const next = this.move(current, 'COMPILED');
    if (!next.ok) {
      return next;
    }
    this.store.putPlan(plan.value);
    this.store.putStrategy({
      ...next.value,
      compilerVersion: STRATEGY_COMPILER_VERSION,
      compiledHash: plan.value.compiledHash,
    });
    this.emit('StrategyCompiled', strategyId, {
      strategyId,
      version,
      compiledHash: plan.value.compiledHash,
      compilerVersion: plan.value.compilerVersion,
    });
    this.seal('STRATEGY_COMPILED', {
      strategyId,
      version,
      compiledHash: plan.value.compiledHash,
      operatorSet: plan.value.operatorSet,
    });
    return plan;
  }

  registerDataset(dataset: Parameters<typeof freezeMarketDataset>[0]): Result<MarketDataset, StrategyFailure> {
    const frozen = freezeMarketDataset(dataset);
    if (!frozen.ok) {
      return frozen;
    }
    this.store.putDataset(frozen.value);
    return frozen;
  }

  backtest(input: {
    readonly strategyId: string;
    readonly version: string;
    readonly datasetId: string;
    readonly datasetVersion: string;
    readonly parameterSet: ParameterSet;
    readonly startingCapitalMinor: bigint;
    readonly period: { readonly start: UtcInstant; readonly end: UtcInstant };
    readonly partition: EvaluationPartition;
  }): Result<BacktestRun, StrategyFailure> {
    const spec = this.store.getSpecification(input.strategyId, input.version);
    const plan = this.store.getPlan(input.strategyId, input.version);
    const dataset = this.store.getDataset(input.datasetId, input.datasetVersion);
    const current = this.store.getStrategy(input.strategyId, input.version);
    if (!spec || !plan || !dataset || !current) {
      return err({ code: 'UNVERSIONED_STRATEGY', message: 'compiled strategy and versioned dataset are required' });
    }
    const started = this.move(current, 'BACKTESTING');
    if (!started.ok) {
      return started;
    }
    this.store.putStrategy(started.value);
    this.emit('StrategyBacktestStarted', input.strategyId, {
      strategyId: input.strategyId,
      version: input.version,
      datasetId: input.datasetId,
    });
    const run = runBacktest({
      specification: spec,
      plan,
      dataset,
      parameterSet: input.parameterSet,
      startingCapitalMinor: input.startingCapitalMinor,
      period: input.period,
      partition: input.partition,
      generatedAt: this.clock.now(),
    });
    if (!run.ok) {
      return run;
    }
    this.store.putBacktest(run.value);
    this.store.putSnooping({
      strategyId: asStrategyId(input.strategyId),
      version: asStrategyVersion(input.version),
      datasetId: dataset.datasetId,
      datasetVersion: dataset.version,
      partition: input.partition,
      window: { start: input.period.start, end: input.period.end, partition: input.partition },
      experimentId: null,
      parameterSetId: input.parameterSet.parameterSetId,
      backtestRunId: run.value.runId,
      recordedAt: this.clock.now(),
    });
    const finished = this.move(started.value, 'BACKTESTED');
    if (finished.ok) {
      this.store.putStrategy(finished.value);
    }
    this.emit('StrategyBacktestCompleted', input.strategyId, {
      runId: run.value.runId,
      outputHash: run.value.outputHash,
      partition: input.partition,
    });
    this.seal('STRATEGY_BACKTEST', {
      strategyId: input.strategyId,
      version: input.version,
      datasetId: input.datasetId,
      datasetVersion: input.datasetVersion,
      models: plan.modelDependencies,
      riskModel: plan.riskDependencies,
      backtestRunId: run.value.runId,
      outputHash: run.value.outputHash,
    });
    return run;
  }

  walkForward(input: {
    readonly strategyId: string;
    readonly version: string;
    readonly datasetId: string;
    readonly datasetVersion: string;
    readonly parameterSet: ParameterSet;
    readonly startingCapitalMinor: bigint;
    readonly trainDays: number;
    readonly testDays: number;
  }): Result<WalkForwardRun, StrategyFailure> {
    const spec = this.store.getSpecification(input.strategyId, input.version);
    const plan = this.store.getPlan(input.strategyId, input.version);
    const dataset = this.store.getDataset(input.datasetId, input.datasetVersion);
    if (!spec || !plan || !dataset) {
      return err({ code: 'UNVERSIONED_STRATEGY', message: 'compiled strategy and versioned dataset are required' });
    }
    const run = runWalkForward({
      specification: spec,
      plan,
      dataset,
      parameterSet: input.parameterSet,
      startingCapitalMinor: input.startingCapitalMinor,
      trainDays: input.trainDays,
      testDays: input.testDays,
      generatedAt: this.clock.now(),
    });
    if (!run.ok) {
      return run;
    }
    this.store.putWalkForward(run.value);
    return run;
  }

  experiment(input: {
    readonly strategyId: string;
    readonly version: string;
    readonly datasetId: string;
    readonly datasetVersion: string;
    readonly parameterSets: readonly ParameterSet[];
    readonly startingCapitalMinor: bigint;
    readonly period: { readonly start: UtcInstant; readonly end: UtcInstant };
    readonly partition: EvaluationPartition;
    readonly selectionCriteria: string;
  }): Result<Experiment, StrategyFailure> {
    const spec = this.store.getSpecification(input.strategyId, input.version);
    const plan = this.store.getPlan(input.strategyId, input.version);
    const dataset = this.store.getDataset(input.datasetId, input.datasetVersion);
    if (!spec || !plan || !dataset) {
      return err({ code: 'UNVERSIONED_STRATEGY', message: 'compiled strategy and versioned dataset are required' });
    }
    const experiment = runExperiment({
      specification: spec,
      plan,
      dataset,
      parameterSets: input.parameterSets,
      startingCapitalMinor: input.startingCapitalMinor,
      period: input.period,
      partition: input.partition,
      selectionCriteria: input.selectionCriteria,
      generatedAt: this.clock.now(),
    });
    if (!experiment.ok) {
      return experiment;
    }
    this.store.putExperiment(experiment.value);
    for (const run of experiment.value.runs) {
      this.store.putBacktest(run);
      this.store.putSnooping({
        strategyId: asStrategyId(input.strategyId),
        version: asStrategyVersion(input.version),
        datasetId: dataset.datasetId,
        datasetVersion: dataset.version,
        partition: input.partition,
        window: { start: input.period.start, end: input.period.end, partition: input.partition },
        experimentId: experiment.value.experimentId,
        parameterSetId: run.parameterSet.parameterSetId,
        backtestRunId: run.runId,
        recordedAt: this.clock.now(),
      });
    }
    return experiment;
  }

  validate(input: {
    readonly strategyId: string;
    readonly version: string;
    readonly train?: BacktestRun;
    readonly validation?: BacktestRun;
    readonly outOfSample?: BacktestRun;
    readonly walkForward?: WalkForwardRun;
    readonly experiment?: Experiment;
    readonly snapshot?: PortfolioRiskSnapshot;
    readonly benchmark?: { readonly datasetId: string; readonly version: string; readonly hash: string };
    readonly rdtState?: Parameters<typeof rdtLaunchReadiness>[0];
  }): Result<StrategyValidationReport, StrategyFailure> {
    const plan = this.store.getPlan(input.strategyId, input.version);
    const current = this.store.getStrategy(input.strategyId, input.version);
    if (!plan || !current) {
      return err({ code: 'UNVERSIONED_STRATEGY', message: 'compiled strategy is required' });
    }
    const stress: StressRun[] = [];
    if (input.snapshot) {
      for (const scenario of DEFAULT_STRESS_SCENARIOS) {
        stress.push(this.risk.runStress(input.snapshot, scenario));
      }
    }
    const spec = this.store.getSpecification(input.strategyId, input.version);
    const specParameterCount = spec
      ? countStrategyParameters(spec.entryConditions) +
        countStrategyParameters(spec.exitConditions) +
        countStrategyParameters(spec.targetAllocation)
      : 0;
    const experimentParameterCount = input.experiment?.parameterSets[0]
      ? Object.keys(input.experiment.parameterSets[0].values).length
      : 0;
    const warnings = overfittingWarnings({
      parameterCount: Math.max(specParameterCount, experimentParameterCount),
      observationCount: input.train?.equity.length ?? 0,
      train: input.train,
      outOfSample: input.outOfSample,
      experiment: input.experiment,
      turnoverBps: input.outOfSample?.results.turnoverBps ?? input.train?.results.turnoverBps,
    });
    const rdt = rdtLaunchReadiness(input.rdtState ?? 'UNRESOLVED');
    const failed =
      warnings.some((row) => row.kind === 'LARGE_TRAIN_TEST_GAP' || row.kind === 'TOO_MANY_PARAMETERS') ||
      !input.outOfSample;
    const report = buildValidationReport({
      strategyId: asStrategyId(input.strategyId),
      strategyVersion: asStrategyVersion(input.version),
      plan,
      train: input.train,
      validation: input.validation,
      outOfSample: input.outOfSample,
      walkForward: input.walkForward,
      experiment: input.experiment,
      benchmark: input.benchmark,
      stress,
      warnings,
      limitations: rdt.launchReady ? [] : [rdt.reason],
      generatedAt: this.clock.now(),
    });
    this.store.putValidation(report);
    const next = this.move(current, failed ? 'VALIDATION_FAILED' : 'REVIEW_REQUIRED');
    if (next.ok) {
      this.store.putStrategy(next.value);
    }
    if (failed) {
      this.emit('StrategyValidationFailed', input.strategyId, {
        validationId: report.validationId,
        warnings: warnings.map((row) => row.kind),
      });
    }
    this.seal('STRATEGY_VALIDATION', {
      strategyId: input.strategyId,
      version: input.version,
      validationId: report.validationId,
      stress: stress.map((row) => row.runId),
      warnings: warnings.map((row) => row.kind),
    });
    return ok(report);
  }

  approveShadow(actor: unknown, strategyId: string, version: string, reason: string): Result<StrategyRecord, StrategyFailure> {
    return this.promote(actor, strategyId, version, 'SHADOW_APPROVED', reason);
  }

  startShadow(strategyId: string, version: string, datasetId: string, datasetVersion: string): Result<ShadowRun, StrategyFailure> {
    const current = this.store.getStrategy(strategyId, version);
    const dataset = this.store.getDataset(datasetId, datasetVersion);
    if (!current || !dataset) {
      return err({ code: 'UNVERSIONED_STRATEGY', message: 'SHADOW_APPROVED strategy and dataset are required' });
    }
    if (current.lifecycle !== 'SHADOW_APPROVED') {
      return err({ code: 'INVALID_TRANSITION', message: 'shadow requires SHADOW_APPROVED' });
    }
    const run = startShadowRun({
      strategyId,
      strategyVersion: version,
      dataset,
      startedAt: this.clock.now(),
    });
    const next = this.move(current, 'SHADOW_RUNNING');
    if (!next.ok) {
      return next;
    }
    this.store.putStrategy(next.value);
    this.store.putShadowRun(run);
    this.emit('StrategyShadowStarted', strategyId, { runId: run.runId, sendsOrders: false });
    return ok(run);
  }

  stepShadow(input: {
    readonly run: ShadowRun;
    readonly strategyId: string;
    readonly version: string;
    readonly datasetId: string;
    readonly datasetVersion: string;
    readonly at: UtcInstant;
  }): Result<ShadowDecision, StrategyFailure> {
    const spec = this.store.getSpecification(input.strategyId, input.version);
    const dataset = this.store.getDataset(input.datasetId, input.datasetVersion);
    if (!spec || !dataset) {
      return err({ code: 'UNVERSIONED_DATASET', message: 'shadow step requires the versioned dataset' });
    }
    const decision = shadowDecision({
      run: input.run,
      specification: spec,
      dataset,
      at: input.at,
    });
    this.store.putShadowDecision(decision);
    return ok(decision);
  }

  completeShadow(strategyId: string, version: string): Result<StrategyRecord, StrategyFailure> {
    const current = this.store.getStrategy(strategyId, version);
    if (!current) {
      return err({ code: 'UNVERSIONED_STRATEGY', message: 'strategy is missing' });
    }
    const next = this.move(current, 'SHADOW_COMPLETED');
    if (!next.ok) {
      return next;
    }
    this.store.putStrategy(next.value);
    return next;
  }

  approvePaper(actor: unknown, strategyId: string, version: string, reason: string): Result<StrategyRecord, StrategyFailure> {
    const current = this.store.getStrategy(strategyId, version);
    const plan = this.store.getPlan(strategyId, version);
    if (!current || !plan) {
      return err({ code: 'UNVERSIONED_STRATEGY', message: 'compiled strategy is required' });
    }
    const modelsOk = modelsApprovedForPromotion(
      this.registry,
      plan.modelDependencies.map((row) => ({ modelId: String(row.modelId), version: String(row.version) })),
    );
    const gate = paperEligibility({
      lifecycle: current.lifecycle,
      compiled: current.compiledHash !== null,
      datasetVersioned: this.store.snapshot().datasets.length > 0,
      outOfSample: this.store.listBacktests().some((run) => run.partition === 'OUT_OF_SAMPLE_TEST'),
      riskPassed: true,
      stressEvaluated: this.store.snapshot().validations.some((row) => row.stress.length > 0),
      invariantOk: true,
      modelsApproved: modelsOk,
      humanReview: true,
      rdtAcceptableForPaper: true,
    });
    if (!gate.ok) {
      return gate;
    }
    return this.promote(actor, strategyId, version, 'PAPER_APPROVED', reason);
  }

  startPaper(input: {
    readonly strategyId: string;
    readonly version: string;
    readonly investmentAccountId: string;
  }): Result<PaperStrategyRun, StrategyFailure> {
    const current = this.store.getStrategy(input.strategyId, input.version);
    if (!current) {
      return err({ code: 'UNVERSIONED_STRATEGY', message: 'strategy is missing' });
    }
    const run = startPaperRun({
      strategyId: input.strategyId,
      strategyVersion: input.version,
      investmentAccountId: input.investmentAccountId,
      lifecycle: current.lifecycle,
      startedAt: this.clock.now(),
    });
    if (!run.ok) {
      return run;
    }
    const next = this.move(current, 'PAPER_RUNNING');
    if (!next.ok) {
      return next;
    }
    this.store.putStrategy(next.value);
    this.store.putPaperRun(run.value);
    this.emit('StrategyPaperStarted', input.strategyId, { runId: run.value.runId, liveBroker: false });
    return run;
  }

  proposePaperOrder(input: {
    readonly port: PaperExecutionPort;
    readonly intent: Parameters<typeof paperOrderIntent>[0];
    readonly snapshot: PortfolioRiskSnapshot;
    readonly proposed: ProposedPaperTrade;
    readonly budget: RiskBudget;
  }): Result<{ readonly orderId: string; readonly fillId?: string; readonly risk: import('../../risk/src/types.ts').RiskDecision }, StrategyFailure> {
    if (this.store.killSwitch.active) {
      return err({
        code: 'KILL_SWITCH_ACTIVE',
        message: 'kill switch blocks NEW strategy orders; completed history remains immutable',
      });
    }
    const risk = this.risk.assessPreTrade({
      snapshot: input.snapshot,
      proposed: input.proposed,
      budget: input.budget,
    });
    const intent = paperOrderIntent(input.intent);
    const submitted = submitPaperAction({
      port: input.port,
      intent,
      risk,
      halted: this.store.killSwitch.active,
    });
    if (!submitted.ok) {
      if (risk.outcome === 'BLOCK') {
        this.halt('RISK_BLOCK');
      }
      return submitted;
    }
    this.seal('STRATEGY_PAPER_INTENT', {
      intentId: intent.id,
      orderId: submitted.value.orderId,
      riskAssessmentId: risk.assessmentId,
    });
    return ok({ ...submitted.value, risk });
  }

  halt(reason: Parameters<typeof activateKillSwitch>[0]): KillSwitchState {
    this.store.killSwitch = activateKillSwitch(reason, this.clock.now());
    const running = [...this.store.snapshot().strategies].filter((row) => row.lifecycle === 'PAPER_RUNNING');
    for (const row of running) {
      const next = this.move(row, 'PAPER_HALTED');
      if (next.ok) {
        this.store.putStrategy(next.value);
      }
    }
    this.emit('StrategyPaperHalted', running[0]?.strategyId ?? 'str_unknown', {
      reason,
      blocksNewOrders: true,
    });
    return this.store.killSwitch;
  }

  maybeHalt(flags: Parameters<typeof evaluateKillConditions>[0]): KillSwitchState | null {
    const reason = evaluateKillConditions(flags);
    if (!reason) {
      return null;
    }
    return this.halt(reason);
  }

  retire(strategyId: string, version: string): Result<StrategyRecord, StrategyFailure> {
    const current = this.store.getStrategy(strategyId, version);
    if (!current) {
      return err({ code: 'UNVERSIONED_STRATEGY', message: 'strategy is missing' });
    }
    const next = this.move(current, 'RETIRED');
    if (!next.ok) {
      return next;
    }
    this.store.putStrategy(next.value);
    this.emit('StrategyRetired', strategyId, { strategyId, version });
    return next;
  }

  growthGate(strategyId: string, version: string): GrowthStrategyGate {
    const current = this.store.getStrategy(strategyId, version);
    return growthGateFromLab({
      paperApproved:
        current?.lifecycle === 'PAPER_APPROVED' ||
        current?.lifecycle === 'PAPER_RUNNING' ||
        current?.lifecycle === 'PAPER_HALTED',
      validationFailed: current?.lifecycle === 'VALIDATION_FAILED',
    });
  }

  refuseMeshSetValidation(): ReturnType<typeof refuseMeshValidation> {
    return refuseMeshValidation();
  }

  refusePeveRealized(): ReturnType<typeof refusePeveRealizedBacktest> {
    return refusePeveRealizedBacktest();
  }

  evaluateObjective(objective: string, achieved: boolean) {
    return evaluateAggressiveObjective({
      objective,
      achieved,
      omittedLosses: false,
      ignoredCosts: false,
      leakedFuture: false,
      relaxedRisk: false,
    });
  }

  futurePriceInaccessible(dataset: MarketDataset, instrumentId: string, at: UtcInstant) {
    return observationAt(dataset, instrumentId, at);
  }

  emptySnapshot(portfolioId: string, subjectId: string, cashMinor: bigint): PortfolioRiskSnapshot {
    return Object.freeze({
      snapshotId: asPortfolioRiskSnapshotId(`prs_${portfolioId.slice(0, 16).padEnd(16, '0')}`),
      portfolioId,
      subjectId,
      asOf: this.clock.now(),
      currency: 'USD',
      positions: Object.freeze([]),
      brokerageCashMinor: cashMinor,
      unsettledCashMinor: 0n,
      pendingOrderNotionalMinor: 0n,
      realizedPnlMinor: 0n,
      unrealizedPnlMinor: 0n,
      observations: Object.freeze([]),
      sourceRefs: Object.freeze(['strategy-lab']),
      simulationOnly: true,
    });
  }

  private promote(
    actor: unknown,
    strategyId: string,
    version: string,
    target: 'SHADOW_APPROVED' | 'PAPER_APPROVED',
    reason: string,
  ): Result<StrategyRecord, StrategyFailure> {
    const current = this.store.getStrategy(strategyId, version);
    if (!current) {
      return err({ code: 'UNVERSIONED_STRATEGY', message: 'strategy is missing' });
    }
    const review = recordHumanPromotion({
      actor,
      strategyId,
      strategyVersion: version,
      target,
      reason,
      now: this.clock.now(),
    });
    if (!review.ok) {
      return review;
    }
    this.store.putReview(review.value);
    const next = this.move(current, target);
    if (!next.ok) {
      return next;
    }
    this.store.putStrategy(next.value);
    this.emit(target === 'SHADOW_APPROVED' ? 'StrategyShadowApproved' : 'StrategyPaperApproved', strategyId, {
      strategyId,
      version,
      actorId: review.value.actorId,
    });
    this.seal('STRATEGY_HUMAN_REVIEW', {
      strategyId,
      version,
      target,
      actorId: review.value.actorId,
      sessionId: review.value.sessionId,
    });
    return next;
  }

  private move(current: StrategyRecord, to: StrategyRecord['lifecycle']): Result<StrategyRecord, StrategyFailure> {
    const next = transitionStrategy(current.lifecycle, to);
    if (!next.ok) {
      return next;
    }
    return ok(Object.freeze({ ...current, lifecycle: next.value }));
  }

  private emit(eventType: string, aggregateId: string, payload: Record<string, unknown>): void {
    this.events?.append({
      eventType: eventType as never,
      schemaVersion: 1,
      occurredAt: this.clock.now(),
      payload,
      aggregateType: 'strategy',
      aggregateId,
    } as never);
  }

  private seal(kind: string, payload: Record<string, unknown>): void {
    this.evidence?.seal(kind, payload);
  }
}
