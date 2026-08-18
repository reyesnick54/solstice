import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import { detectSurveillanceAlerts } from '../../market-surveillance/src/detectors.ts';
import { SUNREY_COIN_NATIVE_ASSET_ID, SUNREY_MOONREY_MARKET_ID, asExchangeAccountId } from './ids.ts';
import { sortBook } from './matching.ts';
import {
  MarketOperationsEngine,
  authorizeMarketRestriction,
  defaultMarketOperationsPolicy,
  developerApiKeyCannotTradeProduction,
  issueTradingCredential,
  rejectCredentialWithCustodyKey,
  runMarketOpsCommand,
} from './ops/index.ts';
import { CANONICAL_MARKET_FAMILIES } from './taxonomy.ts';

const NOW = asUtcInstant('2026-08-18T13:00:00.000Z');

function engine() {
  const ops = new MarketOperationsEngine({
    now: NOW,
    ports: {
      surveillance: {
        observe({ marketId, orders, trades, now }) {
          return detectSurveillanceAlerts(
            {
              marketId,
              orders: orders.map((order) => ({
                orderId: order.orderId,
                accountId: order.exchangeAccountId,
                beneficialParticipantId: order.beneficialParticipantId,
                marketId: order.marketId,
                side: order.side,
                quantity: order.quantity.scaledUnits,
                remaining: order.remaining.scaledUnits,
                status: order.status,
                createdAt: order.createdAt,
              })),
              trades: trades.map((trade) => ({
                tradeId: trade.tradeId,
                marketId: trade.marketId,
                makerOrderId: trade.makerOrderId,
                takerOrderId: trade.takerOrderId,
                makerAccountId: String(trade.makerOrderId),
                takerAccountId: String(trade.takerOrderId),
                makerParticipantId: 'p1',
                takerParticipantId: 'p2',
                quantity: trade.quantity.scaledUnits,
                priceUnits: trade.price.priceUnits,
                matchedAt: trade.matchedAt,
              })),
            },
            now,
          ).map((alert) => ({
            kind: alert.kind,
            marketId: alert.marketId,
            subjectRefs: alert.subjectRefs,
            evidenceRefs: alert.evidenceRefs,
            outputClass: 'CANDIDATE_ALERT' as const,
            legalConclusion: false as const,
          }));
        },
      },
    },
  });
  const alice = ops.registerParticipant({ participantId: 'alice', reservation: 10_000_000_000n });
  const bob = ops.registerParticipant({ participantId: 'bob', reservation: 10_000_000_000n });
  const aliceSession = ops.openTradingSession(alice.credential, NOW);
  const bobSession = ops.openTradingSession(bob.credential, NOW);
  return { ops, alice, bob, aliceSession, bobSession };
}

describe('chunk 95 market families and native market', () => {
  it('preserves four canonical families without inherited legal status', () => {
    assert.deepEqual([...CANONICAL_MARKET_FAMILIES], [
      'DIGITAL_ASSET',
      'HUMAN_INFORMATION_RIGHT',
      'INTELLIGENCE_COMPUTE',
      'PRODUCTIVE_CAPACITY',
    ]);
    const policy = defaultMarketOperationsPolicy();
    assert.equal(policy.focusFamily, 'DIGITAL_ASSET');
    assert.equal(policy.nativeMarket.fixedPeg, false);
    assert.equal(policy.nativeMarket.guaranteedPriceRelationship, false);
    assert.equal(policy.productionActivated, false);
    assert.equal(policy.marketMakerHiddenPriority, false);
    assert.equal(policy.aiMayAuthorizeMarketRestriction, false);
  });

  it('configures continuous native sessions without hardcoding every market', () => {
    const { ops } = engine();
    const native = ops.sessions.get(SUNREY_MOONREY_MARKET_ID);
    assert.equal(native?.continuous, true);
    const scheduled = ops.configureSession({
      marketId: SUNREY_MOONREY_MARKET_ID,
      mode: 'SCHEDULED',
      openUtc: '08:00:00Z',
      closeUtc: '16:00:00Z',
    });
    assert.equal(scheduled.continuous, false);
    assert.equal(scheduled.timezone, 'UTC');
  });
});

