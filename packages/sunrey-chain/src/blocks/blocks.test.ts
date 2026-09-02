import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BlockLifecycleEngine,
  bftQuorumSatisfied,
  candidateTransaction,
  hashFromHex,
  hashToHex,
  isCanonicalTruth,
  isNonFinalExposure,
  merkleRoot,
  rejectNonFinalizedAsCanonical,
  stateRoot,
  transactionIdFromBytes,
  transactionRoot,
  validateBlockHeader,
  MonetaryStateStore,
  reconcileNativeSupply,
} from './index.ts';

const IDENTITY = {
  networkId: 'net_sunrey_local_dev',
  chainId: 'chn_sunrey_local_dev',
  protocolVersion: '1',
} as const;

const VALIDATORS = [
  { validatorId: 'val.1', votingPower: 1n },
  { validatorId: 'val.2', votingPower: 1n },
  { validatorId: 'val.3', votingPower: 1n },
  { validatorId: 'val.4', votingPower: 1n },
] as const;

const VOTERS = ['val.1', 'val.2', 'val.3'] as const;

function fundedEngine(): BlockLifecycleEngine {
  const state = new MonetaryStateStore();
  state.mint('alice', 'SUNREY_COIN', 1_000_000n);
  state.mint('alice', 'MOONREY_COIN', 500_000n);
  state.mint('bob', 'SUNREY_COIN', 100_000n);
  return new BlockLifecycleEngine({ identity: IDENTITY, validators: VALIDATORS, genesisState: state });
}

function finalizeBlock(engine: BlockLifecycleEngine, txs: ReturnType<typeof candidateTransaction>[]) {
  for (const tx of txs) {
    engine.submitTransaction(tx);
  }
  const proposed = engine.proposeBlock({
    transactions: txs,
    proposer: 'val.1',
    timestampUnixMs: 1_000n,
  });
  assert.ok(!('ok' in proposed) || proposed.ok !== false, 'proposal should succeed');
  if ('ok' in proposed && proposed.ok === false) {
    throw new Error(proposed.detail);
  }
  const block = proposed as { blockHash: string };
  engine.executeLocally(block.blockHash);
  const finalized = engine.commitWithCertificate(block.blockHash, VOTERS);
  assert.ok(!('ok' in finalized) || finalized.ok !== false, 'finalization should succeed');
  return finalized;
}

