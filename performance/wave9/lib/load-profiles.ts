/**
 * Wave 9 — representative bounded load profiles.
 * ENGINEERING_MEASUREMENT only — not production SLAs.
 */

export type LoadProfileId =
  | 'NORMAL'
  | 'HIGH'
  | 'BURST'
  | 'SUSTAINED'
  | 'READ_HEAVY'
  | 'TRANSACTION_HEAVY'
  | 'PROVIDER_INGESTION_HEAVY'
  | 'EXCHANGE_HEAVY'
  | 'CLAIM_VERIFICATION_HEAVY';

export type LoadProfile = {
  readonly id: LoadProfileId;
  readonly description: string;
  readonly concurrency: number;
  readonly requestsPerWorker: number;
  readonly durationMs: number | null;
  readonly focus: readonly string[];
};

export const LOAD_PROFILES: Readonly<Record<LoadProfileId, LoadProfile>> = Object.freeze({
  NORMAL: {
    id: 'NORMAL',
    description: 'Typical preview client mix — health, bootstrap, home, accounts',
    concurrency: 10,
    requestsPerWorker: 5,
    durationMs: null,
    focus: ['api', 'wallet-queries'],
  },
  HIGH: {
    id: 'HIGH',
    description: 'Elevated concurrent reads across consumer BFF',
    concurrency: 50,
    requestsPerWorker: 10,
    durationMs: null,
    focus: ['api', 'graph-queries'],
  },
  BURST: {
    id: 'BURST',
    description: 'Short spike to exercise rate limits and backpressure',
    concurrency: 100,
    requestsPerWorker: 3,
    durationMs: 2_000,
    focus: ['api', 'rate-limit'],
  },
  SUSTAINED: {
    id: 'SUSTAINED',
    description: 'Moderate load over bounded window',
    concurrency: 25,
    requestsPerWorker: 20,
    durationMs: 5_000,
    focus: ['api', 'event-bus'],
  },
  READ_HEAVY: {
    id: 'READ_HEAVY',
    description: 'Bootstrap, home, accounts, exchange markets, grow snapshot',
    concurrency: 40,
    requestsPerWorker: 8,
    durationMs: null,
    focus: ['api', 'wallet-queries', 'graph-queries', 'federated-queries'],
  },
  TRANSACTION_HEAVY: {
    id: 'TRANSACTION_HEAVY',
    description: 'Ledger-affecting and grow proposal paths (sandbox only)',
    concurrency: 15,
    requestsPerWorker: 6,
    durationMs: null,
    focus: ['transaction-submission', 'action-center'],
  },
  PROVIDER_INGESTION_HEAVY: {
    id: 'PROVIDER_INGESTION_HEAVY',
    description: 'External data plane fan-out and oracle observation ingestion',
    concurrency: 20,
    requestsPerWorker: 10,
    durationMs: null,
    focus: ['economic-observation', 'oracle-mesh', 'provider-ingestion'],
  },
  EXCHANGE_HEAVY: {
    id: 'EXCHANGE_HEAVY',
    description: 'Exchange order ingress and market reads',
    concurrency: 30,
    requestsPerWorker: 8,
    durationMs: null,
    focus: ['exchange-order-processing'],
  },
  CLAIM_VERIFICATION_HEAVY: {
    id: 'CLAIM_VERIFICATION_HEAVY',
    description: 'Human contribution verification and PEVE/GPUV evaluation paths',
    concurrency: 20,
    requestsPerWorker: 15,
    durationMs: null,
    focus: ['human-contribution', 'peve', 'gpuv', 'information-consensus'],
  },
});

export const ALL_LOAD_PROFILE_IDS = Object.keys(LOAD_PROFILES) as LoadProfileId[];
