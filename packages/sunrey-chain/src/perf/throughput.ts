import { FeeEngine } from '../fees/engine.ts';
import { FeeMempool } from '../fees/mempool.ts';
import { SevenValidatorNetwork } from '../ops/seven-validator.ts';
import { caseResult } from './result.ts';
import { elapsedNs, nowNs, summarizeLatency, summarizeThroughput } from './statistics.ts';
import type { BenchCaseResult } from './types.ts';
import { replicaEngines, validatorDescriptors } from './consensus.ts';
import { executableForKind, mixedKindAt, nativeTransferTx } from './workload.ts';

export type FinalizedLoadReport = {
  readonly cases: readonly BenchCaseResult[];
  readonly submitted: number;
  readonly accepted: number;
  readonly finalized: number;
  readonly rejected: number;
  readonly roundChanges: number;
  readonly stateRootsEqual: boolean;
  readonly cpuUserMs: number;
  readonly cpuSystemMs: number;
  readonly rssBytes: number;
};

function finalizeBatch(
  engines: FeeEngine[],
  txs: readonly ReturnType<typeof nativeTransferTx>[],
  height: number,
  validators: ReturnType<typeof validatorDescriptors>,
): { readonly finalized: number; readonly rejected: number; readonly root: string } {
  const primary = engines[0];
  if (!primary) {
    throw new Error('no replica engines');
  }
  const mempool = new FeeMempool(primary);
  let rejected = 0;
  for (const tx of txs) {
    if (mempool.admit(tx)) {
      rejected += 1;
    }
  }
  const selected = mempool.selectForBlock();
  primary.activateAt(height);
  let finalized = 0;
  const hashes: string[] = [];
  for (const tx of selected) {
    const executed = primary.execute({
      tx,
      blockHeight: height,
      blockId: `blk_${height}`,
      proposerId: validators[0]!.validatorId,
      validators,
    });
    if (executed.ok) {
      finalized += 1;
      hashes.push(primary.receiptHash(executed.receipt));
    } else {
      rejected += 1;
    }
  }
  mempool.removeCommitted(selected.map((tx) => tx.transactionId));
  for (const replica of engines.slice(1)) {
    const copy = new FeeMempool(replica);
    for (const tx of selected) {
      copy.admit(tx);
    }
    replica.activateAt(height);
    for (const tx of selected) {
      replica.execute({
        tx,
        blockHeight: height,
        blockId: `blk_${height}`,
        proposerId: validators[0]!.validatorId,
        validators,
      });
    }
  }
  return { finalized, rejected, root: hashes[hashes.length - 1] ?? '' };
}

export function measureFinalizedThroughput(input: {
  readonly validatorCount: 4 | 7;
  readonly transfers: number;
  readonly mixed: boolean;
}): FinalizedLoadReport {
  const cpuBefore = process.cpuUsage();
  const engines = replicaEngines(input.validatorCount);
  const validators = validatorDescriptors(input.validatorCount);
  const network = input.validatorCount === 7 ? new SevenValidatorNetwork() : null;
  const finalitySamples: number[] = [];
  let submitted = 0;
  let accepted = 0;
  let finalized = 0;
  let rejected = 0;
  let roundChanges = 0;
  const roots: string[] = [];
  const started = nowNs();
  const perBlock = Math.max(4, Math.min(16, Math.ceil(input.transfers / 8)));
  let height = 1;
  let index = 0;
  while (index < input.transfers) {
    const batch = [];
    for (let i = 0; i < perBlock && index < input.transfers; i += 1) {
      submitted += 1;
      if (input.mixed) {
        const kind = mixedKindAt(index);
        batch.push(executableForKind(kind, index, 'alice', 'bob'));
      } else {
        batch.push(nativeTransferTx(`xfer:${index}`, 'alice', 'bob', 2n));
      }
      index += 1;
    }
    const heightStarted = nowNs();
    if (network && !network.produce(BigInt(height))) {
      roundChanges += 1;
    }
    const outcome = finalizeBatch(engines, batch, height, validators);
    accepted += batch.length - outcome.rejected;
    finalized += outcome.finalized;
    rejected += outcome.rejected;
    roots.push(outcome.root);
    finalitySamples.push(elapsedNs(heightStarted));
    height += 1;
  }
  const durationNs = elapsedNs(started);
  const cpu = process.cpuUsage(cpuBefore);
  const memory = process.memoryUsage();
  const primary = engines[0]!;
  const replica = engines[1]!;
  const stateRootsEqual = primary.accounts.position('alice', 'SUNREY_COIN').available ===
    replica.accounts.position('alice', 'SUNREY_COIN').available;

  const suite = input.mixed ? 'mixed_workload' : 'native_transfer';
  return {
    cases: [
      caseResult(suite, `${input.validatorCount}v_finalized_throughput`, {
        latency: summarizeLatency(finalitySamples),
        throughput: summarizeThroughput({
          submitted,
          accepted,
          finalized,
          rejected,
          durationMs: durationNs / 1_000_000,
        }),
        extras: {
          validatorCount: input.validatorCount,
          roundChanges,
          stateRootsEqual,
          rssBytes: memory.rss,
          cpuUserMs: cpu.user / 1000,
          cpuSystemMs: cpu.system / 1000,
          measured: 'finalized_not_mempool_only',
        },
      }),
    ],
    submitted,
    accepted,
    finalized,
    rejected,
    roundChanges,
    stateRootsEqual,
    cpuUserMs: cpu.user / 1000,
    cpuSystemMs: cpu.system / 1000,
    rssBytes: memory.rss,
  };
}
