import { studyBlockResourceCandidates } from './block-size.ts';
import { measureConsensusLatency } from './consensus.ts';
import { captureContext } from './context.ts';
import { measureCryptoSuites } from './crypto.ts';
import { measureCustodyWorkflow } from './custody.ts';
import { estimateDiskGrowth } from './disk.ts';
import { measureInterop, measureMachine, measureOracle, measureProductive } from './economy.ts';
import { ConnectionTracker, ResourceMonitor } from './leaks.ts';
import { measureMempool } from './mempool.ts';
import type { BenchPorts } from './ports.ts';
import { measureRpcAbuse, measureRpcLoad } from './rpc.ts';
import { defaultSoakMs, runSoak } from './soak.ts';
import { measureStateGrowth } from './state-growth.ts';
import { measureStorage } from './storage.ts';
import { measureFinalizedThroughput } from './throughput.ts';
import type { BenchCaseResult, BenchProfile, BenchReport, InvariantCheck, LatencyProfile } from './types.ts';
import { LATENCY_PROFILES } from './types.ts';
import { measureWalletSdk } from './wallet.ts';
import { measureFeePolicyV2 } from './fee-market.ts';

export type RunOptions = {
  readonly profile: BenchProfile;
  readonly ports?: BenchPorts;
  readonly soakMs?: number;
  readonly latencyProfile?: LatencyProfile;
};

function emptyConnections(): ConnectionTracker {
  return new ConnectionTracker();
}

