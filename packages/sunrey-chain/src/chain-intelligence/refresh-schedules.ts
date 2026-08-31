/**
 * Background refresh schedules for chain intelligence (simulation quotas).
 */

export type ChainIntelligenceRefreshSchedule = {
  readonly capability: string;
  readonly intervalMs: number;
  readonly enabled: boolean;
  readonly notes: string;
};

export const CHAIN_INTELLIGENCE_REFRESH_SCHEDULES: readonly ChainIntelligenceRefreshSchedule[] = Object.freeze([
  Object.freeze({
    capability: 'network_health',
    intervalMs: 300_000,
    enabled: true,
    notes: 'Network health / node reachability — every 5 minutes.',
  }),
  Object.freeze({
    capability: 'latest_block',
    intervalMs: 60_000,
    enabled: true,
    notes: 'Latest block tip — every 60 seconds.',
  }),
  Object.freeze({
    capability: 'fee_recommendation',
    intervalMs: 120_000,
    enabled: true,
    notes: 'Fee recommendation — every 2 minutes.',
  }),
  Object.freeze({
    capability: 'mempool_condition',
    intervalMs: 60_000,
    enabled: true,
    notes: 'Mempool congestion — every 60 seconds.',
  }),
]);