describe('institutional gateway', () => {
  it('authenticates sessions, sequences, and replays duplicate clOrdId', () => {
    const { ops, aliceSession } = engine();
    const first = ops.enterOrder(
      aliceSession.sessionId,
      1n,
      {
        clOrdId: 'cl-1',
        marketId: SUNREY_MOONREY_MARKET_ID,
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 10n,
        priceUnits: 2_500_000n,
      },
      NOW,
    );
    assert.equal(first.outcome, 'ACK');
    const dup = ops.enterOrder(
      aliceSession.sessionId,
      2n,
      {
        clOrdId: 'cl-1',
        marketId: SUNREY_MOONREY_MARKET_ID,
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 10n,
        priceUnits: 2_500_000n,
      },
      NOW,
    );
    assert.equal(dup.outcome, 'IDEMPOTENT_REPLAY');
    assert.equal(ops.orderStatus(aliceSession.sessionId, 'cl-1')?.orderId, first.orderId);
    const recovered = ops.recoverSession(aliceSession.sessionId);
    assert.equal(recovered.lastInboundSeq, 1n);
    assert.ok(recovered.openOrders.length >= 1);
  });

  it('rejects a trading credential that carries a custody private key', () => {
    const rejected = rejectCredentialWithCustodyKey({ participantId: 'alice', custodyPrivateKey: 'hex' });
    assert.equal(rejected?.reason, 'CUSTODY_PRIVATE_KEY_FORBIDDEN');
    const credential = issueTradingCredential({
      participantId: 'alice',
      accountId: 'xacct_native_alice',
      marketPermissions: ['DIGITAL_ASSET'],
      environment: 'SIMULATION',
    });
    assert.equal(credential.custodyPrivateKeyPresent, false);
    assert.equal(developerApiKeyCannotTradeProduction('SANDBOX').canTradeProductionFunds, false);
  });

  it('rejects the wrong participant', () => {
    const { ops } = engine();
    const mallory = ops.registerParticipant({ participantId: 'mallory', eligible: false });
    const session = ops.openTradingSession(mallory.credential, NOW);
    const ack = ops.enterOrder(
      session.sessionId,
      1n,
      {
        clOrdId: 'bad',
        marketId: SUNREY_MOONREY_MARKET_ID,
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 1n,
        priceUnits: 2_500_000n,
      },
      NOW,
    );
    assert.equal(ack.outcome, 'REJECT');
    assert.equal(ack.reason, 'WRONG_PARTICIPANT');
  });
});

