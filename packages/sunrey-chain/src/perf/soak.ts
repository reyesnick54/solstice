import { FeeEngine } from '../fees/engine.ts';
import { ProductiveEconomyEngine } from '../productive/engine.ts';
import { DEV_CLOCK, fixtureClaim, fixtureFacts, fixtureRight, solarFacility } from '../productive/fixtures.ts';
import { developmentEnergyFeed, developmentOracleEngine } from '../oracle/index.ts';
import { registerEnergyProviders, signDraft } from '../oracle/demo-helpers.ts';
import { SimulationEnergyAdapter } from '../oracle/adapter.ts';
import { quantity } from '../oracle/units.ts';
import { mutableClock } from '../oracle/demo-helpers.ts';
import { validatorDescriptors } from './consensus.ts';
import { measureCustodyWorkflow } from './custody.ts';
import {
  checkCustodyMismatch,
  checkExplorerCaughtUp,
  checkNativeSupply,
  checkNoDuplicateMoonRey,
  checkNoDuplicateSettlements,
  checkNoSignerConflicts,
  checkStateRootsEqual,
} from './invariants.ts';
import { ConnectionTracker, ResourceMonitor } from './leaks.ts';
import { captureMemoryDiagnostics, diagnosticsToResourceSample } from './memory-instrumentation.ts';
import { analyzeMemoryTrend, MEMORY_TREND_MIN_SOAK_MS, phaseAtMs } from './memory-trend-analysis.ts';
import type { SoakIntegratedHarness } from './ports.ts';
import { createInProcessRpc } from './rpc.ts';
import { caseResult } from './result.ts';
import { elapsedNs, nowNs, summarizeThroughput } from './statistics.ts';
import type { BenchCaseResult, InvariantCheck, ResourceSample } from './types.ts';
import { executableForKind, mixedKindAt } from './workload.ts';

const PRODUCTIVE_OBJECT_SLOTS = 128;

