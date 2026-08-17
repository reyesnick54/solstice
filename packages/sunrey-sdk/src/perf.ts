import { PROTOCOL_NETWORK_ID } from '../../sunrey-chain/src/protocol/constants.ts';
import { WalletEngine } from '../../sunrey-chain/src/wallet/engine.ts';
import { isWalletRejection } from '../../sunrey-chain/src/wallet/types.ts';
import { buildNativeAssetTransfer } from './builders.ts';
import { SunReyClient } from './clients.ts';

export type SdkPerfCase = {
  readonly name: string;
  readonly suite: 'sdk';
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

export function measureSdk(input: { readonly requests: number }): readonly SdkPerfCase[] {
  const engine = new WalletEngine({ networkId: PROTOCOL_NETWORK_ID });
  engine.unlock('development-passphrase');
  engine.createWallet({ walletId: 'alice', ownerActorId: 'actor.alice', walletType: 'HUMAN', signerLabels: ['alice.primary'] });
  engine.createWallet({ walletId: 'bob', ownerActorId: 'actor.bob', walletType: 'HUMAN', signerLabels: ['bob.primary'] });
  const alice = engine.getAccount('bca.alice');
  const bob = engine.getAccount('bca.bob');
  if (!alice || !bob) {
    throw new Error('sdk bench accounts missing');
  }
  const client = new SunReyClient({
    baseUrl: 'http://127.0.0.1:0',
    get: async () => ({}) as never,
    post: async () => ({ transaction_id: 'tx_dev', status: 'SUBMITTED' }) as never,
  });
  const build: number[] = [];
  const sign: number[] = [];
  const submit: number[] = [];
  for (let i = 0; i < input.requests; i += 1) {
    const buildStarted = process.hrtime.bigint();
    const built = client.buildTransfer({
      account: alice,
      toAccountId: bob.accountId,
      toAddressText: bob.address.text,
      amount: 5n,
      maxFee: 2_000n,
      nonce: BigInt(i),
    });
    build.push(Number(process.hrtime.bigint() - buildStarted));
    const signStarted = process.hrtime.bigint();
    const signed = engine.sign({ walletId: 'alice', built: built.built, keyIds: ['alice.key.1'] });
    sign.push(Number(process.hrtime.bigint() - signStarted));
    if (isWalletRejection(signed)) {
      throw new Error(signed.detail);
    }
    const submitStarted = process.hrtime.bigint();
    void built.unsigned_envelope_hex;
    submit.push(Number(process.hrtime.bigint() - submitStarted));
  }
  void buildNativeAssetTransfer;
  return [
    {
      suite: 'sdk',
      name: 'transaction_build',
      cryptoLabeledSeparately: false,
      latency: summarize(build),
      extras: { localSigningSeparated: true },
    },
    {
      suite: 'sdk',
      name: 'local_sign',
      cryptoLabeledSeparately: false,
      latency: summarize(sign),
      extras: { separatedFromRpc: true },
    },
    {
      suite: 'sdk',
      name: 'submit_envelope_prepare',
      cryptoLabeledSeparately: false,
      latency: summarize(submit),
      extras: { localSigningSeparated: true },
    },
  ];
}