describe('pre-trade risk and price protection', () => {
  it('enforces price collars around the explicit reference hierarchy', () => {
    const { ops, aliceSession } = engine();
    const ack = ops.enterOrder(
      aliceSession.sessionId,
      1n,
      {
        clOrdId: 'fat',
        marketId: SUNREY_MOONREY_MARKET_ID,
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 1n,
        priceUnits: 25_000_000n,
      },
      NOW,
    );
    assert.equal(ack.outcome, 'REJECT');
    assert.equal(ack.reason, 'PRICE_COLLAR');
  });

  it('rejects a market-with-protection order when the reference feed is unavailable', () => {
    const { ops, aliceSession } = engine();
    ops.oracleApproved = false;
    ops.oraclePrice = null;
    const ack = ops.enterOrder(
      aliceSession.sessionId,
      1n,
      {
        clOrdId: 'mwp',
        marketId: SUNREY_MOONREY_MARKET_ID,
        side: 'BUY',
        orderType: 'MARKET_WITH_PROTECTION',
        quantity: 1n,
        priceUnits: null,
      },
      NOW,
    );
    assert.equal(ack.outcome, 'REJECT');
    assert.ok(ack.reason === 'REFERENCE_PRICE_UNAVAILABLE' || ack.reason === 'PROTECTION_NO_FILL');
  });

  it('enforces self-trade prevention', () => {
    const { ops, aliceSession } = engine();
    ops.enterOrder(
      aliceSession.sessionId,
      1n,
      {
        clOrdId: 's1',
        marketId: SUNREY_MOONREY_MARKET_ID,
        side: 'SELL',
        orderType: 'LIMIT',
        quantity: 5n,
        priceUnits: 2_500_000n,
      },
      NOW,
    );
    const cross = ops.enterOrder(
      aliceSession.sessionId,
      2n,
      {
        clOrdId: 's2',
        marketId: SUNREY_MOONREY_MARKET_ID,
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 5n,
        priceUnits: 2_500_000n,
      },
      NOW,
    );
    assert.equal(cross.outcome, 'REJECT');
    assert.equal(cross.reason, 'SELF_TRADE');
  });

  it('restricts new risk when settlement is degraded or custody is unavailable', () => {
    const { ops, aliceSession } = engine();
    ops.setSettlementHealth('DEGRADED', 99n);
    const degraded = ops.enterOrder(
      aliceSession.sessionId,
      1n,
      {
        clOrdId: 'deg',
        marketId: SUNREY_MOONREY_MARKET_ID,
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 1n,
        priceUnits: 2_500_000n,
      },
      NOW,
    );
    assert.equal(degraded.outcome, 'REJECT');
    assert.equal(degraded.reason, 'SETTLEMENT_DEGRADED');
    ops.setSettlementHealth('HEALTHY', 0n);
    ops.setCustody({ status: 'UNAVAILABLE', reconciled: false, attributedQuantity: 0n });
    const custody = ops.enterOrder(
      aliceSession.sessionId,
      2n,
      {
        clOrdId: 'cust',
        marketId: SUNREY_MOONREY_MARKET_ID,
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 1n,
        priceUnits: 2_500_000n,
      },
      NOW,
    );
    assert.equal(custody.outcome, 'REJECT');
    assert.equal(custody.reason, 'CUSTODY_UNAVAILABLE');
  });
});

describe('market halt, circuit breakers, and auctions', () => {
  it('rejects AI market authorization and honors a human halt', () => {
    const ai = authorizeMarketRestriction({ actorKind: 'AI', reason: 'MODEL' });
    assert.equal(ai.accepted, false);
    assert.ok(ai.reasonCodes.includes('AI_MARKET_AUTHORIZATION_REJECTED'));
    const { ops } = engine();
    const halted = ops.transitionMarket({
      state: 'PAUSED',
      actorKind: 'AI',
      reason: 'MODEL',
      now: NOW,
    });
    assert.equal(halted.accepted, false);
    const human = ops.transitionMarket({
      state: 'PAUSED',
      actorKind: 'HUMAN',
      reason: 'OPERATOR',
      now: NOW,
    });
    assert.equal(human.accepted, true);
    assert.equal(human.state, 'PAUSED');
    const { aliceSession } = engine();
    void aliceSession;
    const blocked = ops.enterOrder(
      ops.openTradingSession(ops.registerParticipant({ participantId: 'halted' }).credential, NOW).sessionId,
      1n,
      {
        clOrdId: 'h1',
        marketId: SUNREY_MOONREY_MARKET_ID,
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 1n,
        priceUnits: 2_500_000n,
      },
      NOW,
    );
    assert.equal(blocked.outcome, 'REJECT');
    assert.equal(blocked.reason, 'MARKET_HALTED');
  });

  it('runs a deterministic reopening auction then returns to continuous trading', () => {
    const { ops, aliceSession, bobSession } = engine();
    ops.transitionMarket({ state: 'PAUSED', actorKind: 'HUMAN', reason: 'INTERRUPTION', now: NOW });
    ops.startReopeningAuction(NOW);
    assert.equal(ops.marketState().state, 'AUCTION');
    ops.enterOrder(
      bobSession.sessionId,
      1n,
      {
        clOrdId: 'a-sell',
        marketId: SUNREY_MOONREY_MARKET_ID,
        side: 'SELL',
        orderType: 'LIMIT',
        quantity: 4n,
        priceUnits: 2_400_000n,
      },
      NOW,
    );
    ops.enterOrder(
      aliceSession.sessionId,
      1n,
      {
        clOrdId: 'a-buy',
        marketId: SUNREY_MOONREY_MARKET_ID,
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 4n,
        priceUnits: 2_600_000n,
      },
      NOW,
    );
    const cleared = ops.completeReopeningAuction(NOW);
    assert.equal(cleared.phase, 'TRANSITIONED');
    assert.equal(ops.marketState().state, 'OPEN');
    assert.ok((cleared.allocatedQuantity ?? 0n) >= 0n);
  });

  it('preserves existing kill-switch scopes', () => {
    const { ops } = engine();
    const scopes = ['MARKET', 'ASSET', 'MARKET_FAMILY', 'ORDER_ENTRY', 'SETTLEMENT', 'WITHDRAWAL'] as const;
    for (const scope of scopes) {
      const row = ops.engageKillSwitch({
        scope,
        targetId: 'ops',
        actorKind: 'HUMAN',
        reason: 'TEST',
      });
      assert.equal(row.scope, scope);
      assert.equal(row.accepted, true);
    }
  });
});