export function runProfile(options: RunOptions): BenchReport {
  const monitor = new ResourceMonitor();
  monitor.sample();
  const cases: BenchCaseResult[] = [];
  const invariants: InvariantCheck[] = [];
  const warnings: string[] = [];
  const started = Date.now();
  let validatorCount = 1;
  let datasetSize = 0;
  const latencyProfile = options.latencyProfile ?? 'low';

  if (options.profile === 'micro') {
    datasetSize = 32;
    cases.push(...measureCryptoSuites());
    cases.push(...measureMempool({ count: 32, load: 'normal' }));
    cases.push(...measureMempool({ count: 32, load: 'burst' }));
    cases.push(...measureMempool({ count: 16, load: 'invalid' }));
    cases.push(...measureFeePolicyV2(24));
  } else if (options.profile === 'single-node') {
    datasetSize = 24;
    const native = measureFinalizedThroughput({ validatorCount: 4, transfers: 24, mixed: false });
    cases.push(...native.cases);
    cases.push(...measureWalletSdk({ transfers: 8 }));
    cases.push(...measureStorage({ snapshots: 3 }));
    cases.push(...measureStateGrowth({ accounts: 16, transfers: 24 }));
    cases.push(...estimateDiskGrowth({ blocks: 24, transactions: 24, oracleFacts: 8, contributions: 8 }).cases);
    const study = studyBlockResourceCandidates();
    cases.push(...study.cases);
    warnings.push(study.recommendation);
    invariants.push({
      id: 'STATE_ROOTS_EQUAL',
      ok: native.stateRootsEqual,
      detail: native.stateRootsEqual ? 'single-node replicas agree' : 'single-node replicas diverged',
    });
  } else if (options.profile === 'four-validator') {
    validatorCount = 4;
    datasetSize = 6;
    for (const profile of LATENCY_PROFILES) {
      const measured = measureConsensusLatency({ validatorCount: 4, latencyProfile: profile, heights: 4 });
      cases.push(...measured.cases);
      invariants.push({
        id: 'STATE_ROOTS_EQUAL',
        ok: measured.stateRootsEqual,
        detail: `4-validator ${profile} roots ${measured.stateRootsEqual ? 'agree' : 'diverged'}`,
      });
    }
  } else if (options.profile === 'seven-validator') {
    validatorCount = 7;
    datasetSize = 48;
    const consensus = measureConsensusLatency({ validatorCount: 7, latencyProfile, heights: 4 });
    cases.push(...consensus.cases);
    const load = measureFinalizedThroughput({ validatorCount: 7, transfers: 48, mixed: true });
    cases.push(...load.cases);
    cases.push(...measureOracle({ providers: 3, windows: 2 }));
    cases.push(...measureProductive({ claims: 2 }));
    cases.push(...measureMachine({ actors: 1 }));
    cases.push(...measureInterop({ packets: 2 }));
    cases.push(...measureCustodyWorkflow({ deposits: 2 }));
    invariants.push({
      id: 'STATE_ROOTS_EQUAL',
      ok: consensus.stateRootsEqual && load.stateRootsEqual,
      detail: 'seven-validator state-root agreement',
    });
    warnings.push(
      `seven-validator load submitted=${load.submitted} accepted=${load.accepted} finalized=${load.finalized} rejected=${load.rejected} round_changes=${load.roundChanges}`,
    );
  } else if (options.profile === 'rpc') {
    datasetSize = 90;
    cases.push(...measureRpcLoad({ requests: 90 }));
    cases.push(...measureRpcAbuse({ requests: 40 }));
  } else if (options.profile === 'exchange') {
    datasetSize = 32;
    if (options.ports?.exchange) {
      cases.push(...options.ports.exchange.measure({ orders: 32 }));
    } else {
      warnings.push('exchange adapter absent; matching/settlement benches skipped');
    }
  } else if (options.profile === 'explorer') {
    datasetSize = 64;
    if (options.ports?.explorer) {
      cases.push(...options.ports.explorer.measure({ blocks: 64, catchUp: true }));
    } else {
      warnings.push('explorer adapter absent; catch-up benches skipped');
    }
  } else {
    const soak = runSoak({ durationMs: options.soakMs ?? defaultSoakMs() });
    cases.push(...soak.cases);
    invariants.push(...soak.invariants);
    datasetSize = soak.cases[0]?.throughput?.submitted ?? 0;
    monitor.sample();
    if (options.ports?.sdk) {
      cases.push(...options.ports.sdk.measure({ requests: 8 }));
    }
    return {
      context: captureContext({
        profile: 'soak',
        validatorCount: 4,
        latencyProfile,
        datasetSize,
        testDurationMs: options.soakMs ?? defaultSoakMs(),
      }),
      cases,
      invariants,
      resources: soak.monitor.snapshot(),
      connections: soak.connections.snapshot(),
      warnings,
    };
  }

  if (options.ports?.sdk && options.profile === 'rpc') {
    cases.push(...options.ports.sdk.measure({ requests: 8 }));
  }

  monitor.sample();
  return {
    context: captureContext({
      profile: options.profile,
      validatorCount,
      latencyProfile,
      datasetSize,
      testDurationMs: Date.now() - started,
    }),
    cases,
    invariants,
    resources: monitor.snapshot(),
    connections: emptyConnections().snapshot(),
    warnings,
  };
}

export function runSanity(ports?: BenchPorts): BenchReport {
  const shared = ports !== undefined ? { ports } : {};
  const micro = runProfile({ profile: 'micro', ...shared });
  const seven = runProfile({ profile: 'seven-validator', latencyProfile: 'low', ...shared });
  const soak = runProfile({ profile: 'soak', soakMs: 80, ...shared });
  const adapterCases = [
    ...(ports?.explorer ? ports.explorer.measure({ blocks: 24, catchUp: true }) : []),
    ...(ports?.exchange ? ports.exchange.measure({ orders: 12 }) : []),
  ];
  return {
    context: captureContext({
      profile: 'micro',
      validatorCount: 7,
      latencyProfile: 'low',
      datasetSize: micro.context.datasetSize + seven.context.datasetSize,
      testDurationMs: micro.context.testDurationMs + seven.context.testDurationMs + soak.context.testDurationMs,
    }),
    cases: [...micro.cases, ...seven.cases, ...soak.cases, ...adapterCases],
    invariants: [...micro.invariants, ...seven.invariants, ...soak.invariants],
    resources: [...micro.resources, ...seven.resources, ...soak.resources],
    connections: soak.connections,
    warnings: [
      ...micro.warnings,
      ...seven.warnings,
      ...soak.warnings,
      'CI sanity combines micro + seven-validator + short soak. Multi-hour soak is a manual/nightly profile.',
    ],
  };
}
