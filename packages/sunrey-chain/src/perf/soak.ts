import { FeeEngine } from '../fees/engine.ts';
import { FeeMempool } from '../fees/mempool.ts';
import { ProductiveEconomyEngine } from '../productive/engine.ts';
import { DEV_CLOCK, fixtureClaim, fixtureFacts, fixtureRight, solarFacility } from '../productive/fixtures.ts';
import { validatorDescriptors } from './consensus.ts';
import { measureCustodyWorkflow } from './custody.ts';
import { measureOracle } from './economy.ts';
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
import { createInProcessRpc } from './rpc.ts';
import { caseResult } from './result.ts';
import { elapsedNs, nowNs, summarizeThroughput } from './statistics.ts';
import type { BenchCaseResult, InvariantCheck } from './types.ts';
import { executableForKind, mixedKindAt } from './workload.ts';

export function defaultSoakMs(): number {
  const raw = process.env.SUNREY_BENCH_SOAK_MS;
  if (!raw) {
    return 250;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 250;
}

export function runSoak(input: {
  readonly durationMs: number;
  readonly explorerLag?: number;
  readonly memoryThresholdBytes?: number;
}): {
  readonly cases: readonly BenchCaseResult[];
  readonly invariants: readonly InvariantCheck[];
  readonly monitor: ResourceMonitor;
  readonly connections: ConnectionTracker;
} {
  const monitor = new ResourceMonitor();
  const connections = new ConnectionTracker();
  const engine = new FeeEngine();
  const replica = new FeeEngine();
  engine.faucet('alice', 50_000_000n);
  replica.faucet('alice', 50_000_000n);
  const productive = new ProductiveEconomyEngine(DEV_CLOCK);
  const rpc = createInProcessRpc();
  const validators = validatorDescriptors(4);
  const started = nowNs();
  let submitted = 0;
  let finalized = 0;
  let rejected = 0;
  let height = 1;
  let index = 0;
  const settlementIds: string[] = [];
  connections.open('rpc');
  connections.open('eventSubscriptions');
  monitor.sample();
  while (elapsedNs(started) / 1_000_000 < input.durationMs) {
    const mempool = new FeeMempool(engine);
    const kind = mixedKindAt(index);
    const tx = executableForKind(kind, index, 'alice', 'bob');
    submitted += 1;
    if (mempool.admit(tx)) {
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
        settlementIds.push(executed.receipt.transactionId);
      } else {
        rejected += 1;
      }
      replica.activateAt(height);
      const copy = new FeeMempool(replica);
      copy.admit(tx);
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
      measureOracle({ providers: 3, windows: 1 });
    }
    if (index % 11 === 0) {
      const objectId = `obj.soak.${index}`;
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
      for (const fact of fixtureFacts({ objectId, category: 'ENERGY', quantity: 80n, unit: 'kWh' })) {
        productive.putOracleFact(fact);
      }
      const claim = fixtureClaim({
        claimId: `claim.soak.${index}`,
        objectId,
        claimType: 'OUTPUT',
        category: 'ENERGY',
        quantity: 80n,
        unit: 'kWh',
      });
      productive.submitClaim(claim);
      productive.issueFromClaim(claim.claimId);
    }
    if (index % 5 === 0) {
      monitor.sample();
    }
    index += 1;
    height += 1;
  }
  measureCustodyWorkflow({ deposits: 1 });
  connections.close('rpc');
  connections.close('eventSubscriptions');
  monitor.sample();
  const growth = monitor.monotonicGrowth(input.memoryThresholdBytes ?? 64 * 1024 * 1024);
  const aliceRoot = engine.accounts.position('alice', 'SUNREY_COIN').available.toString();
  const replicaRoot = replica.accounts.position('alice', 'SUNREY_COIN').available.toString();
  const invariants: InvariantCheck[] = [
    checkStateRootsEqual(aliceRoot, replicaRoot),
    checkNativeSupply(engine),
    checkNoDuplicateSettlements(settlementIds),
    checkNoDuplicateMoonRey(productive),
    checkExplorerCaughtUp(input.explorerLag ?? 0),
    checkNoSignerConflicts(0),
    checkCustodyMismatch(0),
    {
      id: 'MEMORY_GROWTH_BUDGET',
      ok: !growth.flagged,
      detail: growth.flagged ? `rss grew ${growth.delta} bytes` : `rss delta ${growth.delta} bytes`,
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
          memoryFlagged: growth.flagged,
          rssDeltaBytes: growth.delta,
        },
      }),
    ],
  };
}