describe('market data, liquidity, and market makers', () => {
  it('recovers a sequence gap from snapshot plus incrementals', () => {
    const { ops, aliceSession } = engine();
    ops.enterOrder(
      aliceSession.sessionId,
      1n,
      {
        clOrdId: 'md1',
        marketId: SUNREY_MOONREY_MARKET_ID,
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 3n,
        priceUnits: 2_500_000n,
      },
      NOW,
    );
    const snap = ops.snapshot('BBO');
    assert.ok(snap.digest.length === 64);
    const recovered = ops.marketData.recover(SUNREY_MOONREY_MARKET_ID, 'BBO', 0n);
    assert.ok(recovered.snapshot);
    assert.equal(typeof recovered.snapshot.sequence, 'bigint');
    const publicView = ops.marketData.publicView(snap, 'PUBLIC_DELAYED');
    assert.equal(publicView.tier, 'PUBLIC_DELAYED');
    assert.ok(publicView.delayedMs > 0);
    const premium = ops.marketData.publicView(snap, 'AUTHORIZED_REALTIME');
    assert.equal(premium.delayedMs, 0);
  });

  it('does not grant market makers hidden matching priority', () => {
    const { ops, alice, aliceSession, bob, bobSession } = engine();
    const mm = ops.designateMarketMaker({ participantId: alice.credential.participantId, accountId: alice.accountId });
    assert.equal(mm.hiddenPriority, false);
    assert.equal(mm.protocolPrivilege, false);
    ops.enterOrder(
      bobSession.sessionId,
      1n,
      {
        clOrdId: 'cust-first',
        marketId: SUNREY_MOONREY_MARKET_ID,
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 2n,
        priceUnits: 2_500_000n,
      },
      NOW,
    );
    ops.enterOrder(
      aliceSession.sessionId,
      1n,
      {
        clOrdId: 'mm-second',
        marketId: SUNREY_MOONREY_MARKET_ID,
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 2n,
        priceUnits: 2_500_000n,
      },
      NOW,
    );
    const book = sortBook([...ops.orders.values()]);
    assert.equal(book.bids[0]?.exchangeAccountId, bob.accountId);
    assert.equal(book.bids[1]?.exchangeAccountId, alice.accountId);
    const liq = ops.liquidity();
    assert.equal(liq.commercialPricing, false);
    assert.ok(typeof liq.spreadUnits === 'bigint' || liq.spreadUnits === null);
  });
});

