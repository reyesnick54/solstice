/**
 * Chunk 58 — SunRey performance-engineering types.
 *
 * Results are engineering measurements, not production guarantees.
 * Context-free TPS numbers are refused. Protocol defaults are not
 * changed because a candidate limit is faster.
 */

export const PERF_SCHEMA_VERSION = 1 as const;
export const PERF_PROTOCOL_VERSION = 'sunrey.perf.v1' as const;
export const RESULT_CLASS = 'ENGINEERING_MEASUREMENT' as const;
export const CAPACITY_LABEL = 'ENGINEERING_ESTIMATE' as const;

export const BENCH_PROFILES = [
  'micro',
  'single-node',
  'four-validator',
  'seven-validator',
  'rpc',
  'exchange',
  'explorer',
  'soak',
] as const;
export type BenchProfile = (typeof BENCH_PROFILES)[number];

export const LATENCY_PROFILES = ['low', 'regional', 'intercontinental'] as const;
export type LatencyProfile = (typeof LATENCY_PROFILES)[number];

export const WORKLOAD_KINDS = [
  'NATIVE_TRANSFER',
  'MOONREY_TRANSFER',
  'ASSET_LOCK',
  'EXCHANGE_SETTLEMENT',
  'ORACLE_OBSERVATION',
  'PRODUCTIVE_CLAIM',
  'MACHINE_COMMERCE',
  'GOVERNANCE_READ',
  'GOVERNANCE_WRITE',
] as const;
export type WorkloadKind = (typeof WORKLOAD_KINDS)[number];

export const CONSENSUS_PHASES = [
  'proposal_creation',
  'proposal_propagation',
  'prevote',
  'precommit',
  'commit',
  'end_to_end_finality',
] as const;
export type ConsensusPhase = (typeof CONSENSUS_PHASES)[number];

export const MEMPOOL_LOADS = ['normal', 'burst', 'invalid'] as const;
export type MempoolLoad = (typeof MEMPOOL_LOADS)[number];

export const RPC_ENDPOINTS = [
  'block',
  'transaction',
  'account',
  'asset_holdings',
  'fees',
  'oracle_facts',
  'productive_graph',
  'validator_set',
  'interop_client',
] as const;
export type RpcEndpoint = (typeof RPC_ENDPOINTS)[number];

export const CRYPTO_SUITE_LABELS = [
  'CLASSICAL_DEVELOPMENT_ED25519',
  'HYBRID_SIMULATION',
  'CHUNK_60_REAL_PQC_UNAVAILABLE',
] as const;
export type CryptoSuiteLabel = (typeof CRYPTO_SUITE_LABELS)[number];

export const SOAK_INVARIANTS = [
  'STATE_ROOTS_EQUAL',
  'NATIVE_SUPPLY_RECONCILES',
  'NO_DUPLICATE_SETTLEMENTS',
  'NO_DUPLICATE_MOONREY_ISSUANCE',
  'EXPLORER_CAUGHT_UP',
  'NO_SIGNER_CONFLICTS',
  'NO_GROWING_CUSTODY_MISMATCH',
] as const;
export type SoakInvariant = (typeof SOAK_INVARIANTS)[number];

export const FORBIDDEN_OPTIMIZATION_BYPASSES = [
  'consensus',
  'CryptoSuite',
  'authorization',
  'policy',
  'asset_reconciliation',
  'oracle_validation',
  'custody_controls',
  'exchange_reservations',
] as const;

export type HardwareProfile = {
  readonly arch: string;
  readonly cpus: number;
  readonly totalMemoryBytes: number;
  readonly model: string;
};

export type OsContainerProfile = {
  readonly platform: string;
  readonly release: string;
  readonly container: boolean;
  readonly nodeVersion: string;
};

export type BenchContext = {
  readonly schemaVersion: typeof PERF_SCHEMA_VERSION;
  readonly resultClass: typeof RESULT_CLASS;
  readonly sourceCommit: string;
  readonly hardware: HardwareProfile;
  readonly os: OsContainerProfile;
  readonly validatorCount: number;
  readonly latencyProfile: LatencyProfile;
  readonly datasetSize: number;
  readonly protocolVersion: string;
  readonly testDurationMs: number;
  readonly profile: BenchProfile;
  readonly startedAtUtc: string;
};

export type LatencyStats = {
  readonly count: number;
  readonly minNs: number;
  readonly maxNs: number;
  readonly meanNs: number;
  readonly medianNs: number;
  readonly p50Ns: number;
  readonly p95Ns: number;
  readonly p99Ns: number;
  readonly stddevNs: number;
};

export type ThroughputStats = {
  readonly submitted: number;
  readonly accepted: number;
  readonly finalized: number;
  readonly rejected: number;
  readonly sustainedFinalizedPerSec: number;
  readonly burstFinalizedPerSec: number;
  readonly errorRejectionRate: number;
};

export type ResourceSample = {
  readonly atMs: number;
  readonly rssBytes: number;
  readonly heapUsedBytes: number;
  readonly cpuUserMs: number;
  readonly cpuSystemMs: number;
};

export type ConnectionSnapshot = {
  readonly p2p: number;
  readonly rpc: number;
  readonly databasePools: number;
  readonly eventSubscriptions: number;
};

export type BenchCaseResult = {
  readonly name: string;
  readonly suite: string;
  readonly cryptoLabeledSeparately: boolean;
  readonly latency?: LatencyStats;
  readonly throughput?: ThroughputStats;
  readonly extras?: Readonly<Record<string, string | number | boolean>>;
};

export type InvariantCheck = {
  readonly id: SoakInvariant | string;
  readonly ok: boolean;
  readonly detail: string;
};

export type BenchReport = {
  readonly context: BenchContext;
  readonly cases: readonly BenchCaseResult[];
  readonly invariants: readonly InvariantCheck[];
  readonly resources: readonly ResourceSample[];
  readonly connections: ConnectionSnapshot;
  readonly warnings: readonly string[];
};
