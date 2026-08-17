import { FeeEngine } from '../fees/engine.ts';
import { FeeMempool } from '../fees/mempool.ts';
import { transferTx, txId } from '../fees/demo-helpers.ts';
import { estimateFeeV2, usageV2ForTransaction, developmentFeePolicyV2 } from '../fees/v2/index.ts';
import { caseResult } from './result.ts';
import { elapsedNs, nowNs, summarizeLatency } from './statistics.ts';
import type { BenchCaseResult } from './types.ts';

/**
 * Engineering measurements for FeePolicyV2. Not a production guarantee.
 */
export function measureFeePolicyV2(count = 32): readonly BenchCaseResult[] {
  const engine = new FeeEngine();
  engine.faucet('alice', 100_000_000n);
  engine.activateFeePolicyV2();
  const mempool = new FeeMempool(engine);
  const meter: number[] = [];
  const quote: number[] = [];
  const select: number[] = [];
  const process: number[] = [];
  const pq: number[] = [];
  const policy = developmentFeePolicyV2();

  for (let i = 0; i < count; i += 1) {
    const tx = {
      ...transferTx(txId(`perf-v2-${i}`), 'alice', 'bob', 1n, 500_000n),
      policyVersion: 2 as const,
      signatureClass: i % 4 === 0 ? ('PQ' as const) : ('CLASSICAL' as const),
    };
    const meterStarted = nowNs();
    usageV2ForTransaction(tx);
    meter.push(elapsedNs(meterStarted));
    const quoteStarted = nowNs();
    estimateFeeV2(policy, tx, engine.priceState.baseResourcePrice);
    quote.push(elapsedNs(quoteStarted));
    mempool.admit(tx);
    if (tx.signatureClass === 'PQ') {
      const pqStarted = nowNs();
      usageV2ForTransaction(tx);
      pq.push(elapsedNs(pqStarted));
    }
  }
  const selectStarted = nowNs();
  const selected = mempool.selectForBlock();
  select.push(elapsedNs(selectStarted));
  const processStarted = nowNs();
  for (const tx of selected.slice(0, 8)) {
    engine.execute({
      tx,
      blockHeight: 1,
      blockId: 'perf',
      proposerId: 'val_a',
      validators: [{ validatorId: 'val_a', votingPower: 1n }],
    });
  }
  process.push(elapsedNs(processStarted));

  return [
    caseResult('fees', 'v2_metering', {
      latency: summarizeLatency(meter),
      extras: { classification: 'ENGINEERING_MEASUREMENT', platform: process.platform },
    }),
    caseResult('fees', 'v2_calculation', {
      latency: summarizeLatency(quote),
      extras: { classification: 'ENGINEERING_MEASUREMENT' },
    }),
    caseResult('fees', 'v2_mempool_selection', {
      latency: summarizeLatency(select),
      extras: { classification: 'ENGINEERING_MEASUREMENT', selected: selected.length },
    }),
    caseResult('fees', 'v2_block_processing', {
      latency: summarizeLatency(process),
      extras: { classification: 'ENGINEERING_MEASUREMENT' },
    }),
    caseResult('fees', 'v2_pq_heavy', {
      latency: summarizeLatency(pq.length > 0 ? pq : [0]),
      extras: { classification: 'ENGINEERING_MEASUREMENT', note: 'deterministic PQ class cost' },
    }),
  ];
}