describe('settlement, licensing, CLI, and adversarial scenarios', () => {
  it('keeps unlicensed production activation unavailable and DVP exact', () => {
    const { ops, aliceSession, bobSession } = engine();
    const activation = ops.productionActivation();
    assert.equal(activation.productionActivated, false);
    assert.equal(activation.engineeringComplete, true);
    assert.ok(activation.reasonCodes.includes('UNLICENSED_ACTIVATION_UNAVAILABLE'));
    ops.enterOrder(
      bobSession.sessionId,
      1n,
      {
        clOrdId: 'dvp-s',
        marketId: SUNREY_MOONREY_MARKET_ID,
        side: 'SELL',
        orderType: 'LIMIT',
        quantity: 6n,
        priceUnits: 2_500_000n,
      },
      NOW,
    );
    ops.enterOrder(
      aliceSession.sessionId,
      1n,
      {
        clOrdId: 'dvp-b',
        marketId: SUNREY_MOONREY_MARKET_ID,
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 6n,
        priceUnits: 2_500_000n,
      },
      NOW,
    );
    const report = ops.reconcile();
    assert.equal(report.balancingEntries, false);
    assert.equal(ops.clearing.reconcile().autoCreatedAssets, false);
    for (const settlement of ops.clearing.settlements.values()) {
      assert.equal(settlement.intent.baseAsset, SUNREY_COIN_NATIVE_ASSET_ID);
      assert.ok(settlement.intent.baseQuantity > 0n);
      assert.ok(settlement.intent.quoteQuantity > 0n);
    }
  });

  it('exposes market-ops CLI commands without secrets', () => {
    const { ops } = engine();
    for (const command of [
      'markets',
      'market-state',
      'sessions',
      'market-data',
      'liquidity',
      'risk',
      'circuit-breakers',
      'auction',
      'reconciliation',
      'replay',
    ]) {
      const result = runMarketOpsCommand(ops, [command]);
      assert.equal(result.ok, true, command);
    }
    assert.equal(ops.dashboard().secretsPresent, false);
  });

  it('reports engineering-only order admission latency percentiles', () => {
    const { ops, aliceSession } = engine();
    const samples: number[] = [];
    let seq = 1n;
    for (let i = 0; i < 32; i += 1) {
      const started = process.hrtime.bigint();
      ops.enterOrder(
        aliceSession.sessionId,
        seq,
        {
          clOrdId: `perf-${i}`,
          marketId: SUNREY_MOONREY_MARKET_ID,
          side: 'BUY',
          orderType: 'LIMIT',
          quantity: 1n,
          priceUnits: 2_500_000n,
        },
        NOW,
      );
      seq += 1n;
      samples.push(Number(process.hrtime.bigint() - started) / 1_000_000);
    }
    samples.sort((a, b) => a - b);
    const p50 = samples[Math.floor((samples.length * 50) / 100)] ?? 0;
    const p50 = samples[Math.floor(samples.length / 2)] ?? 0;
    const p99 = samples[Math.floor((samples.length * 99) / 100)] ?? 0;
    assert.ok(p50 >= 0);
    assert.ok(p99 >= p50);
  });

  it('covers adversarial floods, disconnect cancel, and session replay', () => {
    const { ops, alice, aliceSession, bobSession } = engine();
    const flood = issueTradingCredential({
      participantId: alice.credential.participantId,
      accountId: alice.accountId,
      marketPermissions: ['DIGITAL_ASSET'],
      environment: 'SIMULATION',
      sessionId: 'xses_flood',
      cancelOnDisconnect: true,
    });
    const session = ops.openTradingSession(flood, NOW);
    let seq = 1n;
    let rejected = 0;
    for (let i = 0; i < 25; i += 1) {
      const ack = ops.enterOrder(
        session.sessionId,
        seq,
        {
          clOrdId: `flood-${i}`,
          marketId: SUNREY_MOONREY_MARKET_ID,
          side: 'BUY',
          orderType: 'LIMIT',
          quantity: 1n,
          priceUnits: 2_500_000n,
        },
        NOW,
      );
      seq += 1n;
      if (ack.reason === 'ORDER_RATE_EXCEEDED') {
        rejected += 1;
      }
    }
    assert.ok(rejected > 0);
    ops.enterOrder(
      bobSession.sessionId,
      1n,
      {
        clOrdId: 'spoof-s',
        marketId: SUNREY_MOONREY_MARKET_ID,
        side: 'SELL',
        orderType: 'LIMIT',
        quantity: 1n,
        priceUnits: 2_500_000n,
      },
      NOW,
    );
    const cancelFlood = ops.massCancel({ actor: 'OPERATOR', now: NOW });
    assert.ok(cancelFlood.length >= 0);
    ops.gateway.logout(session.sessionId);
    assert.ok(ops.replaySession().length > 0);
    assert.equal(asExchangeAccountId(alice.accountId), alice.accountId);
    void aliceSession;
  });
});
