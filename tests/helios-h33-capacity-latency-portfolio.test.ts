/**
 * HELIOS H33 — lightweight capacity/latency/portfolio regression (CI-bounded).
 * Full capacity qualification: npm run helios:capacity:qualify
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_H33_CAPACITY_LATENCY_PORTFOLIO,
  HELIOS_LOAD_PROFILES,
  HELIOS_RESILIENCE_ECONOMIC_QUALIFIED,
  HELIOS_RESILIENCE_ECONOMIC_BLOCKED,
  computePipelineLatencySummary,
  createPipelineTrace,
  resolveHeliosLoadProfile,
  runHeliosCapacityQualification,
  runTripleStrategyCapitalRace,
  toLatencyDistribution,
} from '../packages/platform/src/helios/capacity/index.ts';
import { heliosH33ActiveWorkOrder, heliosH33BaseScope } from '../performance/helios/fixtures.ts';
import { captureEnvironment } from '../performance/lib/env-metadata.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-18T09:00:00.000Z');

describe('HELIOS H33 capacity, latency, and portfolio interactions', () => {
  it('architecture guard: capacity module stays within HELIOS boundary', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const capacityFindings = findings.filter((row) => row.file.includes('helios/capacity'));
    assert.equal(capacityFindings.length, 0, capacityFindings.map((row) => row.message).join('; '));
  });

  it('simulation posture unchanged', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('load profiles are parameterized and bounded', () => {
    assert.ok(HELIOS_LOAD_PROFILES.SMALL.concurrentCustomers === 10);
    assert.ok(HELIOS_LOAD_PROFILES.MEDIUM.concurrentCustomers === 100);
    assert.ok(HELIOS_LOAD_PROFILES.LARGE_SANDBOX.concurrentCustomers <= 300);
    assert.ok(HELIOS_LOAD_PROFILES.BURST.burstMultiplier >= 1);
  });

  it('latency instrumentation preserves tail percentiles', () => {
    const trace = createPipelineTrace({
      traceId: 't1',
      customerId: 'cust_1',
      workOrderId: 'ewo_1',
      baseTimeMs: 1000,
    });
    trace.mark('SOURCE', 1000);
    trace.mark('CANDIDATE', 1010);
    trace.mark('PROPOSAL_READY', 1050);
    trace.mark('RECONCILED', 1200);
    trace.addModelTime(30);
    trace.addDeterministicTime(10);
    const summary = computePipelineLatencySummary([trace.freeze()]);
    assert.ok(summary.discovery.sourceToVerifiedCandidateMs.count >= 1);
    assert.ok(summary.decision.modelTimeMs.p50Ms >= 30);
    assert.ok(summary.endToEndMs.maxMs >= summary.endToEndMs.p50Ms);
    const dist = toLatencyDistribution([1, 2, 3, 100, 200]);
    assert.ok(dist.p99Ms >= dist.p90Ms);
    assert.ok(dist.maxMs >= dist.p99Ms);
  });

  it('portfolio concurrency: $10,000 available, three $5,000 strategies do not deploy $15,000', () => {
    const workOrder = heliosH33ActiveWorkOrder('cust_h33_portfolio', 'subj_h33_portfolio', NOW, 'h33_ci');
    const result = runTripleStrategyCapitalRace({
      workOrder,
      availableMinor: '1000000',
      perStrategyMinor: '500000',
      liquidityRequirementMinor: '200000',
      now: NOW,
    });
    assert.equal(result.passed, true, result.blockers.join('; '));
    assert.ok(BigInt(result.totalClaimedMinor) <= 1000000n);
  });

  it('SMALL profile lightweight qualification regression', async () => {
    const clock = new FrozenClock(NOW);
    const result = await runHeliosCapacityQualification({
      profileId: 'SMALL',
      now: clock.now(),
      environment: captureEnvironment({
        databaseMode: 'in-process',
        networkMode: 'in-process',
        benchmarkTool: 'helios-h33-regression',
        benchmarkToolVersion: 'h33-v1',
      }),
      workOrder: heliosH33ActiveWorkOrder('cust_h33_main', 'subj_h33_main', clock.now()),
      scope: heliosH33BaseScope(),
    });
    assert.ok(
      result.marker === HELIOS_RESILIENCE_ECONOMIC_QUALIFIED ||
        result.marker === HELIOS_RESILIENCE_ECONOMIC_BLOCKED,
    );
    assert.equal(result.report.loadProfile, 'SMALL');
    assert.equal(result.report.configuration.simulationOnly, true);
    assert.ok(result.report.invariants.length > 0);
    assert.ok(result.report.latency.discovery.sampleCount >= 0);
    assert.ok(result.report.safeOperatingEnvelope.maxConcurrentResearchTasks >= 1);
    assert.equal(result.qualified, true, result.blockers.join('; '));
  });

  it('chunk marker exported', () => {
    assert.equal(HELIOS_H33_CAPACITY_LATENCY_PORTFOLIO, 'HELIOS_H33_CAPACITY_LATENCY_PORTFOLIO');
    assert.equal(resolveHeliosLoadProfile('SMALL').id, 'SMALL');
  });
});