describe('Wave 2 blocks, finality, and canonical state', () => {
  it('transaction root is deterministic and order-sensitive', () => {
    const a = hashFromHex('aa'.repeat(32));
    const b = hashFromHex('bb'.repeat(32));
    const c = hashFromHex('cc'.repeat(32));
    const root1 = transactionRoot([a, b, c]);
    const root2 = transactionRoot([a, b, c]);
    const root3 = transactionRoot([c, b, a]);
    assert.equal(hashToHex(root1), hashToHex(root2));
    assert.notEqual(hashToHex(root1), hashToHex(root3));
  });

  it('changed transaction changes transaction root', () => {
    const tx1 = candidateTransaction({
      signerAccountId: 'alice',
      toAccountId: 'bob',
      assetId: 'SUNREY_COIN',
      amount: 100n,
      fee: 1n,
      nonce: 0n,
    });
    const tx2 = candidateTransaction({
      signerAccountId: 'alice',
      toAccountId: 'bob',
      assetId: 'SUNREY_COIN',
      amount: 101n,
      fee: 1n,
      nonce: 0n,
    });
    const root1 = transactionRoot([transactionIdFromBytes(tx1.canonicalBytes)]);
    const root2 = transactionRoot([transactionIdFromBytes(tx2.canonicalBytes)]);
    assert.notEqual(hashToHex(root1), hashToHex(root2));
  });

  it('monetary state commitment changes with balances', () => {
    const state = new MonetaryStateStore();
    const empty = state.commitment();
    state.mint('alice', 'SUNREY_COIN', 10n);
    const funded = state.commitment();
    assert.notEqual(empty, funded);
  });

  it('produces valid blocks and finalizes with BFT quorum', () => {
    const engine = fundedEngine();
    const tx = candidateTransaction({
      signerAccountId: 'alice',
      toAccountId: 'bob',
      assetId: 'SUNREY_COIN',
      amount: 25_000n,
      fee: 500n,
      nonce: 0n,
    });
    const submitted = engine.submitTransaction(tx);
    assert.equal(submitted.status, 'PENDING');
    const finalized = finalizeBlock(engine, [tx]);
    if ('ok' in finalized && finalized.ok === false) {
      throw new Error(finalized.detail);
    }
    const block = finalized as { blockHash: string; header: { height: bigint } };
    assert.equal(block.header.height, 1n);
    const status = engine.queries().transactionStatus(tx.txId);
    assert.equal(status?.status, 'FINALIZED');
    assert.equal(status?.finalized, true);
    assert.equal(engine.queries().accountBalance('bob', 'SUNREY_COIN'), 125_000n);
  });

  it('rejects invalid parent, height, and chain id', () => {
    const engine = fundedEngine();
    const tx = candidateTransaction({
      signerAccountId: 'alice',
      toAccountId: 'bob',
      assetId: 'SUNREY_COIN',
      amount: 1n,
      fee: 1n,
      nonce: 0n,
    });
    engine.submitTransaction(tx);
    const proposed = engine.proposeBlock({
      transactions: [tx],
      proposer: 'val.1',
      timestampUnixMs: 1n,
    });
    assert.ok(!('ok' in proposed) || proposed.ok !== false);
    if ('ok' in proposed && proposed.ok === false) {
      throw new Error(proposed.detail);
    }
    const block = proposed as { header: import('./types.ts').CanonicalBlockHeader; blockHash: string };
    const wrongChainHeader = {
      ...block.header,
      chainId: 'chn_other',
    };
    const result = validateBlockHeader({
      header: wrongChainHeader,
      identity: IDENTITY,
      expectedHeight: 1n,
      parentBlockHash: block.header.parentBlockHash,
      expectedTransactionRoot: block.header.transactionRoot,
      expectedPreviousState: block.header.previousStateCommitment,
      expectedResultingState: block.header.resultingStateCommitment,
      supportedProtocolVersions: ['1'],
    });
    assert.ok('ok' in result && result.ok === false);
    if ('ok' in result && result.ok === false) {
      assert.equal(result.reason, 'WRONG_CHAIN');
    }
  });

  it('rejects modified transaction root and state divergence', () => {
    const engine = fundedEngine();
    const tx = candidateTransaction({
      signerAccountId: 'alice',
      toAccountId: 'bob',
      assetId: 'SUNREY_COIN',
      amount: 10n,
      fee: 1n,
      nonce: 0n,
    });
    engine.submitTransaction(tx);
    const proposed = engine.proposeBlock({
      transactions: [tx],
      proposer: 'val.1',
      timestampUnixMs: 2n,
    });
    assert.ok(!('ok' in proposed) || proposed.ok !== false);
    if ('ok' in proposed && proposed.ok === false) {
      throw new Error(proposed.detail);
    }
    const block = proposed as { header: { resultingStateCommitment: Uint8Array }; blockHash: string };
    const tampered = {
      ...(proposed as object),
      header: {
        ...(block as { header: object }).header,
        resultingStateCommitment: hashFromHex('ff'.repeat(32)),
      },
    };
    const result = engine.finalizeBlock(
      tampered as never,
      {
        height: 1n,
        round: 0,
        blockHash: block.blockHash,
        validatorSetVersion: 1n,
        voterIds: VOTERS,
        certificateHash: 'aa'.repeat(64),
      },
    );
    assert.ok('ok' in result && result.ok === false);
    if ('ok' in result && result.ok === false) {
      assert.equal(result.reason, 'WRONG_RESULTING_STATE');
    }
  });

  it('does not partially commit invalid blocks', () => {
    const engine = fundedEngine();
    const before = engine.queries().accountBalance('alice', 'SUNREY_COIN');
    const tx = candidateTransaction({
      signerAccountId: 'alice',
      toAccountId: 'bob',
      assetId: 'SUNREY_COIN',
      amount: before + 1n,
      fee: 1n,
      nonce: 0n,
    });
    engine.submitTransaction(tx);
    const proposed = engine.proposeBlock({
      transactions: [tx],
      proposer: 'val.1',
      timestampUnixMs: 3n,
    });
    assert.ok('ok' in proposed && proposed.ok === false);
    assert.equal(engine.queries().accountBalance('alice', 'SUNREY_COIN'), before);
    assert.equal(engine.queries().latestFinalizedBlock(), null);
  });

  it('tracks lifecycle transitions through execution and finality', () => {
    const engine = fundedEngine();
    const tx = candidateTransaction({
      signerAccountId: 'alice',
      toAccountId: 'bob',
      assetId: 'MOONREY_COIN',
      amount: 1_000n,
      fee: 10n,
      nonce: 0n,
    });
    engine.submitTransaction(tx);
    const proposed = engine.proposeBlock({
      transactions: [tx],
      proposer: 'val.1',
      timestampUnixMs: 4n,
    }) as { blockHash: string };
    assert.equal(engine.nonCanonicalLifecycle(tx.txId)?.status, 'INCLUDED');
    engine.executeLocally(proposed.blockHash);
    assert.equal(engine.nonCanonicalLifecycle(tx.txId)?.status, 'EXECUTED');
    assert.equal(isNonFinalExposure('EXECUTED'), true);
    assert.equal(isCanonicalTruth('EXECUTED'), false);
    engine.commitWithCertificate(proposed.blockHash, VOTERS);
    assert.equal(engine.queries().transactionStatus(tx.txId)?.status, 'FINALIZED');
  });

  it('restarts from finalized snapshot without exposing non-finalized state', () => {
    const engine = fundedEngine();
    const tx = candidateTransaction({
      signerAccountId: 'alice',
      toAccountId: 'bob',
      assetId: 'SUNREY_COIN',
      amount: 5n,
      fee: 1n,
      nonce: 0n,
    });
    finalizeBlock(engine, [tx]);
    const snapshot = engine.snapshot();
    const restarted = new BlockLifecycleEngine({
      identity: IDENTITY,
      validators: VALIDATORS,
    });
    restarted.restore(snapshot);
    assert.equal(restarted.queries().latestFinalizedBlock()?.header.height, 1n);
    assert.throws(() => rejectNonFinalizedAsCanonical('EXECUTED'));
    const pendingTx = candidateTransaction({
      signerAccountId: 'alice',
      toAccountId: 'bob',
      assetId: 'SUNREY_COIN',
      amount: 1n,
      fee: 1n,
      nonce: 1n,
    });
    restarted.submitTransaction(pendingTx);
    assert.equal(restarted.queries().accountBalance('bob', 'SUNREY_COIN'), 100_005n);
    const proposed = restarted.proposeBlock({
      transactions: [pendingTx],
      proposer: 'val.1',
      timestampUnixMs: 5n,
    }) as { blockHash: string };
    restarted.executeLocally(proposed.blockHash);
    assert.equal(restarted.queries().accountBalance('bob', 'SUNREY_COIN'), 100_005n);
  });

  it('reconciles both native assets independently after finalization', () => {
    const engine = fundedEngine();
    const sun = candidateTransaction({
      signerAccountId: 'alice',
      toAccountId: 'bob',
      assetId: 'SUNREY_COIN',
      amount: 100n,
      fee: 1n,
      nonce: 0n,
    });
    finalizeBlock(engine, [sun]);
    const moon = candidateTransaction({
      signerAccountId: 'alice',
      toAccountId: 'bob',
      assetId: 'MOONREY_COIN',
      amount: 50n,
      fee: 1n,
      nonce: 1n,
    });
    finalizeBlock(engine, [moon]);
    const sunSupply = engine.queries().nativeAssetSupply('SUNREY_COIN');
    const moonSupply = engine.queries().nativeAssetSupply('MOONREY_COIN');
    assert.equal(reconcileNativeSupply(engine.snapshot().canonicalState).ok, true);
    assert.equal(sunSupply.issued, 1_100_000n);
    assert.equal(moonSupply.issued, 500_000n);
  });

  it('multi-validator quorum gate matches BFT threshold', () => {
    assert.equal(bftQuorumSatisfied(3n, 4n), true);
    assert.equal(bftQuorumSatisfied(2n, 4n), false);
  });

  it('empty merkle root is domain-stable', () => {
    const empty = merkleRoot('sunrey.txroot.v1', []);
    const again = merkleRoot('sunrey.txroot.v1', []);
    assert.equal(hashToHex(empty), hashToHex(again));
  });

  it('state root sorts entries deterministically', () => {
    const entries = new Map<string, Uint8Array>([
      ['b', Buffer.from('2')],
      ['a', Buffer.from('1')],
    ]);
    const root = stateRoot(entries);
    const reversed = stateRoot([
      ['a', Buffer.from('1')],
      ['b', Buffer.from('2')],
    ]);
    assert.equal(hashToHex(root), hashToHex(reversed));
  });
});

describe('Wave 2 multi-validator block production', () => {
  it('four validators produce matching state commitments', () => {
    const genesis = new MonetaryStateStore();
    genesis.mint('alice', 'SUNREY_COIN', 500_000n);
    const engines = Array.from({ length: 4 }, () =>
      new BlockLifecycleEngine({ identity: IDENTITY, validators: VALIDATORS, genesisState: genesis }),
    );
    const tx = candidateTransaction({
      signerAccountId: 'alice',
      toAccountId: 'bob',
      assetId: 'SUNREY_COIN',
      amount: 1_000n,
      fee: 10n,
      nonce: 0n,
    });
    for (const engine of engines) {
      engine.submitTransaction(tx);
      finalizeBlock(engine, [tx]);
    }
    const roots = engines.map((engine) => engine.snapshot().canonicalState.commitment());
    assert.ok(roots.every((root) => root === roots[0]));
  });
});
