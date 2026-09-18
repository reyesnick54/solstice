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
import {
  createEconomicWorkOrderDraft,
  mandateBindingRefFromCompiled,
  workOrderIdFor,
} from '../packages/platform/src/helios/index.ts';
import { interpretMandateLanguage } from '../packages/agent/src/interpretation.ts';
import { compileEconomicMandate, mandateDraftFromInterpretation } from '../packages/platform/src/mandate/compiler.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asJurisdiction } from '../packages/domain/src/jurisdiction.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-18T09:00:00.000Z');

function activeWorkOrder(customerId: string, subjectId: string) {
  const interpretation = interpretMandateLanguage({
    subjectId,
    sourceText: 'Keep at least $2,000 liquid.',
    now: NOW,
  });
  if (!interpretation.ok) throw new Error('interpretation');
  const draft = mandateDraftFromInterpretation(interpretation.value, NOW);
  const compiled = compileEconomicMandate({ draft, now: NOW });
  if (!compiled.ok) throw new Error('compile');
  const mandate = Object.freeze({ ...compiled.value, state: 'ACTIVE' as const });
  const scope = Object.freeze({
    objectiveClasses: Object.freeze(['RESEARCH', 'FINANCIAL_PROPOSAL'] as const),
    activityClasses: Object.freeze(['RESEARCH', 'FINANCIAL_PROPOSAL'] as const),
    productClasses: Object.freeze(['CASH', 'EQUITIES', 'ETF'] as const),
    capitalCeiling: { minorUnits: '1000000', currency: 'USD' },
    accountIds: Object.freeze(['acct_h33']),
    jurisdiction: asJurisdiction('US'),
    horizonDays: 30,
    toolIds: Object.freeze(['tool_research']),
    modelIds: Object.freeze(['mdl_s3m']),
  });
  const workOrderId = workOrderIdFor(customerId, 'h33_ci');
  return Object.freeze({
    ...createEconomicWorkOrderDraft({
      workOrderId,
      customerId: asCustomerId(customerId),
      subjectId,
      growObjectiveId: 'grow_h33_ci',
      requestedScope: scope,
      mandateRef: mandateBindingRefFromCompiled(mandate, asCustomerId(customerId), NOW),
      approvalRef: null,
      requiredApprovalClass: 'NONE',
      now: NOW,
    }),
    state: 'ACTIVE' as const,
    effectiveScope: scope,
    activatedAt: NOW,
    updatedAt: NOW,
  });
}

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
    const workOrder = activeWorkOrder('cust_h33_portfolio', 'subj_h33_portfolio');
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
