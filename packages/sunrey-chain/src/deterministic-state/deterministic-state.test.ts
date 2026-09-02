import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { developmentMoonReyAuthority, developmentSunReyAuthority } from '../economics/issuance.ts';
import { transfer } from '../economics/operations.ts';
import { ProtocolNativeSupplyAuthority } from '../native-assets/economic-controls.ts';
import {
  applyTransaction,
  applyTransactions,
  assertCanonicalStateReconciles,
  bookFromCanonical,
  bookToCanonical,
  createGenesisState,
  decodeCanonicalState,
  encodeCanonicalState,
  monetaryStateRoot,
  reconcileCanonicalState,
  simulationMonetaryStateRoot,
  type CanonicalProtocolState,
  type ValidatedNativeTransaction,
} from './index.ts';

function issueTx(input: {
  readonly account: string;
  readonly nonce: bigint;
  readonly transactionId: string;
  readonly quantity: bigint;
  readonly recipient?: string;
  readonly replayIdentifier: string;
  readonly assetId?: 'SUNREY_COIN' | 'MOONREY_COIN';
}): ValidatedNativeTransaction {
  const assetId = input.assetId ?? 'SUNREY_COIN';
  const authority =
    assetId === 'SUNREY_COIN'
      ? developmentSunReyAuthority({
          recipient: input.recipient ?? input.account,
          quantity: input.quantity,
          replayIdentifier: input.replayIdentifier,
        })
      : developmentMoonReyAuthority({
          recipient: input.recipient ?? input.account,
          quantity: input.quantity,
          replayIdentifier: input.replayIdentifier,
          contributionId: `contrib.${input.replayIdentifier}`,
          fingerprint: `fp.${input.replayIdentifier}`,
          authorizationId: `auth.${input.replayIdentifier}`,
        });
  return Object.freeze({
    transactionId: input.transactionId,
    account: input.account,
    nonce: input.nonce,
    operation: 'ISSUE',
    assetId,
    quantity: input.quantity,
    issuanceAuthority: authority,
    actor: 'PROTOCOL',
  });
}

function transferTx(input: {
  readonly account: string;
  readonly counterparty: string;
  readonly nonce: bigint;
  readonly transactionId: string;
  readonly quantity: bigint;
  readonly assetId?: 'SUNREY_COIN' | 'MOONREY_COIN';
}): ValidatedNativeTransaction {
  return Object.freeze({
    transactionId: input.transactionId,
    account: input.account,
    nonce: input.nonce,
    operation: 'TRANSFER',
    assetId: input.assetId ?? 'SUNREY_COIN',
    quantity: input.quantity,
    counterparty: input.counterparty,
  });
}

function burnTx(input: {
  readonly account: string;
  readonly nonce: bigint;
  readonly transactionId: string;
  readonly quantity: bigint;
  readonly replayIdentifier: string;
  readonly assetId?: 'SUNREY_COIN' | 'MOONREY_COIN';
}): ValidatedNativeTransaction {
  return Object.freeze({
    transactionId: input.transactionId,
    account: input.account,
    nonce: input.nonce,
    operation: 'BURN',
    assetId: input.assetId ?? 'SUNREY_COIN',
    quantity: input.quantity,
    burnClass: 'VOLUNTARY_USER_BURN',
    replayIdentifier: input.replayIdentifier,
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
  });
}

