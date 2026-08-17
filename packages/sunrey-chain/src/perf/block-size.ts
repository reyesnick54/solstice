import { FeeEngine } from '../fees/engine.ts';
import { FeeMempool } from '../fees/mempool.ts';
import { developmentBlockLimits } from '../fees/policy.ts';
import { validatorDescriptors } from './consensus.ts';
import { caseResult } from './result.ts';
import { elapsedNs, nowNs, summarizeThroughput } from './statistics.ts';
import type { BenchCaseResult } from './types.ts';
import { nativeTransferTx } from './workload.ts';

/**
 * Candidate resource-limit study. Does not change protocol defaults.
 */
export function studyBlockResourceCandidates(): {
  readonly cases: readonly BenchCaseResult[];
  readonly recommendation: string;
} {
  const defaults = developmentBlockLimits();
  const candidates = [
    { maxBytes: defaults.maxBytes / 2n, maxExecutionUnits: defaults.maxExecutionUnits / 2n, maxTx: 8 },
    { maxBytes: defaults.maxBytes, maxExecutionUnits: defaults.maxExecutionUnits, maxTx: 16 },
    { maxBytes: defaults.maxBytes * 2n, maxExecutionUnits: defaults.maxExecutionUnits * 2n, maxTx: 32 },
  ];
  const cases: BenchCaseResult[] = [];
  let best = { finalized: 0, label: 'default' };
  for (const [index, candidate] of candidates.entries()) {
    const engine = new FeeEngine();
    engine.limits = {
      ...defaults,
      maxBytes: candidate.maxBytes,
      maxExecutionUnits: candidate.maxExecutionUnits,
    };
    engine.faucet('alice', 50_000_000n);
    const mempool = new FeeMempool(engine);
    for (let i = 0; i < 64; i += 1) {
      mempool.admit(nativeTransferTx(`limit:${index}:${i}`, 'alice', 'bob', 1n));
    }
    const started = nowNs();
    const selected = mempool.selectForBlock(engine.limits).slice(0, candidate.maxTx);
    engine.activateAt(1);
    let finalized = 0;
    for (const tx of selected) {
      const executed = engine.execute({
        tx,
        blockHeight: 1,
        blockId: 'blk_study',
        proposerId: validatorDescriptors(4)[0]!.validatorId,
        validators: validatorDescriptors(4),
      });
      if (executed.ok) {
        finalized += 1;
      }
    }
    const durationNs = elapsedNs(started);
    const label = `bytes_${candidate.maxBytes.toString()}_units_${candidate.maxExecutionUnits.toString()}_txcap_${candidate.maxTx}`;
    if (finalized > best.finalized) {
      best = { finalized, label };
    }
    cases.push(
      caseResult('block_limits', label, {
        throughput: summarizeThroughput({
          submitted: 64,
          accepted: selected.length,
          finalized,
          rejected: 64 - finalized,
          durationMs: durationNs / 1_000_000,
        }),
        extras: {
          defaultUnchanged: true,
          recommendationOnly: true,
          maxBytes: candidate.maxBytes.toString(),
          maxExecutionUnits: candidate.maxExecutionUnits.toString(),
          maxTransactionCountCandidate: candidate.maxTx,
        },
      }),
    );
  }
  return {
    cases,
    recommendation: `Keep current development defaults. Fastest candidate in this host run was ${best.label}. Do not change protocol defaults solely because a candidate is faster.`,
  };
}
