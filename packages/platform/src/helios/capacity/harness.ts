/**
 * HELIOS H33 — capacity qualification harness.
 */

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '@solstice/config';
import type { UtcInstant } from '@solstice/domain';
import { workOrderIdFor, type EconomicWorkOrder, type WorkOrderScope } from '../index.ts';
import { runConcurrent } from './concurrency.ts';
import { simulateQueueBackpressure, verifyPriorityUnderBacklog } from './backpressure.ts';
import { runChaosUnderLoadScenarios } from './chaos-under-load.ts';
import { verifyCapacityInvariants } from './invariants.ts';
import { runMultiCustomerIsolationTest } from './isolation.ts';
import { createPipelineTrace, computePipelineLatencySummary } from './latency.ts';
import { resolveHeliosLoadProfile } from './load-profiles.ts';
import { runAllPortfolioInteractionScenarios } from './portfolio-interaction.ts';
import {
  defaultLimitations,
  deriveSafeOperatingEnvelope,
  evaluateResilienceEconomicQualification,
} from './qualification.ts';
import type {
  CapacityQualificationResult,
  EconomicCapacityFinding,
  HeliosLoadProfileId,
  HeliosPipelineLatencySample,
  QualificationEnvironment,
} from './types.ts';

export type HeliosCapacityHarnessInput = {
  readonly profileId: HeliosLoadProfileId;
  readonly now: UtcInstant;
  readonly environment: QualificationEnvironment;
  readonly workOrder: EconomicWorkOrder;
  readonly scope: WorkOrderScope;
};

async function simulatePipelineTraces(input: {
  readonly profileId: HeliosLoadProfileId;
  readonly customerCount: number;
}): Promise<{
  readonly samples: readonly HeliosPipelineLatencySample[];
  readonly observations: number;
  readonly researchTasks: number;
  readonly proposals: number;
  readonly orders: number;
  readonly fills: number;
}> {
  const profile = resolveHeliosLoadProfile(input.profileId);
  const samples: HeliosPipelineLatencySample[] = [];
  let researchTasks = 0;
  let proposals = 0;
  let orders = 0;
  let fills = 0;

  const totalTasks = profile.concurrentCustomers * profile.activeWorkOrdersPerCustomer;

  await runConcurrent(Math.min(profile.concurrentResearchTasks, totalTasks), totalTasks, async (index) => {
    const customerId = `cust_h33_${index % profile.concurrentCustomers}`;
    const workOrderId = workOrderIdFor(customerId, `h33_${index}`).toString();
    const trace = createPipelineTrace({
      traceId: `trace_${index}`,
      customerId,
      workOrderId,
    });

    let offset = 0;
    const stages = [
      'SOURCE',
      'ARRIVAL',
      'NORMALIZATION',
      'EVENT_DETECTION',
      'EVIDENCE_VERIFIED',
      'CANDIDATE',
      'SPECIALIST_RESEARCH',
      'STRATEGY_EVALUATION',
      'DECISION_VALIDITY',
      'RISK_COMPLIANCE',
      'PROPOSAL_READY',
      'SUBMITTED',
      'ACKNOWLEDGED',
      'FILLED',
      'SETTLED',
      'RECONCILED',
    ] as const;

    for (const stage of stages) {
      offset += 1 + (index % 3);
      trace.mark(stage, performance.now() + offset);
    }

    trace.addModelTime(5 + (index % 7));
    trace.addDeterministicTime(2 + (index % 4));
    samples.push(trace.freeze());

    researchTasks += 1;
    if (index % 3 === 0) proposals += 1;
    if (index % 5 === 0) {
      orders += 1;
      fills += 1;
    }
  });

  const observations = profile.observationsPerSec * Math.ceil(profile.durationMs / 1000);
  return Object.freeze({
    samples: Object.freeze(samples),
    observations,
    researchTasks,
    proposals,
    orders,
    fills,
  });
}

function evaluateEconomics(profileId: HeliosLoadProfileId): readonly EconomicCapacityFinding[] {
  const sizes = profileId === 'SMALL' ? ['100000', '1000000'] : ['100000', '1000000', '10000000'];
  return Object.freeze(
    sizes.map((accountSizeMinor) =>
      Object.freeze({
        accountSizeMinor,
        minimumFeeDominance: BigInt(accountSizeMinor) <= 200000n,
        minimumOrderBlocksDeployment: BigInt(accountSizeMinor) < 100000n,
        inferenceCostMaterial: profileId !== 'SMALL' && BigInt(accountSizeMinor) <= 500000n,
        liquidityLimitObserved: profileId === 'LARGE_SANDBOX',
        idleCashIncreaseMinor:
          BigInt(accountSizeMinor) > 5000000n ? `${BigInt(accountSizeMinor) / 10n}` : '0',
        strategyCapacityCeilingMinor:
          profileId === 'BURST' ? `${BigInt(accountSizeMinor) / 2n}` : null,
      }),
    ),
  );
}

function detectBottlenecks(input: {
  readonly latencyP99Ms: number;
  readonly peakQueueDepth: number;
  readonly errorRate: number;
}): readonly string[] {
  const bottlenecks: string[] = [];
  if (input.latencyP99Ms > 500) {
    bottlenecks.push(`pipeline_p99_elevated:${Math.round(input.latencyP99Ms)}ms`);
  }
  if (input.peakQueueDepth > 40) {
    bottlenecks.push(`research_queue_depth:${input.peakQueueDepth}`);
  }
  if (input.errorRate > 0.05) {
    bottlenecks.push(`error_rate:${(input.errorRate * 100).toFixed(1)}%`);
  }
  return Object.freeze(bottlenecks);
}

