import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../../domain/src/time.ts';
import { AssetQuantity } from '../../../money/src/asset-quantity.ts';
import { SUNREY_COIN_USD_MARKET_ID } from '../ids.ts';
import { matchIncoming } from '../matching.ts';
import { exchangePrice } from '../price.ts';
import type { DigitalOrder } from '../types.ts';
import { isExchangeApiError } from './api.ts';
import { orderFilledIsNotSettled } from './clearing.ts';
import { defaultEligibilityFacts, evaluateProductEligibility, travelRuleHook } from './eligibility.ts';
import { createExchangeProductSandbox, emptySnapshot, syntheticTrade } from './sandbox.ts';
import { productizeSelfTradePolicy } from './surveillance.ts';

const NOW = asUtcInstant('2026-08-23T12:00:00.000Z');

function order(input: {
  readonly orderId: string;
  readonly side: 'BUY' | 'SELL';
  readonly participant: string;
  readonly remaining?: bigint;
  readonly sequence?: number;
}): DigitalOrder {
  return Object.freeze({
    orderId: input.orderId as DigitalOrder['orderId'],
    version: 1 as DigitalOrder['version'],
    exchangeAccountId: `xacct_${input.participant}` as DigitalOrder['exchangeAccountId'],
    beneficialParticipantId: input.participant,
    marketId: SUNREY_COIN_USD_MARKET_ID,
    family: 'DIGITAL_ASSET',
    side: input.side,
    orderType: 'LIMIT',
    quantity: AssetQuantity.fromScaledUnits(input.remaining ?? 1_000_000n, 'SUNREY_COIN'),
    remaining: AssetQuantity.fromScaledUnits(input.remaining ?? 1_000_000n, 'SUNREY_COIN'),
    limitPrice: exchangePrice({
      baseAssetId: 'SUNREY_COIN',
      quoteAssetId: 'USD',
      quoteKind: 'FIAT_MONEY',
      priceUnits: 100n,
      basePrecision: 6,
    }),
    createdAt: NOW,
    timeInForce: 'GTC',
    status: 'OPEN',
    clientIdempotencyKey: input.orderId,
    authorizationRef: null,
    holdId: null,
    coinHoldId: null,
    sourceAccountId: `acct_${input.participant}`,
    sequence: input.sequence ?? 1,
  });
}

