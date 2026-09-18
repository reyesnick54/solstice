/**
 * HELIOS H33 — resilience/economic qualification gate.
 */

import {
  HELIOS_RESILIENCE_ECONOMIC_BLOCKED,
  HELIOS_RESILIENCE_ECONOMIC_QUALIFIED,
  type BackpressureResult,
  type CapacityInvariantResult,
  type CapacityQualificationReport,
  type CapacityQualificationResult,
  type ChaosUnderLoadResult,
  type CustomerIsolationResult,
  type EconomicCapacityFinding,
  type HeliosLoadProfileId,
  type PipelineLatencySummary,
  type PortfolioInteractionResult,
  type ResourceUtilizationSnapshot,
  type SafeOperatingEnvelope,
} from './types.ts';
import { allInvariantsPassed } from './invariants.ts';

export function deriveSafeOperatingEnvelope(input: {
  readonly profileId: HeliosLoadProfileId;
  readonly peakConcurrentResearch: number;
  readonly peakProviderRequestsPerSec: number;
  readonly peakQueueDepth: number;
  readonly failurePoint: string | null;
}): SafeOperatingEnvelope {
  const headroom = input.failurePoint != null ? 0.7 : 0.85;
  return Object.freeze({
    maxConcurrentResearchTasks: Math.max(1, Math.floor(input.peakConcurrentResearch * headroom)),
    maxProviderRequestsPerSec: Math.max(1, Math.floor(input.peakProviderRequestsPerSec * headroom)),
    maxActiveWorkOrders: Math.max(10, Math.floor(input.peakConcurrentResearch * 2 * headroom)),
    maxEventsPerSec: Math.max(5, Math.floor(input.peakProviderRequestsPerSec * 2 * headroom)),
    maxExecutionConcurrency: Math.max(2, Math.floor(input.peakConcurrentResearch * 0.5 * headroom)),
    maxConcurrentCustomers: Math.max(5, Math.floor(input.peakConcurrentResearch * headroom)),
    notes: Object.freeze([
      'Conservative sandbox bounds derived from H33 observed tests — not production limits.',
      input.failurePoint != null
        ? `Headroom reduced due to failure point: ${input.failurePoint}`
        : 'No failure point observed within profile bounds.',
      'Review required before translating to production operating limits.',
    ]),
  });
}

export function evaluateResilienceEconomicQualification(input: {
  readonly report: Omit<CapacityQualificationReport, 'marker' | 'qualified' | 'blockers'>;
  readonly invariants: readonly CapacityInvariantResult[];
  readonly portfolioInteractions: readonly PortfolioInteractionResult[];
  readonly customerIsolation: CustomerIsolationResult;
  readonly backpressure: readonly BackpressureResult[];
  readonly chaosUnderLoad: readonly ChaosUnderLoadResult[];
}): CapacityQualificationResult {
  const blockers: string[] = [];

  if (!allInvariantsPassed(input.invariants)) {
    for (const invariant of input.invariants) {
      if (!invariant.passed) blockers.push(`invariant:${invariant.name}`);
    }
  }

  for (const scenario of input.portfolioInteractions) {
    if (!scenario.passed) {
      blockers.push(`portfolio:${scenario.scenario}`);
    }
  }

  if (!input.customerIsolation.passed) {
    blockers.push('customer_isolation');
  }

  for (const queue of input.backpressure) {
    if (!queue.passed) {
      blockers.push(`backpressure:${queue.queueName}`);
    }
  }

  for (const chaos of input.chaosUnderLoad) {
    if (!chaos.passed) {
      blockers.push(`chaos:${chaos.scenario}`);
    }
  }

  const qualified = blockers.length === 0;
  const marker = qualified ? HELIOS_RESILIENCE_ECONOMIC_QUALIFIED : HELIOS_RESILIENCE_ECONOMIC_BLOCKED;

  const report: CapacityQualificationReport = Object.freeze({
    ...input.report,
    marker,
    qualified,
    blockers: Object.freeze(blockers),
  });

  return Object.freeze({
    marker,
    qualified,
    blockers: Object.freeze(blockers),
    report,
  });
}

export function defaultLimitations(profileId: HeliosLoadProfileId): readonly string[] {
  return Object.freeze([
    'Hardware-specific: results depend on CI/sandbox CPU and memory.',
    'Provider sandbox-specific: no real market depth or live liquidity.',
    'Simulated conditions: ENVIRONMENT remains simulation; LIVE_* flags false.',
    'Small sample: tail latency based on bounded synthetic traces.',
    profileId === 'SMALL'
      ? 'Untested stress zone: SMALL profile does not explore MEDIUM/LARGE_SANDBOX envelopes.'
      : 'Untested stress zone: beyond LARGE_SANDBOX may require dedicated infrastructure.',
    'Paper liquidity does not extrapolate to live liquidity.',
  ]);
}

export type HarnessMetrics = {
  readonly latency: PipelineLatencySummary;
  readonly resourceUtilization: ResourceUtilizationSnapshot;
  readonly economicFindings: readonly EconomicCapacityFinding[];
  readonly bottlenecks: readonly string[];
  readonly failurePoint: string | null;
};
