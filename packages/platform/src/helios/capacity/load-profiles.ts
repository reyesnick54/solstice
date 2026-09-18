/**
 * HELIOS H33 — parameterized load profiles.
 * Targets are bounded to available sandbox infrastructure — not hard-coded enormous values.
 */

import type { HeliosLoadProfile, HeliosLoadProfileId } from './types.ts';

export const HELIOS_LOAD_PROFILES: Readonly<Record<HeliosLoadProfileId, HeliosLoadProfile>> = Object.freeze({
  SMALL: Object.freeze({
    id: 'SMALL',
    description: 'Lightweight regression — 10 concurrent Grow users, minimal burst',
    concurrentCustomers: 10,
    activeWorkOrdersPerCustomer: 1,
    simultaneousProposals: 3,
    observationsPerSec: 5,
    instrumentCount: 10,
    providerCount: 2,
    concurrentResearchTasks: 3,
    concurrentS3mCalls: 2,
    concurrentGrokCalls: 1,
    activeStrategyCapsules: 5,
    ordersPerSec: 2,
    burstMultiplier: 1,
    durationMs: 2_000,
  }),
  MEDIUM: Object.freeze({
    id: 'MEDIUM',
    description: 'Moderate sandbox load — 100 concurrent Grow users',
    concurrentCustomers: 100,
    activeWorkOrdersPerCustomer: 2,
    simultaneousProposals: 10,
    observationsPerSec: 25,
    instrumentCount: 50,
    providerCount: 4,
    concurrentResearchTasks: 15,
    concurrentS3mCalls: 8,
    concurrentGrokCalls: 4,
    activeStrategyCapsules: 25,
    ordersPerSec: 10,
    burstMultiplier: 1,
    durationMs: 5_000,
  }),
  LARGE_SANDBOX: Object.freeze({
    id: 'LARGE_SANDBOX',
    description: 'Bounded large sandbox — infrastructure-limited, not production scale',
    concurrentCustomers: 250,
    activeWorkOrdersPerCustomer: 2,
    simultaneousProposals: 20,
    observationsPerSec: 50,
    instrumentCount: 100,
    providerCount: 6,
    concurrentResearchTasks: 30,
    concurrentS3mCalls: 15,
    concurrentGrokCalls: 8,
    activeStrategyCapsules: 50,
    ordersPerSec: 20,
    burstMultiplier: 1,
    durationMs: 8_000,
  }),
  BURST: Object.freeze({
    id: 'BURST',
    description: 'Sudden event spike on SMALL base — exercises backpressure and priority paths',
    concurrentCustomers: 10,
    activeWorkOrdersPerCustomer: 1,
    simultaneousProposals: 15,
    observationsPerSec: 100,
    instrumentCount: 20,
    providerCount: 3,
    concurrentResearchTasks: 20,
    concurrentS3mCalls: 10,
    concurrentGrokCalls: 5,
    activeStrategyCapsules: 10,
    ordersPerSec: 30,
    burstMultiplier: 5,
    durationMs: 3_000,
  }),
});

export const ALL_HELIOS_LOAD_PROFILE_IDS = Object.keys(HELIOS_LOAD_PROFILES) as HeliosLoadProfileId[];

export function resolveHeliosLoadProfile(id: HeliosLoadProfileId): HeliosLoadProfile {
  return HELIOS_LOAD_PROFILES[id];
}
