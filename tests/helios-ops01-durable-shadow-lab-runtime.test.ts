/**
 * HELIOS OPS01 — durable autonomous shadow lab runtime qualification.
 */

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_DURABLE_SHADOW_LAB_RUNTIME_V1_QUALIFIED,
  HeliosDurableShadowLabRuntimeService,
  InMemoryShadowLabDurableStore,
  buildShadowLabRuntimeHealth,
  buildShadowLabRuntimeReadiness,
  evaluateDurableShadowLabRuntimeQualification,
  runAllRestartCrashPoints,
  SHADOW_LAB_RESTART_CRASH_POINTS,
} from '../packages/platform/src/helios/autonomous-shadow-lab/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const ROOT = process.cwd();
const NOW = asUtcInstant('2026-11-09T07:30:00.000Z');
const CAMPAIGN = 'camp_ops01_qual';

describe('HELIOS OPS01 — durable shadow lab runtime', () => {
  it('architecture guard: ops01 stays inside helios boundary', () => {
    const findings = lintHeliosBoundary(ROOT).filter((row) => row.file.includes('autonomous-shadow-lab/ops01'));
    assert.equal(findings.length, 0, JSON.stringify(findings));
  });

  it('simulation posture only', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('fails closed when persistence is unavailable', async () => {
    const store = new InMemoryShadowLabDurableStore();
    store.setPersistenceUnavailable(true);
    const clock = new FrozenClock(NOW);
    const runtime = new HeliosDurableShadowLabRuntimeService({ clock, store });
    const reg = await runtime.registerCampaign({
      campaignId: CAMPAIGN,
      strategyIds: ['strat-a'],
      freezeHashes: { 'strat-a': 'freeze:a' },
    });
    assert.equal(reg, 'PERSISTENCE_UNAVAILABLE');
    const seal = await runtime.sealDecision({
      campaignId: CAMPAIGN,
      strategyId: 'strat-a',
      knowableAt: NOW,
      recordedAt: NOW,
      sequence: 0,
      previousHash: 'GENESIS',
      action: 'SHADOW_ENTER',
      fencingToken: 1,
    });
    assert.equal(seal.ok, false);
    if (!seal.ok) {
      assert.equal(seal.reason, 'PERSISTENCE_UNAVAILABLE');
    }
  });

  it('lease collision: second worker cannot commit with stale fencing token', async () => {
    const store = new InMemoryShadowLabDurableStore();
    const clock = new FrozenClock(NOW);
    const workerA = new HeliosDurableShadowLabRuntimeService({ clock, store, workerId: 'worker-a' });
    const workerB = new HeliosDurableShadowLabRuntimeService({ clock, store, workerId: 'worker-b' });
    await workerA.registerCampaign({
      campaignId: CAMPAIGN,
      strategyIds: ['strat-a'],
      freezeHashes: { 'strat-a': 'freeze:a' },
    });
    const leaseA = await workerA.acquireCampaignLease(CAMPAIGN);
    assert.equal(leaseA.ok, true);
    const leaseB = await workerB.acquireCampaignLease(CAMPAIGN);
    assert.equal(leaseB.ok, false);
    if (!leaseA.ok) {
      return;
    }
    await workerA.sealDecision({
      campaignId: CAMPAIGN,
      strategyId: 'strat-a',
      knowableAt: NOW,
      recordedAt: NOW,
      sequence: 0,
      previousHash: 'GENESIS',
      action: 'SHADOW_ENTER',
      fencingToken: leaseA.fencingToken,
    });
    const stale = await workerB.sealDecision({
      campaignId: CAMPAIGN,
      strategyId: 'strat-a',
      knowableAt: NOW,
      recordedAt: NOW,
      sequence: 1,
      previousHash: 'GENESIS',
      action: 'SHADOW_ENTER',
      fencingToken: 1,
    });
    assert.equal(stale.ok, false);
  });

  it('restart harness passes all crash points without duplicate decisions', async () => {
    const results = await runAllRestartCrashPoints({
      campaignId: 'camp_restart_harness',
      now: NOW,
      strategyIds: ['strat-a', 'strat-b'],
    });
    assert.equal(results.length, SHADOW_LAB_RESTART_CRASH_POINTS.length);
    for (const result of results) {
      assert.equal(result.duplicateDecisionIds.length, 0, result.crashPoint);
      assert.equal(result.missingEvidenceHashes.length, 0, result.crashPoint);
      assert.equal(result.financialEffectsCreated, false, result.crashPoint);
      assert.equal(result.passed, true, result.crashPoint);
    }
  });

  it('health and readiness endpoints reflect persistence and shutdown state', () => {
    const store = new InMemoryShadowLabDurableStore();
    const health = buildShadowLabRuntimeHealth({ store, activeCampaigns: 1, shuttingDown: false });
    assert.equal(health.healthy, true);
    const readiness = buildShadowLabRuntimeReadiness({ store, shuttingDown: false });
    assert.equal(readiness.ready, true);
    const shuttingDown = buildShadowLabRuntimeReadiness({ store, shuttingDown: true });
    assert.equal(shuttingDown.ready, false);
  });

  it('evaluates OPS01 qualification marker', async () => {
    const result = await evaluateDurableShadowLabRuntimeQualification({
      root: ROOT,
      gitSha: '0'.repeat(40),
      evaluatedAt: NOW,
    });
    assert.equal(result.qualified, true, result.blockers.join('; '));
    assert.equal(result.marker, HELIOS_DURABLE_SHADOW_LAB_RUNTIME_V1_QUALIFIED);
    assert.ok(existsSync(join(ROOT, 'db/customer/migrations/V072__helios_autonomous_shadow_lab_runtime.sql')));
  });
});
