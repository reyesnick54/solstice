import { createHash } from 'node:crypto';

import { SimulationNativeCustodyChain } from '../native-custody/simulation.ts';
import { caseResult } from './result.ts';
import { elapsedNs, nowNs, summarizeLatency } from './statistics.ts';
import type { BenchCaseResult } from './types.ts';

/**
 * Operational custody latency excluding human approval wait.
 */
export function measureCustodyWorkflow(input: { readonly deposits: number }): readonly BenchCaseResult[] {
  const chain = new SimulationNativeCustodyChain();
  const deposit: number[] = [];
  const policy: number[] = [];
  const preview: number[] = [];
  const signer: number[] = [];
  const submit: number[] = [];
  const reconcile: number[] = [];
  const vault = chain.addressFromPublicKey('11'.repeat(32));
  const destination = chain.addressFromPublicKey('22'.repeat(32));

  for (let i = 0; i < input.deposits; i += 1) {
    const depositStarted = nowNs();
    chain.fundDevelopment(vault, 1_000n);
    deposit.push(elapsedNs(depositStarted));

    const policyStarted = nowNs();
    const holding = chain.holding(vault, 'SUNREY_COIN');
    const allowed = holding >= 100n;
    policy.push(elapsedNs(policyStarted));
    if (!allowed) {
      throw new Error('custody policy evaluation refused a funded vault');
    }

    const previewStarted = nowNs();
    const canonical = Buffer.from(`preview:${vault}:${destination}:50:${i}`, 'utf8');
    const previewHash = createHash('sha256').update(canonical).digest('hex');
    preview.push(elapsedNs(previewStarted));

    const signerStarted = nowNs();
    const signatureHex = createHash('sha256').update(`sign:${previewHash}`).digest('hex');
    signer.push(elapsedNs(signerStarted));

    const submitStarted = nowNs();
    const submitted = chain.submit({
      txId: createHash('sha256').update(`tx:${i}:${previewHash}`).digest('hex'),
      source: vault,
      destination,
      assetId: 'SUNREY_COIN',
      quantity: 50n,
      feeAssetId: 'SUNREY_COIN',
      maxFee: 0n,
      nonce: BigInt(i),
      networkId: chain.networkId,
      chainId: chain.chainId,
      canonicalBytesHex: canonical.toString('hex'),
      previewHash,
      signatureHex,
      signerPublicKeyHex: '11'.repeat(32),
      suiteId: 'sunrey-ed25519-v1',
    });
    chain.finalizeNextBlock();
    submit.push(elapsedNs(submitStarted));
    if (submitted.kind !== 'SUBMITTED') {
      throw new Error('custody chain submission failed');
    }

    const reconcileStarted = nowNs();
    const after = chain.holding(vault, 'SUNREY_COIN') + chain.holding(destination, 'SUNREY_COIN');
    reconcile.push(elapsedNs(reconcileStarted));
    if (after < 50n) {
      throw new Error('custody holdings failed to reconcile');
    }
  }

  return [
    caseResult('custody', 'deposit_indexing', { latency: summarizeLatency(deposit) }),
    caseResult('custody', 'policy_evaluation', { latency: summarizeLatency(policy), extras: { excludesHumanApproval: true } }),
    caseResult('custody', 'transaction_preview', { latency: summarizeLatency(preview) }),
    caseResult('custody', 'signer_request', { latency: summarizeLatency(signer), extras: { excludesHumanApproval: true } }),
    caseResult('custody', 'chain_submission', { latency: summarizeLatency(submit) }),
    caseResult('custody', 'reconciliation', { latency: summarizeLatency(reconcile) }),
  ];
}
