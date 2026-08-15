import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asAccountId } from '../../domain/src/account.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { ModelRegistry, seedCanonicalRiskModel } from '../../model-registry/src/registry.ts';
import { defaultSimulationBudget, RiskEngine } from '../../risk/src/engine.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { validateStrategyAst } from './dsl.ts';
import { refuseExperimentDeletion, expandParameterGrid } from './experiment.ts';
import {
  DEFAULT_PARAMETER_SET,
  EXPLICIT_COSTS,
  SIM_ETF_1,
  equalWeightSpec,
  overfitSpec,
  syntheticBenchmarkDataset,
  syntheticTwoEtfDataset,
} from './fixtures.ts';
import { asStrategyId, asStrategyVersion } from './ids.ts';
import { assertNoLiveTransition, transitionStrategy } from './lifecycle.ts';
import { classifyPeveStrategyValue, refuseMeshValidation, refusePeveRealizedBacktest } from './bridges.ts';
import { StrategyLab } from './service.ts';
import { LIVE_STRATEGY_EXECUTION } from './types.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');

function harness() {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  assert.equal(
    identity.provisionSimulatedActor({
      actorId: 'operator_1',
      jurisdiction: asJurisdiction('GB'),
      identityId: 'id_lab_op',
      customerId: asCustomerId('cust_lab_op'),
      capabilities: ['VIEW_ACCOUNT', 'INVESTMENT_OPERATE_REQUEST'],
    }).ok,
    true,
  );
  const actor = identity.service.resolveActorContext('operator_1');
  assert.equal(actor.ok, true);
  if (!actor.ok) {
    throw new Error('actor');
  }
  const registry = new ModelRegistry();
  assert.equal(seedCanonicalRiskModel(registry, actor.value, NOW).ok, true);
  const risk = new RiskEngine({ clock, registry, events, evidence });
  const lab = new StrategyLab({ clock, risk, registry, events, evidence });
  const budget = defaultSimulationBudget({
    subjectId: 'cust_lab_op',
    portfolioId: 'inv_lab',
    reviewBy: NOW,
  });
  risk.putBudget(budget);
  return { lab, actor: actor.value, budget, events, evidence, registry };
}

