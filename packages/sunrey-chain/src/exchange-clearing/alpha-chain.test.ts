import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AlphaExchangeClearingChain,
  createAlphaExchangeClearingChain,
  exchangeCustodyAddress,
  SUNREY_INTERNAL_ALPHA_CHAIN_ID,
  SUNREY_INTERNAL_ALPHA_NETWORK_ID,
} from './index.ts';
import { EXCHANGE_SETTLEMENT_ISSUER, NATIVE_SETTLEMENT_POLICY } from './types.ts';

describe('Internal Alpha network identity', () => {
  it('uses canonical internal alpha network and chain ids', () => {
    const chain = createAlphaExchangeClearingChain();
    assert.equal(chain.networkId, SUNREY_INTERNAL_ALPHA_NETWORK_ID);
    assert.equal(chain.chainId, SUNREY_INTERNAL_ALPHA_CHAIN_ID);
  });

  it('derives canonical custody addresses from customer identity', () => {
    const alice = exchangeCustodyAddress('alice');
    const bob = exchangeCustodyAddress('bob');
    assert.notEqual(alice, bob);
    assert.match(alice, /^srtst1/);
    assert.match(bob, /^srtst1/);
  });
});

describe('AlphaExchangeClearingChain', () => {
  function fundedChain() {
    const chain = createAlphaExchangeClearingChain();
    const seller = exchangeCustodyAddress('seller');
    const buyer = exchangeCustodyAddress('buyer');
    chain.issue(seller, 'SUNREY_COIN', 20n);
    chain.issue(buyer, 'MOONREY_COIN', 50n);
    const sellerLock = chain.lock('lock_seller', seller, 'SUNREY_COIN', 10n);
    const buyerLock = chain.lock('lock_buyer', buyer, 'MOONREY_COIN', 25n);
    void sellerLock;
    void buyerLock;
    return { chain, seller, buyer };
  }

  function settlementIntent(input: {
    chain: AlphaExchangeClearingChain;
    seller: string;
    buyer: string;
    signature: string;
    settlementId?: string;
    reservationRefs?: readonly string[];
    nonce?: bigint;
  }) {
    return {
      settlementId: input.settlementId ?? 'xset_alpha_1',
      tradeIds: ['xtrd_alpha_1'],
      buyer: 'xacct_native_buyer',
      seller: 'xacct_native_seller',
      buyerCustody: input.buyer,
      sellerCustody: input.seller,
      baseAsset: 'SUNREY_COIN',
      baseQuantity: 10n,
      quoteAsset: 'MOONREY_COIN',
      quoteQuantity: 25n,
      feeLegs: [],
      reservationRefs: input.reservationRefs ?? ['lock_seller', 'lock_buyer'],
      expirationHeight: input.chain.height + 100n,
      exchangeSignature: input.signature,
      policyVersion: NATIVE_SETTLEMENT_POLICY,
      networkId: SUNREY_INTERNAL_ALPHA_NETWORK_ID,
      chainId: SUNREY_INTERNAL_ALPHA_CHAIN_ID,
      nonce: input.nonce ?? 1n,
    };
  }

  it('finalizes SRC and MRC transfer legs atomically', () => {
    const { chain, seller, buyer } = fundedChain();
    const signature = `${EXCHANGE_SETTLEMENT_ISSUER}:alpha-test`;
    chain.registerExchangeKey(signature);
    const intent = settlementIntent({ chain, seller, buyer, signature });
    const tx = chain.submitSettlement(intent);
    const finalized = chain.finalize(tx.transactionId);
    assert.equal(finalized.status, 'BFT_FINALIZED');
    assert.equal(chain.holding(buyer, 'SUNREY_COIN').available, 10n);
    assert.equal(chain.holding(seller, 'MOONREY_COIN').available, 25n);
    assert.match(finalized.transactionHash, /^[0-9a-f]{64}$/);
  });

  it('reports BFT finality and block height on query', () => {
    const { chain, seller, buyer } = fundedChain();
    const signature = `${EXCHANGE_SETTLEMENT_ISSUER}:alpha-query`;
    chain.registerExchangeKey(signature);
    const tx = chain.submitSettlement(settlementIntent({ chain, seller, buyer, signature }));
    chain.finalize(tx.transactionId);
    const queried = chain.query(tx.transactionId);
    assert.equal(queried.finality, 'BFT_FINALIZED');
    assert.ok(queried.blockHeight && queried.blockHeight > 0n);
  });

  it('rejects duplicate settlement replay', () => {
    const { chain, seller, buyer } = fundedChain();
    const signature = `${EXCHANGE_SETTLEMENT_ISSUER}:alpha-replay`;
    chain.registerExchangeKey(signature);
    const intent = settlementIntent({ chain, seller, buyer, signature });
    const tx = chain.submitSettlement(intent);
    chain.finalize(tx.transactionId);
    assert.throws(() => chain.applySettlement(intent), /SETTLEMENT_REPLAY|TRADE_ALREADY_SETTLED/);
  });

  it('preserves pending mempool transaction for recovery', () => {
    const { chain, seller, buyer } = fundedChain();
    const signature = `${EXCHANGE_SETTLEMENT_ISSUER}:alpha-pending`;
    chain.registerExchangeKey(signature);
    const tx = chain.submitSettlement(settlementIntent({ chain, seller, buyer, signature }));
    const pending = chain.query(tx.transactionId);
    assert.equal(pending.finality, 'PENDING_PROPOSAL');
    chain.finalize(tx.transactionId);
    assert.equal(chain.query(tx.transactionId).finality, 'BFT_FINALIZED');
  });

  it('rejects insufficient reservation without movement', () => {
    const { chain, seller, buyer } = fundedChain();
    const signature = `${EXCHANGE_SETTLEMENT_ISSUER}:alpha-short`;
    chain.registerExchangeKey(signature);
    const tx = chain.submitSettlement(
      settlementIntent({ chain, seller, buyer, signature, reservationRefs: ['missing-lock'], nonce: 2n, settlementId: 'xset_short' }),
    );
    assert.throws(() => chain.finalize(tx.transactionId), /INSUFFICIENT_RESERVATION/);
    assert.equal(chain.holding(buyer, 'SUNREY_COIN').available, 0n);
  });

  it('rejects invalid source on transfer', () => {
    const chain = createAlphaExchangeClearingChain();
    assert.throws(
      () => chain.transfer('srdev1missing', exchangeCustodyAddress('alice'), 'SUNREY_COIN', 1n),
      /INSUFFICIENT_ASSET/,
    );
  });

  it('isolates holdings across addresses', () => {
    const chain = createAlphaExchangeClearingChain();
    const alice = exchangeCustodyAddress('alice');
    const bob = exchangeCustodyAddress('bob');
    chain.issue(bob, 'SUNREY_COIN', 5n);
    chain.issue(alice, 'MOONREY_COIN', 7n);
    assert.equal(chain.holding(alice, 'SUNREY_COIN').available, 0n);
    assert.equal(chain.holding(bob, 'SUNREY_COIN').available, 5n);
    assert.equal(chain.holding(alice, 'MOONREY_COIN').available, 7n);
    assert.equal(chain.holding(bob, 'MOONREY_COIN').available, 0n);
  });

  it('fails closed when unavailable', () => {
    const chain = createAlphaExchangeClearingChain();
    chain.forceUnavailable();
    assert.throws(() => chain.issue(exchangeCustodyAddress('alice'), 'SUNREY_COIN', 1n), /CHAIN_UNAVAILABLE/);
    chain.restoreAvailability();
    assert.doesNotThrow(() => chain.issue(exchangeCustodyAddress('alice'), 'SUNREY_COIN', 1n));
  });

  it('reconciles issued supply', () => {
    const chain = createAlphaExchangeClearingChain();
    chain.issue(exchangeCustodyAddress('alice'), 'SUNREY_COIN', 3n);
    chain.issue(exchangeCustodyAddress('bob'), 'MOONREY_COIN', 4n);
    assert.doesNotThrow(() => chain.reconcile());
  });

  it('rejects wrong-network payloads', () => {
    const chain = new AlphaExchangeClearingChain();
    const intent = settlementIntent({
      chain,
      seller: exchangeCustodyAddress('seller'),
      buyer: exchangeCustodyAddress('buyer'),
      signature: `${EXCHANGE_SETTLEMENT_ISSUER}:wrong-net`,
    });
    assert.throws(
      () =>
        chain.applySettlement({
          ...intent,
          networkId: 'net_other',
        }),
      /WRONG_NETWORK/,
    );
  });
});
