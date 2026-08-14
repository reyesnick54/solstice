import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asCustomerId, asUtcInstant, Money } from '@solstice/domain';
import { LIVE_EXCHANGE_ENABLED } from '@solstice/flags';
import { journalBalances } from '@solstice/ledger';
import { ENVIRONMENT } from '@solstice/kernel';
import { isClearedOrder } from './cleared-order.ts';
import { MatchingEngine } from './matching.ts';
import { assertReplayDetectsAll, runManipulationReplay } from './replay.ts';
import { PyramidExchangeSystem } from './system.ts';
import { feeQuoteMinor, notionalQuoteMinor } from './types.ts';

describe('Phase 9 exit: manipulation scenarios are detected in replay testing', () => {
  it('meets the Phase 9 exit criterion and structural invariants', () => {
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
    assert.equal(ENVIRONMENT, 'simulation');

    const replay = runManipulationReplay();
    assertReplayDetectsAll(replay);
    assert.equal(replay.length, 4);
    for (const scenario of replay) {
      assert.equal(scenario.detected, true, scenario.scenario);
      assert.ok(scenario.alerts.length > 0);
      assert.ok(scenario.alerts[0]!.evidence);
    }

    const exchange = new PyramidExchangeSystem('phase9-exit');
    exchange.bootstrapHouse();
    const alice = exchange.registerTrader({
      customerId: 'cust_alice',
      name: 'Alice',
      jurisdiction: 'US',
      usd: 500_000n,
      pyr: 0n,
    });
    const bob = exchange.registerTrader({
      customerId: 'cust_bob',
      name: 'Bob',
      jurisdiction: 'GB',
      usd: 100_000n,
      pyr: 50_000n,
    });

    const disabled = exchange.place({
      id: 'ord_us_disabled',
      customerId: alice.customerId,
      side: 'BUY',
      type: 'LIMIT',
      quantity: 100n,
      price: 20000n,
    });
    assert.equal(disabled.ok, false);
    if (!disabled.ok) {
      assert.match(disabled.error.reasons.join(' '), /listing approval|untradeable|US/);
    }
    assert.equal(exchange.engine.getOrder('ord_us_disabled'), undefined);

    for (const entry of exchange.registry.listEntries()) {
      if (!entry.approval) {
        assert.equal(entry.capabilities.SPOT_TRADE, false);
        assert.notEqual(entry.legalReviewState, 'CONFIRMED_BY_COUNSEL');
      }
    }

    exchange.approveListing({
      jurisdiction: 'GB',
      capabilities: ['SPOT_TRADE', 'CROSS_BORDER_TRANSFER'],
      reason: 'simulation listing for replay-tested GB book',
    });
    assert.equal(exchange.registry.getEntry('GB')?.legalReviewState, 'DRAFT');

    const sell = exchange.place({
      id: 'ord_sell',
      customerId: bob.customerId,
      side: 'SELL',
      type: 'LIMIT',
      quantity: 100n,
      price: 20000n,
      sequence: 1,
    });
    assert.equal(sell.ok, true);

    const buy = exchange.place({
      id: 'ord_buy',
      customerId: alice.customerId,
      side: 'BUY',
      type: 'LIMIT',
      quantity: 60n,
      price: 20000n,
      sequence: 2,
      actor: { type: 'CUSTOMER', id: 'alice_actor' as never, customerId: alice.customerId },
    });
    assert.equal(buy.ok, false, 'Alice is still US-jurisdiction and must be refused at order entry');

    const carol = exchange.registerTrader({
      customerId: 'cust_carol',
      name: 'Carol',
      jurisdiction: 'GB',
      usd: 400_000n,
      pyr: 0n,
    });
    const take = exchange.place({
      id: 'ord_take',
      customerId: carol.customerId,
      side: 'BUY',
      type: 'LIMIT',
      quantity: 60n,
      price: 20000n,
      sequence: 3,
    });
    assert.equal(take.ok, true);
    if (take.ok) {
      assert.equal(take.value.fills.length, 1);
      assert.equal(take.value.fills[0]!.quantity, 60n);
      assert.equal(exchange.engine.getOrder('ord_sell')?.remaining, 40n);
      assert.equal(exchange.engine.getOrder('ord_sell')?.state, 'PARTIALLY_FILLED');
      for (const journal of take.value.journals) {
        assert.equal(journalBalances(journal.lines).ok, true);
        for (const line of journal.lines) {
          if (line.accountId === exchange.accountId('HOUSE', 'FEE')) {
            assert.ok(line.amount.minorUnits > 0n);
          }
          if (String(line.accountId).includes('cust_') && journal.memo.includes('fee->house_fee')) {
            if (line.accountId === exchange.accountId('HOUSE', 'FEE')) {
              assert.fail('fee account is not a customer account');
            }
          }
        }
        const feeLines = journal.lines.filter((line) => String(line.accountId) === 'house_fee_USD');
        assert.equal(feeLines.length, 1);
        assert.equal(feeLines[0]!.direction, 'DEBIT');
      }
    }

    const sanctioned = exchange.registerTrader({
      customerId: 'cust_blocked',
      name: 'Blocked Person',
      jurisdiction: 'GB',
      usd: 10_000n,
    });
    const refused = exchange.place({
      id: 'ord_blocked',
      customerId: sanctioned.customerId,
      side: 'BUY',
      type: 'LIMIT',
      quantity: 10n,
      price: 20000n,
      sequence: 4,
    });
    assert.equal(refused.ok, false);
    assert.equal(exchange.engine.getOrder('ord_blocked'), undefined);
    if (!refused.ok) {
      assert.ok(refused.error.evidenceId || refused.error.decision);
    }

    const missingTravel = exchange.transfer({
      id: 'xfer_fail',
      actor: exchange.operator,
      occurredAt: asUtcInstant('2026-08-14T12:00:00.000Z'),
      assetId: 'PYR',
      quantity: 10n,
      originatorCustomerId: bob.customerId,
      beneficiaryCustomerId: carol.customerId,
      originatorJurisdiction: 'GB',
      beneficiaryJurisdiction: 'US',
      originatorFields: { legalName: 'Bob' },
      beneficiaryFields: { legalName: 'Carol' },
    });
    assert.equal(missingTravel.ok, false);
    if (!missingTravel.ok) {
      assert.equal(missingTravel.error.queued, false);
      assert.match(missingTravel.error.reasons.join(' '), /Travel Rule/);
    }

    const fiat = exchange.fiatConvert(carol.customerId, 'GB', Money.of(10000n, 'USD'));
    assert.equal(fiat.ok, false);

    exchange.custody.injectUncorrectedDivergence(carol.customerId, 'PYR', 99n);
    const halted = exchange.reconcile();
    assert.equal(halted.ok, false);
    if (!halted.ok) {
      assert.equal(halted.halted, true);
      assert.match(halted.reason, /without correction/);
    }
    assert.equal(exchange.kills.isEngaged('EXCHANGE'), true);

    const afterHalt = exchange.place({
      id: 'ord_after_halt',
      customerId: carol.customerId,
      side: 'BUY',
      type: 'LIMIT',
      quantity: 1n,
      price: 20000n,
      sequence: 9,
    });
    assert.equal(afterHalt.ok, false);

    const switches: Array<'EXCHANGE' | 'ASSET_PAIR' | 'CUSTOMER' | 'JURISDICTION' | 'WITHDRAWALS' | 'FIAT_GATEWAY'> = [
      'EXCHANGE',
      'ASSET_PAIR',
      'CUSTOMER',
      'JURISDICTION',
      'WITHDRAWALS',
      'FIAT_GATEWAY',
    ];
    const fresh = new PyramidExchangeSystem('kill-proof');
    fresh.bootstrapHouse();
    const trader = fresh.registerTrader({ customerId: 'cust_k', name: 'K', jurisdiction: 'GB', usd: 10000n, pyr: 10000n });
    fresh.approveListing({ jurisdiction: 'GB', capabilities: ['SPOT_TRADE'], reason: 'kill-switch proof' });
    for (const id of switches) {
      fresh.toggleKillSwitch(id, true, `engage ${id}`, id === 'CUSTOMER' ? trader.customerId : id === 'ASSET_PAIR' ? 'PYR/USD' : id === 'JURISDICTION' ? 'GB' : undefined);
      assert.equal(
        fresh.kills.isEngaged(id, id === 'CUSTOMER' ? trader.customerId : id === 'ASSET_PAIR' ? 'PYR/USD' : id === 'JURISDICTION' ? 'GB' : undefined),
        true,
        id,
      );
    }

    const chain = exchange.evidenceVerified();
    assert.equal(chain.ok, true);

    const engine = new MatchingEngine('struct');
    assert.throws(() => engine.accept({ order: { id: 'x' } } as never), /ClearedOrder/);
    assert.equal(isClearedOrder({}), false);

    assert.equal(feeQuoteMinor(notionalQuoteMinor(100n, 20000n)), 20n);
    assert.ok(asCustomerId('cust_alice'));
  });
});
