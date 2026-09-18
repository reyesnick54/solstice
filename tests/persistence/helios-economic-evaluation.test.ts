/**
 * Persistence — HELIOS H32 economic evaluation durable records.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../packages/config/src/clock.ts';
import { asCustomerId } from '../../packages/domain/src/customer.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import {
  evaluationMoney,
  HeliosEconomicEvaluationService,
  MICROCAPITAL_DEFAULTS,
} from '../../packages/platform/src/helios/economic-evaluation/index.ts';
import {
  loadHeliosEconomicEvaluationState,
  persistHeliosEconomicEvaluationState,
} from '../../packages/persistence/src/index.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './helpers.ts';

const describePersistence = persistenceAvailable() ? describe : describe.skip;
const NOW = asUtcInstant('2026-09-18T10:00:00.000Z');

describePersistence('HELIOS H32 persistence', () => {
  it('persists experiments, failed runs, and reports append-only', async () => {
    const env = await preparePersistence();
    const durable = await createDurableRuntime(env);
    const pool = durable.session.pools.customer;
    const clock = new FrozenClock(NOW);
    const service = new HeliosEconomicEvaluationService({ clock });
    const experiment = service.createExperiment({
      hypothesis: 'persistence smoke',
      modelVersions: Object.freeze(['s3m-v1']),
      policyVersions: Object.freeze(['p1']),
      datasetRef: 'ds1',
      forwardStart: NOW,
      forwardEnd: asUtcInstant('2027-09-18T10:00:00.000Z'),
      capitalMinor: MICROCAPITAL_DEFAULTS.startingCapitalMinor,
      currency: 'USD',
      researchBudgetMinor: '1000',
      riskLimits: Object.freeze({
        maxLeverageNumerator: 1,
        maxLeverageDenominator: 1,
        maxConcentrationBps: 2500,
        allowedAssetClasses: Object.freeze(['ETF']),
        maxDrawdownBps: 2000,
        complianceProfile: 'simulation-paper',
      }),
      executionAssumptions: Object.freeze({
        mode: 'PAPER' as const,
        spreadBps: 5,
        slippageBps: 8,
        commissionMinorPerTrade: '25',
        fundingCostBpsAnnual: 300,
        dataCostMinor: '100',
      }),
      benchmarkKind: 'CASH_NO_ACTION',
      benchmarkMethodology: 'cash',
      costTreatment: 'full',
      successCriteria: Object.freeze({
        minNetResultMinor: null,
        maxDrawdownBps: null,
        beatBenchmarkBps: null,
        minDecisions: null,
      }),
      failureCriteria: Object.freeze([]),
      customerId: asCustomerId('cust_h32_persist'),
      now: NOW,
    });
    service.startExperiment(experiment.experimentId);
    service.createMicrocapitalChallenge({ experimentId: experiment.experimentId });
    service.recordRun({
      experimentId: experiment.experimentId,
      customerId: experiment.customerId,
      startCapital: evaluationMoney('5000', 'USD'),
      grossResultMinor: '100',
      commissionsMinor: '10',
      spreadCostMinor: '5',
      slippageCostMinor: '5',
      fundingCostMinor: '0',
      dataCostMinor: '0',
      researchCostMinor: '20',
      unrealizedMinor: '0',
      realizedMinor: '60',
      cashMinor: '5060',
      maxDrawdownBps: 100,
      outcome: 'FAILED',
    });
    service.generateReport({
      experiment: service.store.getExperiment(experiment.experimentId)!,
      microcapitalChallenge: Object.values(service.store.snapshot().challenges)[0] ?? null,
      runs: service.store.listRuns(experiment.experimentId),
      researchCosts: [],
      benchmarkNetMinor: '0',
    });

    await persistHeliosEconomicEvaluationState(pool, service.store.snapshot());
    const loaded = await loadHeliosEconomicEvaluationState(pool);
    assert.equal(Object.keys(loaded.experiments).length, 1);
    assert.equal(loaded.runs.length, 1);
    assert.equal(loaded.runs[0]?.outcome, 'FAILED');
    assert.equal(loaded.reports.length, 1);
    assert.equal(loaded.reports[0]?.PERFORMANCE_CLAIM_ALLOWED, false);
  });
});