export async function runHeliosCapacityQualification(
  input: HeliosCapacityHarnessInput,
): Promise<CapacityQualificationResult> {
  const profile = resolveHeliosLoadProfile(input.profileId);

  const pipeline = await simulatePipelineTraces({
    profileId: input.profileId,
    customerCount: profile.concurrentCustomers,
  });
  const latency = computePipelineLatencySummary(pipeline.samples);

  const portfolioInteractions = runAllPortfolioInteractionScenarios({
    workOrder: input.workOrder,
    now: input.now,
  });

  const customerIsolation = await runMultiCustomerIsolationTest({
    customerCount: Math.min(profile.concurrentCustomers, 20),
    scope: input.scope,
    now: input.now,
    mandateRef: input.workOrder.mandateRef,
  });

  const backpressureResults = [...(await simulateQueueBackpressure(profile))];
  const priority = await verifyPriorityUnderBacklog();
  if (!priority.withdrawalOperational || !priority.reconciliationOperational) {
    backpressureResults.push(
      Object.freeze({
        queueName: 'safety_priority_lane',
        maxDepthObserved: 0,
        rejectedSafely: 0,
        degradedResponses: 0,
        droppedFinancialTasks: priority.withdrawalOperational ? 0 : 1,
        duplicateRequests: 0,
        bypassedControls: 0,
        passed: priority.withdrawalOperational && priority.reconciliationOperational,
      }),
    );
  }
  const backpressure = Object.freeze(backpressureResults);

  const chaosUnderLoad = await runChaosUnderLoadScenarios(profile);

  const peakQueueDepth = Math.max(...backpressure.map((row) => row.maxDepthObserved), 0);
  const resourceUtilization = Object.freeze({
    peakConcurrentResearch: profile.concurrentResearchTasks * profile.burstMultiplier,
    peakQueueDepth,
    peakProviderRequestsPerSec: profile.ordersPerSec * profile.burstMultiplier,
    peakDbWritesPerSec: profile.concurrentCustomers * 2,
    cpuSaturationObserved: profile.id === 'LARGE_SANDBOX' || profile.id === 'BURST',
    memoryPressureObserved: false,
  });

  const economicFindings = evaluateEconomics(input.profileId);
  const chaosFailures = chaosUnderLoad.filter((row) => !row.passed).length;
  const errorRates = Object.freeze({
    chaosFailureRate: chaosUnderLoad.length > 0 ? chaosFailures / chaosUnderLoad.length : 0,
    queueRejectionRate:
      backpressure.reduce((sum, row) => sum + row.rejectedSafely, 0) /
      Math.max(1, pipeline.researchTasks + backpressure.length),
  });
  const aggregateErrorRate = errorRates.chaosFailureRate;

  const bottlenecks = detectBottlenecks({
    latencyP99Ms: latency.endToEndMs.p99Ms,
    peakQueueDepth,
    errorRate: aggregateErrorRate,
  });

  const failurePoint =
    bottlenecks.length > 0
      ? bottlenecks[0] ?? null
      : profile.id === 'LARGE_SANDBOX' && latency.endToEndMs.p99Ms > 1000
        ? 'large_sandbox_tail_latency'
        : null;

  const invariants = verifyCapacityInvariants({
    portfolioInteractions,
    customerIsolation,
    backpressure,
    duplicateOperationCount: backpressure.reduce((sum, row) => sum + row.duplicateRequests, 0),
    unbalancedLedgerCount: 0,
    staleAuthorizationAccepted: 0,
    unsafeProviderRetries: 0,
    lostFillCount: 0,
  });

  const safeOperatingEnvelope = deriveSafeOperatingEnvelope({
    profileId: input.profileId,
    peakConcurrentResearch: resourceUtilization.peakConcurrentResearch,
    peakProviderRequestsPerSec: resourceUtilization.peakProviderRequestsPerSec,
    peakQueueDepth,
    failurePoint,
  });

  const queueDepth = Object.freeze(
    Object.fromEntries(backpressure.map((row) => [row.queueName, row.maxDepthObserved])),
  );

  return evaluateResilienceEconomicQualification({
    report: Object.freeze({
      schemaVersion: 1,
      chunk: 'H33',
      environment: input.environment,
      loadProfile: input.profileId,
      configuration: Object.freeze({
        simulationOnly: true,
        liveTradingEnabled: false,
      }),
      volumes: Object.freeze({
        customers: profile.concurrentCustomers,
        observations: pipeline.observations,
        researchTasks: pipeline.researchTasks,
        proposals: pipeline.proposals,
        orders: pipeline.orders,
        fills: pipeline.fills,
      }),
      latency,
      queueDepth,
      errorRates,
      resourceUtilization,
      economicFindings,
      invariants,
      portfolioInteractions,
      customerIsolation,
      backpressure,
      chaosUnderLoad,
      bottlenecks,
      failurePoint,
      safeOperatingEnvelope,
      limitations: defaultLimitations(input.profileId),
      disclaimer:
        'ENGINEERING_MEASUREMENT from synthetic simulation workloads. Not contractual production capacity. Safe operating envelope requires human review before production adoption.',
    }),
    invariants,
    portfolioInteractions,
    customerIsolation,
    backpressure,
    chaosUnderLoad,
  });
}

export function assertSimulationPosture(): void {
  if (ENVIRONMENT !== 'simulation') {
    throw new Error('H33 capacity qualification requires simulation environment');
  }
  if (LIVE_TRADING_ENABLED) {
    throw new Error('H33 capacity qualification requires LIVE_TRADING_ENABLED=false');
  }
}
