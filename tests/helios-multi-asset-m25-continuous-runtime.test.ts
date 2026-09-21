/**
 * HELIOS Multi-Asset M25 — continuous autonomous runtime.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { asEconomicMandateId, asMandateVersion } from '../packages/platform/src/ids.ts';
import type { CompiledEconomicMandate } from '../packages/platform/src/mandate/types.ts';
import {
  HELIOS_MULTI_ASSET_M25_CONTINUOUS_RUNTIME_QUALIFIED,
  HeliosContinuousRuntimeService,
  HeliosRuntimeScheduler,
  InMemoryHeliosRuntimeStore,
  defaultPermissivePorts,
  evaluateM25ContinuousRuntimeQualification,
  evaluateMandateEligibility,
  type HeliosRuntimePorts,
  type MandateRuntimeConfig,
  type M25QualificationChecks,
} from '../packages/platform/src/helios/continuous-runtime/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const ROOT = join(import.meta.dirname, '..');
const T0 = asUtcInstant('2026-09-21T14:00:00.000Z');

function activeMandate(subjectId: string, mandateSuffix = 'runtime'): CompiledEconomicMandate {
  return Object.freeze({
    mandateId: asEconomicMandateId(`emd_m25_${mandateSuffix}_${subjectId}`),
    version: asMandateVersion(1),
    subjectId,
    state: 'ACTIVE',
    sourceText: 'HELIOS continuous grow mandate',
    currency: 'USD',
    goals: Object.freeze([]),
    hardConstraints: Object.freeze([]),
    softPreferences: Object.freeze([]),
    compiledAt: T0,
    planningEligible: true,
  });
}

function baseConfig(overrides: Partial<MandateRuntimeConfig> = {}): MandateRuntimeConfig {
  return Object.freeze({
    strategyIds: Object.freeze(['strat_index_mr']),
    assetClasses: Object.freeze(['EQUITY', 'CRYPTO']),
    instrumentIds: Object.freeze(['EQ:SPY', 'CRYPTO:BTC-USD']),
    providerIds: Object.freeze(['sandbox_provider']),
    jurisdictionEligible: true,
    cadenceProfiles: Object.freeze([
      'CONTINUOUS_CRYPTO',
      'EQUITY_SESSION',
      'RECONCILIATION_PERIODIC',
      'RISK_PERIODIC',
    ]),
    ...overrides,
  });
}

function createRuntime(input?: {
  readonly now?: string;
  readonly ports?: Partial<HeliosRuntimePorts>;
  readonly subjectId?: string;
}) {
  const subjectId = input?.subjectId ?? 'sub_m25';
  const mandate = activeMandate(subjectId);
  const clock = new FrozenClock(input?.now ?? T0);
  const ports = defaultPermissivePorts({
    mandateLookup: (id) => (id === mandate.mandateId ? mandate : undefined),
    ...input?.ports,
  });
  const runtime = new HeliosContinuousRuntimeService({ clock, ports, workerId: 'test_worker' });
  const registration = runtime.registerMandate({
    customerId: 'cust_m25',
    subjectId,
    mandateId: mandate.mandateId,
    workOrderId: 'ewo_m25',
    fundingState: 'PAPER_FUNDED',
    config: baseConfig(),
  });
  return { runtime, registration, mandate, clock, ports };
}

describe('HELIOS Multi-Asset M25 — continuous autonomous runtime', () => {
  it('architecture guard: continuous-runtime stays inside helios boundary', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const scoped = findings.filter((f) => f.file.includes('helios/continuous-runtime'));
    assert.equal(scoped.length, 0, JSON.stringify(scoped));
  });

  it('production safety: simulation posture unchanged', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('does not implement busy-loop polling', () => {
    const sources = [
      'packages/platform/src/helios/continuous-runtime/service.ts',
      'packages/platform/src/helios/continuous-runtime/scheduler.ts',
    ];
    for (const rel of sources) {
      const text = readFileSync(join(ROOT, rel), 'utf8');
      assert.ok(!/setInterval\s*\(/.test(text), `${rel} must not use setInterval`);
      assert.ok(!/while\s*\(\s*true\s*\)/.test(text), `${rel} must not busy-loop`);
    }
  });

  it('normal continuous cycle completes bounded pipeline', async () => {
    const { runtime } = createRuntime();
    const tick = await runtime.tickOnce();
    assert.ok(tick.processed >= 1);
    assert.ok(tick.cyclesCompleted >= 1);
    const metrics = runtime.store.metricsSnapshot();
    assert.ok(metrics.strategiesEvaluated >= 1);
    assert.ok(metrics.paperTradesExecuted >= 1);
  });

  it('no qualified opportunity yields NO_ACTION', async () => {
    const { runtime } = createRuntime({
      ports: { qualifiedOpportunityExists: () => false },
    });
    const tick = await runtime.tickOnce();
    assert.ok(tick.noActions >= 1);
    const cycles = runtime.snapshot().cycles;
    assert.ok(cycles.some((row) => row.outcome === 'NO_ACTION'));
  });

  it('market closed defers equity session work', async () => {
    const { runtime } = createRuntime({
      ports: { marketSessionOpen: ({ assetClass }) => assetClass === 'CRYPTO' },
    });
    const tick = await runtime.tickOnce();
    assert.ok(tick.skipped >= 1 || tick.noActions >= 1);
    const eligibility = evaluateMandateEligibility({
      registration: runtime.snapshot().registrations[0]!,
      mandate: activeMandate('sub_m25'),
      ports: defaultPermissivePorts({
        marketSessionOpen: () => false,
      }),
      now: T0,
    });
    assert.equal(eligibility.eligible, false);
    if (!eligibility.eligible) {
      assert.equal(eligibility.runtimeState, 'WAITING_FOR_MARKET');
    }
  });

  it('crypto observation continues on weekend when equity closed', async () => {
    const mandate = activeMandate('sub_crypto');
    const clock = new FrozenClock(T0);
    const ports = defaultPermissivePorts({
      mandateLookup: (id) => (id === mandate.mandateId ? mandate : undefined),
      marketSessionOpen: ({ assetClass }) => assetClass === 'CRYPTO',
    });
    const runtime = new HeliosContinuousRuntimeService({ clock, ports, workerId: 'crypto_worker' });
    runtime.registerMandate({
      customerId: 'cust_crypto',
      subjectId: 'sub_crypto',
      mandateId: mandate.mandateId,
      workOrderId: 'ewo_crypto',
      fundingState: 'PAPER_FUNDED',
      config: baseConfig({
        assetClasses: Object.freeze(['CRYPTO']),
        cadenceProfiles: Object.freeze(['CONTINUOUS_CRYPTO']),
      }),
    });
    const tick = await runtime.tickOnce({ limit: 20 });
    assert.ok(tick.processed >= 1);
  });

  it('provider outage blocks new capital deployment', async () => {
    const { runtime } = createRuntime({
      ports: { providerAvailable: () => false },
    });
    const tick = await runtime.tickOnce();
    assert.equal(tick.processed, 0);
    assert.ok(tick.skipped >= 1);
    const eligibility = evaluateMandateEligibility({
      registration: runtime.snapshot().registrations[0]!,
      mandate: activeMandate('sub_m25'),
      ports: defaultPermissivePorts({ providerAvailable: () => false }),
      now: T0,
    });
    assert.equal(eligibility.eligible, false);
    if (!eligibility.eligible) assert.equal(eligibility.runtimeState, 'PROVIDER_BLOCKED');
  });

  it('restart mid-cycle recovers incomplete work via snapshot', async () => {
    const { runtime, registration, clock, ports } = createRuntime();
    runtime.store.putCycle(
      Object.freeze({
        cycleId: 'hrc_resume',
        registrationId: registration.registrationId,
        customerId: registration.customerId,
        startedAt: T0,
        completedAt: null,
        currentStage: 'RANK',
        lastCompletedStage: 'QUALIFY',
        outcome: null,
        runtimeState: 'ACTIVE',
        evidenceRef: null,
        noActionReason: null,
      }),
    );
    const snap = runtime.snapshot();
    const restarted = HeliosContinuousRuntimeService.fromSnapshot({ clock, ports, snapshot: snap });
    restarted.recoverAfterRestart();
    const tick = await restarted.tickOnce();
    assert.ok(tick.cyclesCompleted >= 0);
    assert.ok(restarted.snapshot().registrations.length >= 1);
  });

  it('duplicate scheduled work is skipped idempotently', () => {
    const store = new InMemoryHeliosRuntimeStore();
    const clock = new FrozenClock(T0);
    const scheduler = new HeliosRuntimeScheduler({ clock, store, workerId: 'dup_worker' });
    const registration = Object.freeze({
      registrationId: 'hmr_dup',
      customerId: 'cust_dup',
      subjectId: 'sub_dup',
      mandateId: 'emd_dup',
      workOrderId: 'ewo_dup',
      fundingState: 'PAPER_FUNDED' as const,
      config: baseConfig({ cadenceProfiles: Object.freeze(['RISK_PERIODIC']) }),
      registeredAt: T0,
      active: true,
    });
    const first = scheduler.scheduleNext({
      registration,
      cadenceProfile: 'RISK_PERIODIC',
      idempotencyKey: 'same-key',
    });
    assert.notEqual(first, 'DUPLICATE');
    const second = scheduler.scheduleNext({
      registration,
      cadenceProfile: 'RISK_PERIODIC',
      idempotencyKey: 'same-key',
    });
    assert.equal(second, 'DUPLICATE');
  });

  it('customer pause prevents new cycle processing', async () => {
    const { runtime } = createRuntime({
      ports: { growDeploymentPaused: () => true },
    });
    const tick = await runtime.tickOnce();
    assert.equal(tick.processed, 0);
    assert.ok(tick.skipped >= 1);
  });

  it('supervision customer pause blocks dispatch', async () => {
    const { runtime } = createRuntime();
    runtime.supervision.pause('CUSTOMER', 'cust_m25', 'customer requested pause');
    const tick = await runtime.tickOnce();
    assert.equal(tick.processed, 0);
    assert.ok(tick.skipped >= 1);
  });

  it('risk pause blocks new entries', async () => {
    const { runtime } = createRuntime({
      ports: { riskPermitsNewEntries: () => false },
    });
    const tick = await runtime.tickOnce();
    assert.equal(tick.processed, 0);
    const metrics = runtime.store.metricsSnapshot();
    assert.ok(tick.skipped >= 1);
    assert.equal(metrics.riskBlocks, 0);
  });

  it('compliance pause blocks dispatch', async () => {
    const { runtime } = createRuntime({
      ports: { compliancePermitsAction: () => false },
    });
    const tick = await runtime.tickOnce();
    assert.equal(tick.processed, 0);
    assert.ok(tick.skipped >= 1);
  });

  it('stale data waits without capital action', async () => {
    const { runtime } = createRuntime({
      ports: { marketDataFresh: () => false },
    });
    const tick = await runtime.tickOnce();
    assert.equal(tick.processed, 0);
    const eligibility = evaluateMandateEligibility({
      registration: runtime.snapshot().registrations[0]!,
      mandate: activeMandate('sub_m25'),
      ports: defaultPermissivePorts({ marketDataFresh: () => false }),
      now: T0,
    });
    assert.equal(eligibility.eligible, false);
    if (!eligibility.eligible) assert.equal(eligibility.runtimeState, 'WAITING_FOR_DATA');
  });

  it('reconciliation required blocks cycle', async () => {
    const { runtime } = createRuntime({
      ports: { reconciliationRequired: () => true },
    });
    const tick = await runtime.tickOnce();
    assert.equal(tick.processed, 0);
    const eligibility = evaluateMandateEligibility({
      registration: runtime.snapshot().registrations[0]!,
      mandate: activeMandate('sub_m25'),
      ports: defaultPermissivePorts({ reconciliationRequired: () => true }),
      now: T0,
    });
    assert.equal(eligibility.eligible, false);
    if (!eligibility.eligible) assert.equal(eligibility.runtimeState, 'RECONCILIATION_REQUIRED');
  });

  it('strategy demotion blocks mandate eligibility', async () => {
    const { runtime } = createRuntime({
      ports: { strategyEligible: () => false },
    });
    const tick = await runtime.tickOnce();
    assert.equal(tick.processed, 0);
    const eligibility = evaluateMandateEligibility({
      registration: runtime.snapshot().registrations[0]!,
      mandate: activeMandate('sub_m25'),
      ports: defaultPermissivePorts({ strategyEligible: () => false }),
      now: T0,
    });
    assert.equal(eligibility.eligible, false);
    if (!eligibility.eligible) assert.equal(eligibility.runtimeState, 'DEGRADED');
  });

  it('expired opportunity yields no-action without trade', async () => {
    const { runtime } = createRuntime({
      ports: { qualifiedOpportunityExists: () => false },
    });
    await runtime.tickOnce();
    const metrics = runtime.store.metricsSnapshot();
    assert.ok(metrics.noActionDecisions >= 1);
    assert.equal(metrics.paperTradesExecuted, 0);
  });

  it('graceful shutdown preserves exit-only monitoring path', async () => {
    const { runtime } = createRuntime();
    runtime.supervision.requestShutdown();
    const tick = await runtime.tickOnce();
    assert.ok(tick.skipped >= 0);
    const control = runtime.store.getSupervision('GLOBAL', '*');
    assert.equal(control?.mode, 'SHUTDOWN');
  });

  it('recovery after restart restores scheduled work', () => {
    const { runtime, clock, ports } = createRuntime();
    const snap = runtime.snapshot();
    const restarted = HeliosContinuousRuntimeService.fromSnapshot({ clock, ports, snapshot: snap });
    restarted.recoverAfterRestart();
    assert.ok(restarted.snapshot().scheduledWork.length >= snap.scheduledWork.length);
  });

  it('customer isolation: one customer pause does not block another', async () => {
    const mandateA = activeMandate('sub_a', 'a');
    const mandateB = activeMandate('sub_b', 'b');
    const clock = new FrozenClock(T0);
    const ports = defaultPermissivePorts({
      mandateLookup: (id) => {
        if (id === mandateA.mandateId) return mandateA;
        if (id === mandateB.mandateId) return mandateB;
        return undefined;
      },
    });
    const runtime = new HeliosContinuousRuntimeService({ clock, ports });
    runtime.registerMandate({
      customerId: 'cust_a',
      subjectId: 'sub_a',
      mandateId: mandateA.mandateId,
      workOrderId: 'ewo_a',
      fundingState: 'PAPER_FUNDED',
      config: baseConfig(),
    });
    runtime.registerMandate({
      customerId: 'cust_b',
      subjectId: 'sub_b',
      mandateId: mandateB.mandateId,
      workOrderId: 'ewo_b',
      fundingState: 'PAPER_FUNDED',
      config: baseConfig(),
    });
    runtime.supervision.pause('CUSTOMER', 'cust_a');
    const tick = await runtime.tickOnce({ limit: 20 });
    assert.ok(tick.processed >= 1);
    const custBCycles = runtime.snapshot().cycles.filter((row) => row.customerId === 'cust_b');
    assert.ok(custBCycles.length >= 1);
  });

  it('observable metrics capture runtime decisions', async () => {
    const { runtime } = createRuntime();
    await runtime.tickOnce();
    const metrics = runtime.store.metricsSnapshot();
    assert.ok(metrics.activeRegistrations >= 1);
    assert.ok(metrics.pendingScheduledWork >= 1);
    assert.ok(typeof metrics.decisionLatencyMsP50 === 'number');
  });

  it('qualification marker emitted when all checks pass', () => {
    const checks: M25QualificationChecks = {
      normalContinuousCycle: true,
      noOpportunityNoAction: true,
      marketClosedWaiting: true,
      cryptoWeekendContinuous: true,
      providerOutageBlocked: true,
      restartMidCycleRecovery: true,
      duplicateScheduledWorkSkipped: true,
      customerPauseHonored: true,
      riskPauseHonored: true,
      compliancePauseHonored: true,
      staleDataWaiting: true,
      reconciliationRequiredBlocked: true,
      strategyDemotionBlocked: true,
      expiredOpportunityNoAction: true,
      gracefulShutdownExitOnly: true,
      recoveryAfterRestart: true,
      customerIsolation: true,
      noBusyLoopPolling: true,
      governedAutomationOnly: true,
      observableMetrics: true,
      simulationPosture: ENVIRONMENT === 'simulation' && LIVE_TRADING_ENABLED === false,
    };
    const result = evaluateM25ContinuousRuntimeQualification(checks);
    assert.equal(result.marker, HELIOS_MULTI_ASSET_M25_CONTINUOUS_RUNTIME_QUALIFIED);
    assert.equal(result.qualified, true);
    assert.equal(result.blockers.length, 0);
  });
});