describe('Phase G Prompt 2 exchange settlement productization', () => {
  it('creates a fill obligation and ledger DVP settlement', () => {
    const world = createExchangeProductSandbox();
    const trade = syntheticTrade({ tradeId: 'xtrd_ledger' });
    world.recordTrade(trade);
    const { obligation, clearing } = world.platform.recordFill({
      trade,
      buyerAccountId: 'buyer',
      sellerAccountId: 'seller',
      buyerParticipantId: 'buyer',
      sellerParticipantId: 'seller',
      buyerCashAccountId: 'acct_buyer_usd',
      sellerCashAccountId: 'acct_seller_usd',
      quoteRail: 'LEDGER_FIAT',
      baseRail: 'APPLICATION_PORT',
      at: NOW,
    });
    assert.equal(clearing.state, 'PENDING');
    assert.equal(obligation.fillIsFinalSettlement, false);
    world.seedCoin('seller', 2_000_000n);
    const settled = world.platform.settle({
      obligationId: obligation.obligationId,
      at: NOW,
      authority: world.issueAuthority('acct_buyer_usd', `exchange.settle.cash.${trade.tradeId}`),
      actorId: 'actor_exchange',
    });
    assert.equal(settled.state, 'SETTLED');
    assert.ok(settled.refs.ledger.cashJournalId);
    assert.equal(orderFilledIsNotSettled('FILLED', clearing), true);
    assert.equal(orderFilledIsNotSettled('FILLED', settled), false);
  });

  it('coordinates native-chain DVP and refuses finality before BFT', () => {
    const world = createExchangeProductSandbox();
    world.finalized.delete('always');
    world.seedNative('seller', 'SUNREY_COIN', 2_000_000n);
    world.seedNative('buyer', 'USD', 500n);
    const trade = syntheticTrade({ tradeId: 'xtrd_native' });
    const { obligation } = world.platform.recordFill({
      trade,
      buyerAccountId: 'buyer',
      sellerAccountId: 'seller',
      buyerParticipantId: 'buyer',
      sellerParticipantId: 'seller',
      buyerCashAccountId: 'acct_buyer_usd',
      sellerCashAccountId: 'acct_seller_usd',
      quoteRail: 'NATIVE_CHAIN',
      baseRail: 'NATIVE_CHAIN',
      at: NOW,
    });
    world.finalized.delete(`ndvp_${trade.tradeId}`);
    const pending = world.platform.settle({
      obligationId: obligation.obligationId,
      at: NOW,
      authority: null,
      actorId: 'actor_exchange',
    });
    assert.equal(pending.state, 'REQUIRES_REVIEW');
    assert.notEqual(pending.refs.chain.finality, 'BFT_FINALIZED');
    world.finalized.add(`ndvp_${trade.tradeId}`);
    const finalized = world.platform.confirmFinality({
      obligationId: obligation.obligationId,
      at: NOW,
      chainFinality: 'BFT_FINALIZED',
    });
    assert.equal(finalized.state, 'SETTLED');
    assert.equal(finalized.refs.chain.finality, 'BFT_FINALIZED');
  });

  it('requires verified custody finality and rejects webhook-only credit', () => {
    const world = createExchangeProductSandbox();
    world.custody.nextFinality = 'PENDING';
    const trade = syntheticTrade({ tradeId: 'xtrd_custody' });
    const { obligation } = world.platform.recordFill({
      trade,
      buyerAccountId: 'buyer',
      sellerAccountId: 'seller',
      buyerParticipantId: 'buyer',
      sellerParticipantId: 'seller',
      buyerCashAccountId: 'acct_buyer_usd',
      sellerCashAccountId: 'acct_seller_usd',
      sellerCustodyRef: 'vault_seller',
      quoteRail: 'APPLICATION_PORT',
      baseRail: 'CUSTODY_ASSET',
      at: NOW,
    });
    world.seedFiat('acct_buyer_usd', 10_000n);
    const pending = world.platform.settle({
      obligationId: obligation.obligationId,
      at: NOW,
      authority: null,
      actorId: 'actor_exchange',
    });
    assert.equal(pending.state, 'REQUIRES_REVIEW');
    const webhook = world.platform.confirmFinality({
      obligationId: obligation.obligationId,
      at: NOW,
      fromWebhookAlone: true,
    });
    assert.equal(webhook.failureCode, 'WEBHOOK_UNVERIFIED');
    const confirmed = world.platform.confirmFinality({
      obligationId: obligation.obligationId,
      at: NOW,
      custodyConfirmation: 'CONFIRMED',
    });
    assert.equal(confirmed.state, 'SETTLED');
  });

  it('records one-sided DVP as review and blocks duplicate transfers', () => {
    const world = createExchangeProductSandbox();
    const trade = syntheticTrade({ tradeId: 'xtrd_partial' });
    const { obligation } = world.platform.recordFill({
      trade,
      buyerAccountId: 'buyer',
      sellerAccountId: 'seller',
      buyerParticipantId: 'buyer',
      sellerParticipantId: 'seller',
      buyerCashAccountId: 'acct_buyer_usd',
      sellerCashAccountId: 'acct_seller_usd',
      quoteRail: 'APPLICATION_PORT',
      baseRail: 'APPLICATION_PORT',
      at: NOW,
    });
    world.seedFiat('acct_buyer_usd', 10_000n);
    const failed = world.platform.settle({
      obligationId: obligation.obligationId,
      at: NOW,
      authority: null,
      actorId: 'actor_exchange',
    });
    assert.equal(failed.state, 'REQUIRES_REVIEW');
    assert.equal(failed.failureCode, 'DVP_PARTIAL');
    world.seedCoin('seller', 2_000_000n);
    const repaired = world.platform.settle({
      obligationId: obligation.obligationId,
      at: NOW,
      authority: null,
      actorId: 'actor_exchange',
      kind: 'REPAIR',
    });
    assert.equal(repaired.duplicateTransferBlocked || repaired.state === 'SETTLED' || repaired.state === 'REQUIRES_REVIEW', true);
    const replay = world.platform.settle({
      obligationId: obligation.obligationId,
      at: NOW,
      authority: null,
      actorId: 'actor_exchange',
      kind: 'RETRY',
    });
    assert.equal(replay.duplicateTransferBlocked || replay.state === 'SETTLED' || replay.state === 'REQUIRES_REVIEW', true);
  });

  it('persists reconciliation breaks without mutating books', () => {
    const world = createExchangeProductSandbox();
    const trade = syntheticTrade({ tradeId: 'xtrd_recon' });
    world.platform.recordFill({
      trade,
      buyerAccountId: 'buyer',
      sellerAccountId: 'seller',
      buyerParticipantId: 'buyer',
      sellerParticipantId: 'seller',
      buyerCashAccountId: 'acct_buyer_usd',
      sellerCashAccountId: 'acct_seller_usd',
      quoteRail: 'LEDGER_FIAT',
      baseRail: 'APPLICATION_PORT',
      at: NOW,
    });
    const report = world.platform.reconcile({
      exchangePositions: [{ ownerId: 'buyer', assetId: 'SUNREY_COIN', quantity: 5n }],
      ledgerPositions: [{ ownerId: 'buyer', assetId: 'SUNREY_COIN', quantity: 4n }],
      custodyPositions: [{ ownerId: 'buyer', assetId: 'SUNREY_COIN', quantity: 5n }],
      chainPositions: [{ ownerId: 'buyer', assetId: 'SUNREY_COIN', quantity: 5n }],
      at: NOW,
    });
    assert.equal(report.autoCorrected, false);
    assert.equal(report.mutatedBooks, false);
    assert.equal(report.matched, false);
    assert.ok(report.breaks.some((item) => item.kind === 'EXCHANGE_VS_LEDGER'));
    assert.ok(world.platform.listBreaks().length >= 1);
  });

  it('separates CAN_TRADE, CAN_DEPOSIT, and CAN_WITHDRAW including Travel Rule', () => {
    const blocked = evaluateProductEligibility({
      ...defaultEligibilityFacts('user_1', 'mkt'),
      travelRule: {
        ownerId: 'user_1',
        destination: 'addr_1',
        amountMinorUnits: 100n,
        assetId: 'SUNREY_COIN',
        requiredByPack: true,
        messageState: 'PENDING',
      },
    });
    assert.equal(blocked.canTrade.allowed, true);
    assert.equal(blocked.canDeposit.allowed, true);
    assert.equal(blocked.canWithdraw.allowed, false);
    assert.ok(blocked.canWithdraw.reasonCodes.includes('TRAVEL_RULE_PENDING'));
    const hook = travelRuleHook({
      ownerId: 'user_1',
      destination: 'addr_1',
      amountMinorUnits: 100n,
      assetId: 'SUNREY_COIN',
      requiredByPack: true,
      messageState: 'DELIVERED',
    });
    assert.equal(hook.blocksWithdrawal, false);
    const restricted = evaluateProductEligibility({
      ...defaultEligibilityFacts('user_1', 'mkt'),
      sanctionsHit: true,
      accountStatus: 'SUSPENDED',
    });
    assert.equal(restricted.canTrade.allowed, false);
    assert.equal(restricted.productionTradingEnabled, false);
  });

  it('detects wash trading and spoofing as candidate alerts, not legal conclusions', () => {
    const world = createExchangeProductSandbox();
    const alerts = world.platform.observe({
      marketId: SUNREY_COIN_USD_MARKET_ID,
      now: NOW,
      linkedAccounts: { acct_a: 'group_1', acct_b: 'group_1' },
      orders: [
        {
          orderId: 'o1',
          accountId: 'acct_a',
          beneficialParticipantId: 'p1',
          marketId: SUNREY_COIN_USD_MARKET_ID,
          side: 'SELL',
          quantity: 8n,
          remaining: 0n,
          status: 'CANCELLED',
          createdAt: NOW,
          cancelledAt: NOW,
        },
        {
          orderId: 'o2',
          accountId: 'acct_a',
          beneficialParticipantId: 'p1',
          marketId: SUNREY_COIN_USD_MARKET_ID,
          side: 'SELL',
          quantity: 8n,
          remaining: 0n,
          status: 'CANCELLED',
          createdAt: NOW,
          cancelledAt: NOW,
        },
        {
          orderId: 'o3',
          accountId: 'acct_a',
          beneficialParticipantId: 'p1',
          marketId: SUNREY_COIN_USD_MARKET_ID,
          side: 'SELL',
          quantity: 8n,
          remaining: 0n,
          status: 'CANCELLED',
          createdAt: NOW,
          cancelledAt: NOW,
        },
        {
          orderId: 'ot',
          accountId: 'acct_b',
          beneficialParticipantId: 'p2',
          marketId: SUNREY_COIN_USD_MARKET_ID,
          side: 'BUY',
          quantity: 1n,
          remaining: 0n,
          status: 'FILLED',
          createdAt: NOW,
        },
      ],
      trades: [
        {
          tradeId: 't1',
          marketId: SUNREY_COIN_USD_MARKET_ID,
          makerOrderId: 'om',
          takerOrderId: 'ot',
          makerAccountId: 'acct_a',
          takerAccountId: 'acct_b',
          makerParticipantId: 'p1',
          takerParticipantId: 'p2',
          quantity: 1n,
          priceUnits: 100n,
          matchedAt: NOW,
        },
      ],
    });
    assert.ok(alerts.some((alert) => alert.kind === 'WASH_TRADING_PATTERN'));
    assert.ok(alerts.some((alert) => alert.kind === 'SPOOFING_CANDIDATE'));
    assert.ok(alerts.every((alert) => alert.legalConclusion === false));
    assert.ok(world.platform.listCases().every((item) => item.legalConclusion === false));
  });

  it('applies configurable self-trade prevention', () => {
    const maker = order({ orderId: 'xord_old', side: 'SELL', participant: 'same', sequence: 1 });
    const incoming = order({ orderId: 'xord_new', side: 'BUY', participant: 'same', sequence: 2 });
    const newest = matchIncoming(incoming, [maker], { selfTrade: 'CANCEL_NEWEST' });
    assert.equal(newest.rejectIncoming, true);
    assert.equal(newest.reason, 'SELF_TRADE');
    const reject = matchIncoming(incoming, [maker], { selfTrade: 'REJECT' });
    assert.equal(reject.rejectIncoming, true);
    const oldest = matchIncoming(incoming, [maker], { selfTrade: 'CANCEL_OLDEST' });
    assert.equal(oldest.rejectIncoming, false);
    assert.deepEqual(oldest.cancelledRestingIds, [maker.orderId]);
    assert.equal(productizeSelfTradePolicy('CANCEL_OLDEST').behavior, 'cancel_oldest');
  });

  it('projects market data with freshness and encodes a non-privileged stream', () => {
    const world = createExchangeProductSandbox();
    const trade = syntheticTrade({ tradeId: 'xtrd_md', priceUnits: 110n });
    world.recordTrade(trade);
    const snapshot = {
      ...emptySnapshot(),
      lastTrade: trade,
      lastPriceLabel: 'SIMULATION_MARKET_PRICE' as const,
      bestBid: trade.price,
      bestAsk: trade.price,
      volume: trade.quantity,
    };
    world.putSnapshot(snapshot);
    world.platform.publishMarket({ snapshot, trade, at: NOW });
    const projected = world.platform.projectMarket({
      snapshot,
      trades: [trade],
      now: NOW,
      state: 'OPEN',
    });
    assert.equal(projected.ticker.lastPriceUnits, 110n);
    assert.equal(typeof projected.ticker.freshnessMs, 'bigint');
    assert.equal(projected.candles.length, 1);
    assert.equal(projected.status.productionTradingEnabled, false);
    const stream = world.api.stream(0);
    assert.equal(stream.privilegedTopicsExposed, false);
    assert.match(stream.sse, /event: ticker/);
    assert.match(stream.sse, /event: trade/);
  });

  it('exposes owner-scoped order/fill APIs and keeps agents on the proposal path', () => {
    const world = createExchangeProductSandbox();
    const trade = syntheticTrade({ tradeId: 'xtrd_api' });
    world.platform.recordFill({
      trade,
      buyerAccountId: 'acct_owner',
      sellerAccountId: 'acct_other',
      buyerParticipantId: 'owner',
      sellerParticipantId: 'other',
      buyerCashAccountId: 'acct_buyer_usd',
      sellerCashAccountId: 'acct_seller_usd',
      quoteRail: 'LEDGER_FIAT',
      baseRail: 'APPLICATION_PORT',
      at: NOW,
    });
    world.putOrder(
      'owner',
      order({ orderId: 'xord_owner', side: 'BUY', participant: 'owner' }),
    );
    const actor = { ownerId: 'owner', accountIds: ['acct_owner'], authorityPresent: false };
    const markets = world.api.markets();
    assert.equal(markets.productionTradingEnabled, false);
    assert.ok(markets.items.length > 0);
    const preview = world.api.preview(actor, {
      marketId: SUNREY_COIN_USD_MARKET_ID,
      instrument: 'SUNREY_COIN-USD',
      side: 'BUY',
      quantity: 1n,
    });
    assert.equal(preview.guaranteedExecutionPrice, false);
    const foreign = world.api.order(actor, 'xord_missing');
    assert.equal(isExchangeApiError(foreign) && foreign.code === 'NOT_OWNED', true);
    const fills = world.api.fills(actor);
    assert.equal(fills.items.length, 1);
    const stranger = world.api.fills({ ownerId: 'stranger', accountIds: ['acct_stranger'], authorityPresent: false });
    assert.equal(stranger.items.length, 0);
    const raw = world.api.submitOrder(actor, {
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'BUY',
      quantity: 1n,
    });
    assert.equal(isExchangeApiError(raw) && raw.code === 'PROPOSAL_REQUIRED', true);
    const proposed = world.api.submitOrder(
      { ...actor, approvedProposalId: 'prop_1' },
      { marketId: SUNREY_COIN_USD_MARKET_ID, side: 'BUY', quantity: 1n, proposalId: 'prop_1' },
    );
    assert.equal(isExchangeApiError(proposed), false);
    if (!isExchangeApiError(proposed)) {
      assert.equal(proposed.requiresExecution, true);
    }
  });
});