describe('Strategy Lab', () => {
  it('compiles a safe DSL, reproduces backtests, and blocks future data', () => {
    const { lab, budget } = harness();
    const dataset = syntheticTwoEtfDataset();
    assert.equal(lab.registerDataset(dataset).ok, true);
    const draft = lab.createDraft({
      specification: equalWeightSpec(),
      meshProposal: {
        proposalId: 'cprop_lab_1',
        subjectId: 'cust_lab_op',
        thesisSummary: 'Two ETF plus cash paper thesis',
        instrumentUniverse: [SIM_ETF_1, 'SIM-ETF-2'],
        riskBudgetRef: budget.budgetId,
        modelRefs: [{ modelId: 'mdl_investment_pretrade', version: 'risk-model-v1' }],
        source: 'AGENTIC_CAPITAL_MESH',
        meshCannotSetValidation: true,
      },
    });
    assert.equal(draft.ok, true);
    const compiled = lab.compile('str_two_etf_cash', 'v1', budget);
    assert.equal(compiled.ok, true);
    if (!compiled.ok || !draft.ok) {
      return;
    }
    const first = lab.backtest({
      strategyId: 'str_two_etf_cash',
      version: 'v1',
      datasetId: dataset.datasetId,
      datasetVersion: dataset.version,
      parameterSet: DEFAULT_PARAMETER_SET,
      startingCapitalMinor: 100_000n,
      period: dataset.timeRange,
      partition: 'TRAIN',
    });
    const second = lab.backtest({
      strategyId: 'str_two_etf_cash',
      version: 'v1',
      datasetId: dataset.datasetId,
      datasetVersion: dataset.version,
      parameterSet: DEFAULT_PARAMETER_SET,
      startingCapitalMinor: 100_000n,
      period: dataset.timeRange,
      partition: 'TRAIN',
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) {
      return;
    }
    assert.equal(first.value.outputHash, second.value.outputHash);
    assert.equal(first.value.transactionCosts.mode, 'EXPLICIT_COSTS');
    assert.equal(first.value.results.futureReturnGuarantee, false);
    assert.equal(first.value.trainUnbiasedClaim, false);
    const leaked = lab.futurePriceInaccessible(dataset, SIM_ETF_1, asUtcInstant('2026-01-05T00:00:00.000Z'));
    assert.equal(leaked.ok, true);
    const future = lab.futurePriceInaccessible(dataset, SIM_ETF_1, asUtcInstant('2026-02-15T00:00:00.000Z'));
    assert.equal(future.ok, false);
    if (!future.ok) {
      assert.equal(future.error.code, 'FUTURE_DATA_FORBIDDEN');
    }
    assert.equal(dataset.membership.some((row) => row.leftAt !== null), true);
  });

  it('separates train, validation, out-of-sample, walk-forward, and experiment history', () => {
    const { lab, budget } = harness();
    const dataset = syntheticTwoEtfDataset();
    const bench = syntheticBenchmarkDataset();
    lab.registerDataset(dataset);
    lab.registerDataset(bench);
    assert.equal(lab.createDraft({ specification: equalWeightSpec() }).ok, true);
    assert.equal(lab.compile('str_two_etf_cash', 'v1', budget).ok, true);
    const train = lab.backtest({
      strategyId: 'str_two_etf_cash',
      version: 'v1',
      datasetId: dataset.datasetId,
      datasetVersion: dataset.version,
      parameterSet: DEFAULT_PARAMETER_SET,
      startingCapitalMinor: 100_000n,
      period: { start: dataset.timeRange.start, end: asUtcInstant('2026-01-10T00:00:00.000Z') },
      partition: 'TRAIN',
    });
    const oos = lab.backtest({
      strategyId: 'str_two_etf_cash',
      version: 'v1',
      datasetId: dataset.datasetId,
      datasetVersion: dataset.version,
      parameterSet: DEFAULT_PARAMETER_SET,
      startingCapitalMinor: 100_000n,
      period: { start: asUtcInstant('2026-01-18T00:00:00.000Z'), end: dataset.timeRange.end },
      partition: 'OUT_OF_SAMPLE_TEST',
    });
    assert.equal(train.ok && oos.ok, true);
    const walk = lab.walkForward({
      strategyId: 'str_two_etf_cash',
      version: 'v1',
      datasetId: dataset.datasetId,
      datasetVersion: dataset.version,
      parameterSet: DEFAULT_PARAMETER_SET,
      startingCapitalMinor: 100_000n,
      trainDays: 7,
      testDays: 7,
    });
    assert.equal(walk.ok, true);
    if (walk.ok) {
      assert.ok(walk.value.folds.length >= 1);
      assert.equal(walk.value.folds[0]?.configurationFrozen, true);
    }
    const grid = expandParameterGrid({ cashBps: ['1000', '2000'], cadence: ['WEEKLY'] });
    assert.equal(grid.ok, true);
    if (!grid.ok || !train.ok || !oos.ok) {
      return;
    }
    const experiment = lab.experiment({
      strategyId: 'str_two_etf_cash',
      version: 'v1',
      datasetId: dataset.datasetId,
      datasetVersion: dataset.version,
      parameterSets: grid.value,
      startingCapitalMinor: 100_000n,
      period: dataset.timeRange,
      partition: 'TRAIN',
      selectionCriteria: 'highest-train-total-return-not-unbiased',
    });
    assert.equal(experiment.ok, true);
    if (!experiment.ok) {
      return;
    }
    assert.equal(experiment.value.resultsRetained, true);
    assert.equal(experiment.value.trials.every((trial) => trial.hidden === false), true);
    assert.equal(refuseExperimentDeletion().ok, false);
    const report = lab.validate({
      strategyId: 'str_two_etf_cash',
      version: 'v1',
      train: train.value,
      outOfSample: oos.value,
      walkForward: walk.ok ? walk.value : undefined,
      experiment: experiment.value,
      snapshot: lab.emptySnapshot('inv_lab_snap01', 'cust_lab_op', 100_000n),
      benchmark: { datasetId: bench.datasetId, version: bench.version, hash: bench.hash },
      rdtState: 'SIMULATION_READY',
    });
    assert.equal(report.ok, true);
    if (report.ok) {
      assert.equal(report.value.trainUnbiasedExpectedPerformance, false);
      assert.equal(report.value.stress.length > 0, true);
      assert.ok(report.value.benchmark);
    }
    assert.equal(lab.store.listSnooping().length > 0, true);
  });

  it('warns on the overfit fixture and refuses automatic paper promotion', () => {
    const { lab, budget, actor } = harness();
    const dataset = syntheticTwoEtfDataset();
    lab.registerDataset(dataset);
    assert.equal(lab.createDraft({ specification: overfitSpec() }).ok, true);
    assert.equal(lab.compile('str_overfit_fixture', 'v-overfit', budget).ok, true);
    const train = lab.backtest({
      strategyId: 'str_overfit_fixture',
      version: 'v-overfit',
      datasetId: dataset.datasetId,
      datasetVersion: dataset.version,
      parameterSet: DEFAULT_PARAMETER_SET,
      startingCapitalMinor: 100_000n,
      period: { start: dataset.timeRange.start, end: asUtcInstant('2026-01-12T00:00:00.000Z') },
      partition: 'TRAIN',
    });
    const oos = lab.backtest({
      strategyId: 'str_overfit_fixture',
      version: 'v-overfit',
      datasetId: dataset.datasetId,
      datasetVersion: dataset.version,
      parameterSet: DEFAULT_PARAMETER_SET,
      startingCapitalMinor: 100_000n,
      period: { start: asUtcInstant('2026-01-20T00:00:00.000Z'), end: dataset.timeRange.end },
      partition: 'OUT_OF_SAMPLE_TEST',
    });
    assert.equal(train.ok && oos.ok, true);
    if (!train.ok || !oos.ok) {
      return;
    }
    const report = lab.validate({
      strategyId: 'str_overfit_fixture',
      version: 'v-overfit',
      train: train.value,
      outOfSample: oos.value,
    });
    assert.equal(report.ok, true);
    if (report.ok) {
      assert.ok(report.value.overfittingWarnings.some((row) => row.kind === 'TOO_MANY_PARAMETERS'));
      assert.equal(report.value.overfittingWarnings.every((row) => row.provesOverfitting === false), true);
    }
    assert.equal(lab.store.getStrategy('str_overfit_fixture', 'v-overfit')?.lifecycle, 'VALIDATION_FAILED');
    const paper = lab.approvePaper(actor, 'str_overfit_fixture', 'v-overfit', 'should not auto-promote');
    assert.equal(paper.ok, false);
  });

  it('requires a human ActorContext for shadow and paper and blocks Mesh self-validation', () => {
    const { lab, budget, actor } = harness();
    const dataset = syntheticTwoEtfDataset();
    lab.registerDataset(dataset);
    assert.equal(lab.createDraft({ specification: equalWeightSpec() }).ok, true);
    assert.equal(lab.compile('str_two_etf_cash', 'v1', budget).ok, true);
    const train = lab.backtest({
      strategyId: 'str_two_etf_cash',
      version: 'v1',
      datasetId: dataset.datasetId,
      datasetVersion: dataset.version,
      parameterSet: DEFAULT_PARAMETER_SET,
      startingCapitalMinor: 100_000n,
      period: { start: dataset.timeRange.start, end: asUtcInstant('2026-01-10T00:00:00.000Z') },
      partition: 'TRAIN',
    });
    const oos = lab.backtest({
      strategyId: 'str_two_etf_cash',
      version: 'v1',
      datasetId: dataset.datasetId,
      datasetVersion: dataset.version,
      parameterSet: DEFAULT_PARAMETER_SET,
      startingCapitalMinor: 100_000n,
      period: { start: asUtcInstant('2026-01-18T00:00:00.000Z'), end: dataset.timeRange.end },
      partition: 'OUT_OF_SAMPLE_TEST',
    });
    if (!train.ok || !oos.ok) {
      return;
    }
    lab.validate({
      strategyId: 'str_two_etf_cash',
      version: 'v1',
      train: train.value,
      outOfSample: oos.value,
      snapshot: lab.emptySnapshot('inv_lab_snap02', 'cust_lab_op', 100_000n),
      rdtState: 'SIMULATION_READY',
    });
    assert.equal(lab.refuseMeshSetValidation().ok, false);
    assert.equal(lab.approveShadow({ actorId: 'mesh_bot' }, 'str_two_etf_cash', 'v1', 'nope').ok, false);
    const shadow = lab.approveShadow(actor, 'str_two_etf_cash', 'v1', 'human shadow review');
    assert.equal(shadow.ok, true);
    const run = lab.startShadow('str_two_etf_cash', 'v1', dataset.datasetId, dataset.version);
    assert.equal(run.ok, true);
    if (!run.ok) {
      return;
    }
    const decision = lab.stepShadow({
      run: run.value,
      strategyId: 'str_two_etf_cash',
      version: 'v1',
      datasetId: dataset.datasetId,
      datasetVersion: dataset.version,
      at: dataset.timeRange.start,
    });
    assert.equal(decision.ok, true);
    if (decision.ok) {
      assert.equal(decision.value.brokerSubmission, false);
      assert.equal(run.value.sendsOrders, false);
    }
    assert.equal(lab.completeShadow('str_two_etf_cash', 'v1').ok, true);
    const paper = lab.approvePaper(actor, 'str_two_etf_cash', 'v1', 'human paper review');
    assert.equal(paper.ok, true);
    const paperRun = lab.startPaper({
      strategyId: 'str_two_etf_cash',
      version: 'v1',
      investmentAccountId: 'inv_lab',
    });
    assert.equal(paperRun.ok, true);
    const fills: string[] = [];
    const submitted = lab.proposePaperOrder({
      port: {
        createPaperOrder: (intent) => {
          fills.push(intent.payload.orderId);
          return { outcome: 'OK', value: { orderId: intent.payload.orderId, fillId: 'fill_lab' } };
        },
      },
      intent: {
        intentId: 'int_lab_paper',
        accountId: asAccountId('acct_lab_b'),
        investmentAccountId: 'inv_lab',
        orderId: 'ord_lab_1',
        instrumentId: SIM_ETF_1,
        side: 'BUY',
        quantityUnits: '1000000000',
        actorId: 'operator_1',
        idempotencyKey: 'ord_lab_1',
        requestedAt: NOW,
      },
      snapshot: lab.emptySnapshot('inv_lab_snap03', 'cust_lab_op', 1_000_000n),
      proposed: {
        proposalRef: 'ord_lab_1',
        instrumentId: SIM_ETF_1,
        instrumentType: 'ETF',
        currency: 'USD',
        side: 'BUY',
        quantityUnits: 1_000_000_000n,
        quantityScale: 8,
        priceMinor: 10_000n,
        notionalMinor: 100_000n,
        feeMinor: 0n,
        liquidityClass: 'HIGH',
      },
      budget,
    });
    assert.equal(submitted.ok, true);
    assert.deepEqual(fills, ['ord_lab_1']);
    lab.halt('DRAWDOWN_GUARD');
    const blocked = lab.proposePaperOrder({
      port: {
        createPaperOrder: () => {
          throw new Error('kill switch must not submit');
        },
      },
      intent: {
        intentId: 'int_lab_halted',
        accountId: asAccountId('acct_lab_b'),
        investmentAccountId: 'inv_lab',
        orderId: 'ord_lab_2',
        instrumentId: SIM_ETF_1,
        side: 'BUY',
        quantityUnits: '1000000000',
        actorId: 'operator_1',
        idempotencyKey: 'ord_lab_2',
        requestedAt: NOW,
      },
      snapshot: lab.emptySnapshot('inv_lab_snap04', 'cust_lab_op', 1_000_000n),
      proposed: {
        proposalRef: 'ord_lab_2',
        instrumentId: SIM_ETF_1,
        instrumentType: 'ETF',
        currency: 'USD',
        side: 'BUY',
        quantityUnits: 1_000_000_000n,
        quantityScale: 8,
        priceMinor: 10_000n,
        notionalMinor: 100_000n,
        feeMinor: 0n,
        liquidityClass: 'HIGH',
      },
      budget,
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.equal(blocked.error.code, 'KILL_SWITCH_ACTIVE');
    }
    assert.equal(lab.store.getStrategy('str_two_etf_cash', 'v1')?.lifecycle, 'PAPER_HALTED');
  });

  it('forbids live transitions, arbitrary code, PEVE realized backtests, and hidden costs', () => {
    assert.equal(LIVE_STRATEGY_EXECUTION, false);
    assert.equal(assertNoLiveTransition('PAPER_APPROVED', 'LIVE').ok, false);
    assert.equal(transitionStrategy('PAPER_APPROVED', 'PAPER_RUNNING').ok, true);
    const bad = validateStrategyAst({
      op: 'COMPARE',
      left: { kind: 'CLOSE', instrumentId: 'eval("boom")' },
      comparator: 'GT',
      right: { kind: 'THRESHOLD', minorUnits: 1n },
    } as never);
    assert.equal(bad.ok, false);
    assert.equal(classifyPeveStrategyValue('BACKTEST').realizedUserValue, false);
    assert.equal(classifyPeveStrategyValue('SHADOW').realization, 'COUNTERFACTUAL');
    assert.equal(classifyPeveStrategyValue('PAPER').simulation, true);
    assert.equal(refusePeveRealizedBacktest().ok, false);
    assert.equal(refuseMeshValidation().ok, false);
    const { lab } = harness();
    const hidden = lab.createDraft({
      specification: {
        ...equalWeightSpec(),
        strategyId: asStrategyId('str_hidden_cost'),
        version: asStrategyVersion('v1'),
        transactionCosts: { ...EXPLICIT_COSTS, mode: 'ZERO_COST_SIMULATION' },
      },
    });
    assert.equal(hidden.ok, false);
    const objective = lab.evaluateObjective('$1,000 to $1,300 every week.', false);
    assert.equal(objective.guaranteed, false);
    assert.equal(objective.promote, false);
    assert.equal(lab.growthGate('str_two_etf_cash', 'v1'), 'NEEDS_BACKTEST');
  });
});