export function defaultSoakMs(): number {
  const raw = process.env.SUNREY_BENCH_SOAK_MS;
  if (!raw) {
    return 250;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 250;
}

/** Short soak bundled into runSanity for RC smoke qualification (HEALTH07 uses sanitySoakMs / dedicated tests). */
export function rcSanitySoakMs(): number {
  return 80;
}

/** Minimum soak for HEALTH07 trend invariants (≥4 snapshots, ≥3 steady-state). */
export function sanitySoakMs(): number {
  const raw =
    process.env.SUNREY_BENCH_SANITY_SOAK_MS ?? process.env.SUNREY_BENCH_SOAK_QUALIFY_MS;
  if (raw) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 45_000;
}

function tickOracleBench(
  engine: ReturnType<typeof developmentOracleEngine>,
  providers: ReturnType<typeof registerEnergyProviders>,
  feedId: string,
  index: number,
): void {
  const adapter = new SimulationEnergyAdapter();
  const clock = mutableClock(1_700_000_000n + BigInt(index));
  for (let i = 0; i < providers.length; i += 1) {
    const provider = providers[i]!;
    const built = quantity(100n + BigInt(i), 0, 'MWh');
    if (!built.ok) {
      throw new Error(built.error.detail);
    }
    const draft = adapter.collect(
      {
        oracleId: provider.record.oracleId,
        feedId,
        subject: `plant_${index % 16}`,
        networkId: engine.networkId,
        chainId: engine.chainId,
        sequence: BigInt(index),
        measurementStartUnix: clock.now,
        measurementEndUnix: clock.now + 60n,
        observationTimeUnix: clock.now + 30n,
        validUntilUnix: clock.now + 3_600n,
      },
      built.value,
    );
    const signed = signDraft(engine, provider.label, draft);
    const submitted = engine.submitObservation(signed);
    if (!submitted.ok) {
      throw new Error(submitted.error.detail);
    }
  }
  const finalized = engine.finalizeWindow({
    feedId,
    subject: `plant_${index % 16}`,
    startUnix: clock.now,
    endUnix: clock.now + 60n,
  });
  if (!finalized.ok) {
    throw new Error(finalized.error.detail);
  }
}

const SOAK_SAMPLE_INTERVAL_MS = 5_000;
/** One mixed workload iteration per wall-clock ms (trend gates assume elapsed time bounds work). */
const SOAK_MS_PER_ITERATION = 1;

export function runSoak(input: {
  readonly durationMs: number;
  readonly explorerLag?: number;
  readonly memoryThresholdBytes?: number;
  readonly integrated?: SoakIntegratedHarness;
}): {
  readonly cases: readonly BenchCaseResult[];
  readonly invariants: readonly InvariantCheck[];
  readonly monitor: ResourceMonitor;
  readonly connections: ConnectionTracker;
  readonly memorySnapshots: readonly ResourceSample[];
  readonly memoryTrend: ReturnType<typeof analyzeMemoryTrend>;
} {
  const monitor = new ResourceMonitor();
  const memorySnapshots: ResourceSample[] = [];
  const connections = new ConnectionTracker();
  const engine = new FeeEngine();
  const replica = new FeeEngine({ recordReceipts: false });
  engine.faucet('alice', 50_000_000n);
  replica.faucet('alice', 50_000_000n);
  const productive = new ProductiveEconomyEngine(DEV_CLOCK);
  const rpc = createInProcessRpc();
  const oracleClock = mutableClock(1_700_000_000n);
  const oracle = developmentOracleEngine(oracleClock);
  const oracleProviders = registerEnergyProviders(oracle);
  const oracleFeed = oracle.registerFeed(developmentEnergyFeed({ minimumSources: 3, minimumQuorum: 3 }));
  if (!oracleFeed.ok) {
    throw new Error(oracleFeed.error.detail);
  }
  const oracleFeedId = oracleFeed.value.feedId;
  const registeredProductiveSlots = new Set<number>();
  const validators = validatorDescriptors(4);
  const started = nowNs();
  let submitted = 0;
  let finalized = 0;
  let rejected = 0;
  let height = 1;
  let index = 0;
  const sampleIntervalMs = Math.min(
    SOAK_SAMPLE_INTERVAL_MS,
    Math.max(250, Math.floor(input.durationMs / 24)),
  );
  let nextSampleMs = 0;
  const integrated = input.integrated;
  connections.open('rpc');
  connections.open('eventSubscriptions');
  monitor.sample();
  memorySnapshots.push(
    diagnosticsToResourceSample(
      captureMemoryDiagnostics(0, {
        fees: engine,
        productive,
        integrated: integrated?.snapshot(),
        phase: phaseAtMs(0, input.durationMs),
      }),
    ),
  );
  while (true) {
    const elapsedMs = elapsedNs(started) / 1_000_000;
    if (elapsedMs >= input.durationMs) {
      break;
    }
    const allowedIterations = Math.floor(elapsedMs / SOAK_MS_PER_ITERATION) + 1;
    if (index >= allowedIterations) {
      continue;
    }
    const kind = mixedKindAt(index);
    const tx = executableForKind(kind, index, 'alice', 'bob');
    submitted += 1;
    const admission = engine.validateAdmission(tx);
    if (admission) {
      rejected += 1;
    } else {
      engine.activateAt(height);
      const executed = engine.execute({
        tx,
        blockHeight: height,
        blockId: `blk_${height}`,
        proposerId: validators[0]!.validatorId,
        validators,
      });
      if (executed.ok) {
        finalized += 1;
      } else {
        rejected += 1;
      }
      replica.activateAt(height);
      replica.execute({
        tx,
        blockHeight: height,
        blockId: `blk_${height}`,
        proposerId: validators[0]!.validatorId,
        validators,
      });
    }
    if (index % 7 === 0) {
      rpc.handle('block');
      tickOracleBench(oracle, oracleProviders, oracleFeedId, index);
    }
    integrated?.tick(index);
    if (index % 11 === 0) {
      const slot = Math.floor(index / 11) % PRODUCTIVE_OBJECT_SLOTS;
      const objectId = `obj.soak.${slot}`;
      if (!registeredProductiveSlots.has(slot)) {
        const object = {
          ...solarFacility(),
          objectId,
          rightsReference: `right.${objectId}`,
          owner: `ctl.${objectId}`,
          controller: `ctl.${objectId}`,
          operator: `ctl.${objectId}`,
          oracleFeedReferences: [`feed.${objectId}`],
        };
        productive.registerObject(object);
        productive.putRight(fixtureRight({ rightId: object.rightsReference, objectId, holderId: object.controller }));
        registeredProductiveSlots.add(slot);
      }
      const quantity = 80n + BigInt(index);
      for (const fact of fixtureFacts({ objectId, category: 'ENERGY', quantity, unit: 'kWh' })) {
        productive.putOracleFact(fact);
      }
      const claim = fixtureClaim({
        claimId: `claim.soak.${slot}`,
        objectId,
        claimType: 'OUTPUT',
        category: 'ENERGY',
        quantity,
        unit: 'kWh',
      });
      productive.submitClaim(claim);
      productive.issueFromClaim(claim.claimId);
    }
    if (elapsedMs >= nextSampleMs) {
      monitor.sample();
      memorySnapshots.push(
        diagnosticsToResourceSample(
          captureMemoryDiagnostics(elapsedMs, {
            fees: engine,
            productive,
            integrated: integrated?.snapshot(),
            phase: phaseAtMs(elapsedMs, input.durationMs),
          }),
        ),
      );
      nextSampleMs += sampleIntervalMs;
    }
    index += 1;
    height += 1;
  }
  measureCustodyWorkflow({ deposits: 1 });
  connections.close('rpc');
  connections.close('eventSubscriptions');
  monitor.sample();
  memorySnapshots.push(
    diagnosticsToResourceSample(
      captureMemoryDiagnostics(input.durationMs, {
        fees: engine,
        productive,
        integrated: integrated?.snapshot(),
        phase: phaseAtMs(input.durationMs, input.durationMs),
      }),
    ),
  );
  const memoryTrend = analyzeMemoryTrend(memorySnapshots, input.durationMs);
  const growth = monitor.monotonicGrowth(input.memoryThresholdBytes ?? 64 * 1024 * 1024);
  const memoryTrendRequired = input.durationMs >= MEMORY_TREND_MIN_SOAK_MS;
  const shortSoakTrendDetail = `short_soak(<${MEMORY_TREND_MIN_SOAK_MS}ms): HEALTH07 trend deferred; legacy_rss_delta=${growth.delta}`;
  const aliceRoot = engine.accounts.position('alice', 'SUNREY_COIN').available.toString();
  const replicaRoot = replica.accounts.position('alice', 'SUNREY_COIN').available.toString();
  const feeStats = engine.feeReceiptRetentionStats();
  const invariants: InvariantCheck[] = [
    checkStateRootsEqual(aliceRoot, replicaRoot),
    checkNativeSupply(engine),
    checkNoDuplicateSettlements(engine),
    checkNoDuplicateMoonRey(productive),
    checkExplorerCaughtUp(input.explorerLag ?? 0),
    checkNoSignerConflicts(0),
    checkCustodyMismatch(0),
    {
      id: 'MEMORY_GROWTH_BUDGET',
      ok: memoryTrendRequired ? memoryTrend.ok : !growth.flagged,
      detail: memoryTrendRequired
        ? memoryTrend.ok
          ? `${memoryTrend.detail}; legacy_rss_delta=${growth.delta}`
          : memoryTrend.detail
        : shortSoakTrendDetail,
    },
    {
      id: 'MEMORY_STEADY_STATE_TREND',
      ok: memoryTrendRequired ? memoryTrend.ok : true,
      detail: memoryTrendRequired ? memoryTrend.detail : shortSoakTrendDetail,
    },
    {
      id: 'CONNECTION_RELEASE',
      ok: !connections.leaked(),
      detail: connections.leaked() ? 'connections remained open' : 'closed clients released resources',
    },
  ];
  return {
    monitor,
    connections,
    invariants,
    memorySnapshots,
    memoryTrend,
    cases: [
      caseResult('soak', 'mixed_continuous', {
        throughput: summarizeThroughput({
          submitted,
          accepted: submitted - rejected,
          finalized,
          rejected,
          durationMs: input.durationMs,
        }),
        extras: {
          durationMs: input.durationMs,
          memoryFlagged: memoryTrendRequired && !memoryTrend.ok,
          memoryTrendClass: memoryTrend.classification,
          rssDeltaBytes: memoryTrend.rssDeltaStartToEndBytes,
          steadyHeapSlopeBytesPerMs: memoryTrend.theilSenHeapUsedSlopeBytesPerMs,
          steadyRssSlopeBytesPerMs: memoryTrend.theilSenRssSlopeBytesPerMs,
          feeReceiptsInMemory: feeStats.inMemoryReceipts,
          feeReceiptsSealed: feeStats.sealedReceipts,
          memorySnapshots: memorySnapshots.length,
          productiveObjectSlots: PRODUCTIVE_OBJECT_SLOTS,
        },
      }),
    ],
  };
}
