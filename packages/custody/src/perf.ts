import { SimulationNativeCustodyChain } from '../../sunrey-chain/src/native-custody/simulation.ts';

export type CustodyPerfCase = {
  readonly name: string;
  readonly suite: 'custody';
  readonly cryptoLabeledSeparately: false;
  readonly extras: Readonly<Record<string, string | number | boolean>>;
  readonly latency?: {
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
};

function summarize(samples: readonly number[]) {
  const sorted = [...samples].sort((left, right) => left - right);
  const count = sorted.length;
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  const mean = count === 0 ? 0 : sum / count;
  const pick = (p: number) => (count === 0 ? 0 : sorted[Math.max(0, Math.ceil((p / 100) * count) - 1)] ?? 0);
  const variance = count === 0 ? 0 : sorted.reduce((acc, value) => acc + (value - mean) ** 2, 0) / count;
  return {
    count,
    minNs: sorted[0] ?? 0,
    maxNs: sorted[count - 1] ?? 0,
    meanNs: mean,
    medianNs: pick(50),
    p50Ns: pick(50),
    p95Ns: pick(95),
    p99Ns: pick(99),
    stddevNs: Math.sqrt(variance),
  };
}

export function measureCustody(input: { readonly deposits: number }): readonly CustodyPerfCase[] {
  const chain = new SimulationNativeCustodyChain();
  const vault = chain.addressFromPublicKey('aa'.repeat(32));
  const samples: number[] = [];
  for (let i = 0; i < input.deposits; i += 1) {
    const started = process.hrtime.bigint();
    chain.fundDevelopment(vault, 250n);
    const holding = chain.holding(vault, 'SUNREY_COIN');
    if (holding < 250n) {
      throw new Error('custody development deposit did not index');
    }
    samples.push(Number(process.hrtime.bigint() - started));
  }
  return [
    {
      suite: 'custody',
      name: 'deposit_index_and_holding',
      cryptoLabeledSeparately: false,
      latency: summarize(samples),
      extras: { excludesHumanApproval: true, mismatch: 0 },
    },
  ];
}
