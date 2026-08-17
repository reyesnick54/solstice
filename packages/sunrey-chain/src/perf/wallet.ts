import { PROTOCOL_NETWORK_ID } from '../protocol/constants.ts';
import { WalletEngine } from '../wallet/engine.ts';
import { isWalletRejection } from '../wallet/types.ts';
import { caseResult } from './result.ts';
import { elapsedNs, nowNs, summarizeLatency } from './statistics.ts';
import type { BenchCaseResult } from './types.ts';

export function measureWalletSdk(input: { readonly transfers: number }): readonly BenchCaseResult[] {
  const engine = new WalletEngine({ networkId: PROTOCOL_NETWORK_ID });
  engine.unlock('development-passphrase');
  engine.createWallet({
    walletId: 'alice',
    ownerActorId: 'actor.alice',
    walletType: 'HUMAN',
    signerLabels: ['alice.primary'],
  });
  engine.createWallet({
    walletId: 'bob',
    ownerActorId: 'actor.bob',
    walletType: 'HUMAN',
    signerLabels: ['bob.primary'],
  });
  const alice = engine.getAccount('bca.alice');
  const bob = engine.getAccount('bca.bob');
  if (!alice || !bob) {
    throw new Error('wallet accounts missing');
  }
  engine.faucet(alice.accountId, 10_000_000n);

  const build: number[] = [];
  const fee: number[] = [];
  const sign: number[] = [];
  const submit: number[] = [];
  const finality: number[] = [];
  for (let i = 0; i < input.transfers; i += 1) {
    const buildStarted = nowNs();
    const built = engine.buildTransfer({
      walletId: 'alice',
      toAccountId: bob.accountId,
      toAddressText: bob.address.text,
      amount: 10n,
      maxFee: 2_000n,
    });
    build.push(elapsedNs(buildStarted));
    if (isWalletRejection(built)) {
      throw new Error(built.detail);
    }
    const feeStarted = nowNs();
    const estimated = built.fee.estimatedFee;
    fee.push(elapsedNs(feeStarted));
    if (estimated <= 0n) {
      throw new Error('fee estimate missing');
    }
    const signStarted = nowNs();
    const signed = engine.sign({ walletId: 'alice', built, keyIds: ['alice.key.1'] });
    sign.push(elapsedNs(signStarted));
    if (isWalletRejection(signed)) {
      throw new Error(signed.detail);
    }
    const submitStarted = nowNs();
    const submitted = engine.submit({ walletId: 'alice', built, signatures: signed.signatures });
    submit.push(elapsedNs(submitStarted));
    if (isWalletRejection(submitted)) {
      throw new Error(submitted.detail);
    }
    const finalityStarted = nowNs();
    if (submitted.height < 1) {
      throw new Error('wallet submit did not finalize');
    }
    finality.push(elapsedNs(finalityStarted));
  }

  return [
    caseResult('wallet', 'transaction_build', { latency: summarizeLatency(build) }),
    caseResult('wallet', 'fee_estimate_local', { latency: summarizeLatency(fee), extras: { separatedFromRpc: true } }),
    caseResult('wallet', 'local_sign', { latency: summarizeLatency(sign), extras: { separatedFromRpc: true } }),
    caseResult('wallet', 'submit', { latency: summarizeLatency(submit) }),
    caseResult('wallet', 'finality_subscription', { latency: summarizeLatency(finality) }),
  ];
}
