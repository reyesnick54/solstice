import { FeeEngine } from '../fees/engine.ts';
import { compareForSelection, FeeMempool } from '../fees/mempool.ts';
import { caseResult } from './result.ts';
import { elapsedNs, nowNs, summarizeLatency } from './statistics.ts';
import type { BenchCaseResult, MempoolLoad } from './types.ts';
import { invalidTx, nativeTransferTx } from './workload.ts';

export function measureMempool(input: { readonly count: number; readonly load: MempoolLoad }): readonly BenchCaseResult[] {
  const engine = new FeeEngine();
  engine.faucet('alice', 100_000_000n);
  const mempool = new FeeMempool(engine);
  const admission: number[] = [];
  const selection: number[] = [];
  const dedup: number[] = [];
  const revalidation: number[] = [];
  let rejected = 0;
  let duplicates = 0;

  for (let i = 0; i < input.count; i += 1) {
    const tx =
      input.load === 'invalid'
        ? invalidTx(`inv:${i}`, 'alice')
        : nativeTransferTx(`mp:${input.load}:${i}`, 'alice', 'bob', 1n, 5_000n + BigInt(i % 17));
    const started = nowNs();
    const rejection = mempool.admit(tx);
    admission.push(elapsedNs(started));
    if (rejection) {
      rejected += 1;
    }
    const dupStarted = nowNs();
    const again = mempool.admit(tx);
    dedup.push(elapsedNs(dupStarted));
    if (again) {
      duplicates += 1;
    }
  }

  const selectStarted = nowNs();
  const selected = mempool.selectForBlock();
  selection.push(elapsedNs(selectStarted));

  const revalidateStarted = nowNs();
  const again = mempool.selectForBlock();
  revalidation.push(elapsedNs(revalidateStarted));

  const ordered = [...selected].sort(compareForSelection);
  const feeOrdered = selected.every((tx, index) => tx.transactionId === ordered[index]?.transactionId);

  return [
    caseResult('mempool', `${input.load}_admission`, {
      latency: summarizeLatency(admission),
      extras: { queueSize: mempool.size(), rejected, load: input.load },
    }),
    caseResult('mempool', `${input.load}_selection`, {
      latency: summarizeLatency(selection),
      extras: { selected: selected.length, feeOrdered, revalidateEqual: again.length === selected.length },
    }),
    caseResult('mempool', `${input.load}_dedup`, {
      latency: summarizeLatency(dedup),
      extras: { duplicates },
    }),
    caseResult('mempool', `${input.load}_revalidation`, {
      latency: summarizeLatency(revalidation),
    }),
  ];
}