describe('deterministic canonical protocol state', () => {
  it('genesis state reconciles and hashes deterministically', () => {
    const left = createGenesisState();
    const right = createGenesisState();
    assert.deepEqual(encodeCanonicalState(left), encodeCanonicalState(right));
    assert.equal(monetaryStateRoot(left), monetaryStateRoot(right));
    assert.equal(simulationMonetaryStateRoot(left), monetaryStateRoot(left));
    assertCanonicalStateReconciles(left);
  });

  it('identical genesis + identical transactions = identical state', () => {
    const genesis = createGenesisState();
    const txs = [
      issueTx({
        account: 'acct_alice',
        nonce: 1n,
        transactionId: 'tx.issue.1',
        quantity: 1_000n,
        replayIdentifier: 'iss.1',
      }),
      transferTx({
        account: 'acct_alice',
        counterparty: 'acct_bob',
        nonce: 2n,
        transactionId: 'tx.xfer.1',
        quantity: 250n,
      }),
      burnTx({
        account: 'acct_bob',
        nonce: 1n,
        transactionId: 'tx.burn.1',
        quantity: 50n,
        replayIdentifier: 'burn.1',
      }),
    ];
    const pathA = applyTransactions(genesis, txs);
    const pathB = applyTransactions(genesis, txs);
    assert.equal(pathA.ok, true);
    assert.equal(pathB.ok, true);
    if (pathA.ok && pathB.ok) {
      assert.deepEqual(encodeCanonicalState(pathA.next), encodeCanonicalState(pathB.next));
      assert.equal(monetaryStateRoot(pathA.next), monetaryStateRoot(pathB.next));
    }
  });

  it('identical state serializes and hashes identically', () => {
    const genesis = createGenesisState();
    const issued = applyTransaction(
      genesis,
      issueTx({
        account: 'acct_a',
        nonce: 1n,
        transactionId: 'tx.1',
        quantity: 500n,
        replayIdentifier: 'iss.a',
      }),
    );
    assert.equal(issued.ok, true);
    if (!issued.ok) {
      return;
    }
    const encoded = encodeCanonicalState(issued.next);
    const decoded = decodeCanonicalState(encoded);
    assert.deepEqual(encoded, encodeCanonicalState(decoded));
    assert.equal(monetaryStateRoot(issued.next), monetaryStateRoot(decoded));
  });

  it('rejects transaction replay', () => {
    const genesis = createGenesisState();
    const tx = issueTx({
      account: 'acct_a',
      nonce: 1n,
      transactionId: 'tx.replay',
      quantity: 100n,
      replayIdentifier: 'iss.replay',
    });
    const first = applyTransaction(genesis, tx);
    assert.equal(first.ok, true);
    if (!first.ok) {
      return;
    }
    const second = applyTransaction(first.next, tx);
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.code, 'REPLAY_TRANSACTION');
    }
  });

  it('rejects issuance authorization replay', () => {
    const genesis = createGenesisState();
    const authority = developmentSunReyAuthority({
      recipient: 'acct_a',
      quantity: 100n,
      replayIdentifier: 'iss.same',
    });
    const tx1 = Object.freeze({
      transactionId: 'tx.iss.1',
      account: 'acct_a',
      nonce: 1n,
      operation: 'ISSUE' as const,
      assetId: 'SUNREY_COIN' as const,
      quantity: 100n,
      issuanceAuthority: authority,
      actor: 'PROTOCOL' as const,
    });
    const tx2 = Object.freeze({
      ...tx1,
      transactionId: 'tx.iss.2',
      nonce: 2n,
    });
    const first = applyTransaction(genesis, tx1);
    assert.equal(first.ok, true);
    if (!first.ok) {
      return;
    }
    const second = applyTransaction(first.next, tx2);
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.code, 'REPLAY_ISSUANCE');
    }
  });

  it('invalid transaction causes zero state mutation', () => {
    const genesis = createGenesisState();
    const beforeBytes = encodeCanonicalState(genesis);
    const beforeRoot = monetaryStateRoot(genesis);
    const invalid = applyTransaction(
      genesis,
      transferTx({
        account: 'acct_missing',
        counterparty: 'acct_bob',
        nonce: 1n,
        transactionId: 'tx.fail',
        quantity: 1n,
      }),
    );
    assert.equal(invalid.ok, false);
    assert.deepEqual(encodeCanonicalState(genesis), beforeBytes);
    assert.equal(monetaryStateRoot(genesis), beforeRoot);
  });

  it('transfer conserves total supply', () => {
    let state: CanonicalProtocolState = createGenesisState();
    const issue = applyTransaction(
      state,
      issueTx({
        account: 'acct_a',
        nonce: 1n,
        transactionId: 'tx.issue',
        quantity: 1_000n,
        replayIdentifier: 'iss.conservation',
      }),
    );
    assert.equal(issue.ok, true);
    if (!issue.ok) {
      return;
    }
    state = issue.next;
    const before = state.supplies[0].circulating;
    const xfer = applyTransaction(
      state,
      transferTx({
        account: 'acct_a',
        counterparty: 'acct_b',
        nonce: 2n,
        transactionId: 'tx.xfer',
        quantity: 400n,
      }),
    );
    assert.equal(xfer.ok, true);
    if (!xfer.ok) {
      return;
    }
    assert.equal(xfer.next.supplies[0].circulating, before);
  });

  it('burn conserves supply identity', () => {
    let state: CanonicalProtocolState = createGenesisState();
    const issue = applyTransaction(
      state,
      issueTx({
        account: 'acct_a',
        nonce: 1n,
        transactionId: 'tx.issue',
        quantity: 1_000n,
        replayIdentifier: 'iss.burn',
      }),
    );
    assert.equal(issue.ok, true);
    if (!issue.ok) {
      return;
    }
    state = issue.next;
    const beforeTotal =
      state.supplies[0].genesisAllocated +
      state.supplies[0].issuedPostGenesis -
      state.supplies[0].burned;
    const burned = applyTransaction(
      state,
      burnTx({
        account: 'acct_a',
        nonce: 2n,
        transactionId: 'tx.burn',
        quantity: 200n,
        replayIdentifier: 'burn.conservation',
      }),
    );
    assert.equal(burned.ok, true);
    if (!burned.ok) {
      return;
    }
    const after = burned.next.supplies[0];
    const afterTotal = after.genesisAllocated + after.issuedPostGenesis - after.burned;
    assert.equal(after.burned, 200n);
    assert.equal(afterTotal, beforeTotal - 200n);
    assert.equal(after.circulating + after.locked + after.escrowed + after.feeReserved, afterTotal);
  });

  it('issuance conserves supply identity', () => {
    const genesis = createGenesisState();
    const issued = applyTransaction(
      genesis,
      issueTx({
        account: 'acct_a',
        nonce: 1n,
        transactionId: 'tx.issue',
        quantity: 777n,
        replayIdentifier: 'iss.identity',
      }),
    );
    assert.equal(issued.ok, true);
    if (!issued.ok) {
      return;
    }
    const supply = issued.next.supplies[0];
    assert.equal(supply.issuedPostGenesis, 777n);
    assert.equal(supply.circulating, 777n);
    assert.equal(
      supply.genesisAllocated + supply.issuedPostGenesis - supply.burned,
      supply.circulating + supply.locked + supply.escrowed + supply.feeReserved,
    );
  });

  it('isolates SunRey and MoonRey balances', () => {
    const genesis = createGenesisState();
    const sunrey = applyTransaction(
      genesis,
      issueTx({
        account: 'acct_a',
        nonce: 1n,
        transactionId: 'tx.sunrey',
        quantity: 100n,
        replayIdentifier: 'iss.sunrey',
        assetId: 'SUNREY_COIN',
      }),
    );
    assert.equal(sunrey.ok, true);
    if (!sunrey.ok) {
      return;
    }
    const moonrey = applyTransaction(
      sunrey.next,
      issueTx({
        account: 'acct_a',
        nonce: 2n,
        transactionId: 'tx.moonrey',
        quantity: 50n,
        replayIdentifier: 'iss.moonrey',
        assetId: 'MOONREY_COIN',
      }),
    );
    assert.equal(moonrey.ok, true);
    if (!moonrey.ok) {
      return;
    }
    assert.equal(moonrey.next.supplies[0].circulating, 100n);
    assert.equal(moonrey.next.supplies[1].circulating, 50n);
    const crossAsset = applyTransaction(
      moonrey.next,
      transferTx({
        account: 'acct_a',
        counterparty: 'acct_b',
        nonce: 3n,
        transactionId: 'tx.cross',
        quantity: 10n,
        assetId: 'MOONREY_COIN',
      }),
    );
    assert.equal(crossAsset.ok, true);
    if (!crossAsset.ok) {
      return;
    }
    assert.equal(crossAsset.next.supplies[0].circulating, 100n);
    assert.equal(crossAsset.next.supplies[1].circulating, 50n);
  });

  it('reconstructs authority state after process restart', () => {
    const authority = new ProtocolNativeSupplyAuthority();
    const issued = authority.applyIssuance({
      actor: 'PROTOCOL',
      authority: developmentSunReyAuthority({
        recipient: 'acct_restart',
        quantity: 321n,
        replayIdentifier: 'iss.restart',
      }),
    });
    assert.equal(issued.ok, true);
    const canonical = authority.toCanonicalState({
      height: 1n,
      executedTransactionIds: ['tx.restart'],
      executedIssuanceAuthorizationIds: ['mia.sunrey.iss.restart'],
      accountNonces: Object.freeze([{ account: 'acct_restart', nonce: 1n }]),
    });
    const encoded = encodeCanonicalState(canonical);
    const decoded = decodeCanonicalState(encoded);
    const restored = ProtocolNativeSupplyAuthority.fromCanonicalState(decoded);
    assert.equal(restored.book('SUNREY_COIN').circulating, 321n);
    assert.equal(restored.invariantReport().ok, true);
    assert.equal(monetaryStateRoot(canonical), monetaryStateRoot(decoded));
  });

  it('transaction ordering is deterministic', () => {
    const genesis = createGenesisState();
    const issue = issueTx({
      account: 'acct_a',
      nonce: 1n,
      transactionId: 'tx.1',
      quantity: 100n,
      replayIdentifier: 'iss.order',
    });
    const transfer = transferTx({
      account: 'acct_a',
      counterparty: 'acct_b',
      nonce: 2n,
      transactionId: 'tx.2',
      quantity: 60n,
    });
    const ordered = [issue, transfer];
    const reversed = [transfer, issue];
    const forward = applyTransactions(genesis, ordered);
    const backward = applyTransactions(genesis, reversed);
    assert.equal(forward.ok, true);
    assert.notEqual(backward.ok, true);
    if (forward.ok) {
      assertCanonicalStateReconciles(forward.next);
    }
  });

  it('book round-trip preserves supply invariants', () => {
    const authority = new ProtocolNativeSupplyAuthority();
    authority.applyIssuance({
      actor: 'PROTOCOL',
      authority: developmentSunReyAuthority({
        recipient: 'acct_roundtrip',
        quantity: 999n,
        replayIdentifier: 'iss.roundtrip',
      }),
    });
    const book = authority.book('SUNREY_COIN');
    const canonical = bookToCanonical(book);
    const restored = bookFromCanonical(canonical);
    assert.equal(restored.circulating, 999n);
    assert.equal(reconcileCanonicalState(authority.toCanonicalState()).ok, true);
  });

  it('rejects forbidden supply actor', () => {
    const genesis = createGenesisState();
    const tx = Object.freeze({
      transactionId: 'tx.agent',
      account: 'acct_a',
      nonce: 1n,
      operation: 'ISSUE' as const,
      assetId: 'SUNREY_COIN' as const,
      quantity: 10n,
      issuanceAuthority: developmentSunReyAuthority({
        recipient: 'acct_a',
        quantity: 10n,
        replayIdentifier: 'iss.agent',
      }),
      actor: 'AGENT' as const,
    });
    const result = applyTransaction(genesis, tx);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'UNAUTHORIZED_ACTOR');
    }
  });

  it('property: repeated reconcile stays ok on valid states', () => {
    const genesis = createGenesisState();
    const txs = [
      issueTx({
        account: 'acct_prop',
        nonce: 1n,
        transactionId: 'tx.p.1',
        quantity: 10n,
        replayIdentifier: 'iss.p.1',
      }),
      transferTx({
        account: 'acct_prop',
        counterparty: 'acct_other',
        nonce: 2n,
        transactionId: 'tx.p.2',
        quantity: 3n,
      }),
    ];
    const result = applyTransactions(genesis, txs);
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    for (let index = 0; index < 5; index += 1) {
      assert.equal(reconcileCanonicalState(result.next).ok, true);
    }
  });
});

describe('deterministic state economics alignment', () => {
  it('transfer through operations matches canonical transition', () => {
    const authority = new ProtocolNativeSupplyAuthority();
    authority.applyIssuance({
      actor: 'PROTOCOL',
      authority: developmentSunReyAuthority({
        recipient: 'acct_src',
        quantity: 500n,
        replayIdentifier: 'iss.align',
      }),
    });
    const book = authority.book('SUNREY_COIN');
    const transferred = transfer(book, 'acct_src', 'acct_dst', 125n);
    assert.equal(transferred.circulating, 500n);
    const src = transferred.positions.get('acct_src')?.circulating ?? 0n;
    const dst = transferred.positions.get('acct_dst')?.circulating ?? 0n;
    assert.equal(src, 375n);
    assert.equal(dst, 125n);
  });
});
