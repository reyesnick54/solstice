import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GrowthAttributionLedger } from '../packages/platform/src/growth/GrowthAttributionLedger.ts';
import {
  CANONICAL_REALIZATION,
  GROWTH_SOURCE_COUNT,
  GROWTH_SOURCES,
  REALIZATION_CLASS_COUNT,
  REALIZATION_CLASSES,
  COST_AVOIDED_SOURCES,
} from '../packages/contracts/src/growth-catalog.ts';
import { asCustomerId, asEventId } from '../packages/contracts/src/ids.ts';
import { asUtcInstant } from '../packages/contracts/src/time.ts';
import { Money } from '../packages/contracts/src/money.ts';

describe('Growth Attribution Ledger', () => {
  it('defines exactly 13 sources and 4 realization classes', () => {
    assert.equal(GROWTH_SOURCES.length, 13);
    assert.equal(GROWTH_SOURCE_COUNT, 13);
    assert.equal(REALIZATION_CLASSES.length, 4);
    assert.equal(REALIZATION_CLASS_COUNT, 4);
    assert.deepEqual([...REALIZATION_CLASSES], [
      'SETTLED_CASH',
      'UNREALIZED',
      'COST_AVOIDED',
      'PENDING',
    ]);
  });

  it('records every source against its canonical class and traces the originating event', () => {
    const gal = new GrowthAttributionLedger();
    const customerId = asCustomerId('cust_gal');
    for (const source of GROWTH_SOURCES) {
      const eventId = asEventId(`evt_${source}`);
      const entry = gal.record({
        customerId,
        source,
        amount: Money.fromMinorUnits(100n, 'USD'),
        originatingEventId: eventId,
        recordedAt: asUtcInstant('2026-08-10T12:00:00.000Z'),
      });
      assert.equal(entry.realizationClass, CANONICAL_REALIZATION[source]);
      assert.equal(entry.originatingEventId, eventId);
      assert.equal(entry.presentedAsIncome, false);
      if (entry.realizationClass === 'SETTLED_CASH') {
        assert.equal(entry.presentedAsWithdrawable, true);
      } else {
        assert.equal(entry.presentedAsWithdrawable, false);
      }
      if (entry.realizationClass === 'UNREALIZED') {
        assert.equal(entry.presentedAsWithdrawable, false);
      }
    }
    assert.equal(gal.count(), 13);

    const weekly = gal.summarize({
      customerId,
      period: 'WEEKLY',
      from: asUtcInstant('2026-08-06T00:00:00.000Z'),
      to: asUtcInstant('2026-08-13T00:00:00.000Z'),
      currency: 'USD',
    });

    for (const source of COST_AVOIDED_SOURCES) {
      assert.equal(weekly.bySource[source].minorUnits, 100n);
    }
    assert.equal(weekly.costAvoidedTotal.minorUnits, BigInt(COST_AVOIDED_SOURCES.length) * 100n);
    assert.equal('income' in weekly, false);
    assert.ok(weekly.unrealizedTotal.isPositive());
    assert.equal(weekly.byRealizationClass.UNREALIZED.minorUnits, weekly.unrealizedTotal.minorUnits);

    const daily = gal.summarize({
      customerId,
      period: 'DAILY',
      from: asUtcInstant('2026-08-10T00:00:00.000Z'),
      to: asUtcInstant('2026-08-10T23:59:59.000Z'),
      currency: 'USD',
    });
    const monthly = gal.summarize({
      customerId,
      period: 'MONTHLY',
      from: asUtcInstant('2026-08-01T00:00:00.000Z'),
      to: asUtcInstant('2026-08-31T23:59:59.000Z'),
      currency: 'USD',
    });
    const lifetime = gal.summarize({
      customerId,
      period: 'LIFETIME',
      from: asUtcInstant('1970-01-01T00:00:00.000Z'),
      to: asUtcInstant('2026-08-13T00:00:00.000Z'),
      currency: 'USD',
    });
    assert.equal(daily.period, 'DAILY');
    assert.equal(monthly.settledCashTotal.minorUnits, weekly.settledCashTotal.minorUnits);
    assert.equal(lifetime.pendingTotal.minorUnits, weekly.pendingTotal.minorUnits);
  });

  it('never presents cost-avoided as income or unrealized as withdrawable', () => {
    const gal = new GrowthAttributionLedger();
    const customerId = asCustomerId('cust_honest');
    const avoided = gal.record({
      customerId,
      source: 'SUBSCRIPTION_CANCELLATION',
      amount: Money.fromMinorUnits(1599n, 'USD'),
      originatingEventId: asEventId('evt_sub'),
      recordedAt: asUtcInstant('2026-08-11T00:00:00.000Z'),
    });
    const unrealized = gal.record({
      customerId,
      source: 'UNREALIZED_MARK_TO_MARKET',
      amount: Money.fromMinorUnits(8800n, 'USD'),
      originatingEventId: asEventId('evt_mtm'),
      recordedAt: asUtcInstant('2026-08-11T00:00:00.000Z'),
    });
    assert.equal(avoided.presentedAsIncome, false);
    assert.equal(avoided.realizationClass, 'COST_AVOIDED');
    assert.equal(avoided.presentedAsWithdrawable, false);
    assert.equal(unrealized.presentedAsWithdrawable, false);
    assert.equal(unrealized.realizationClass, 'UNREALIZED');

    const delta = gal.summarize({
      customerId,
      period: 'DAILY',
      from: asUtcInstant('2026-08-11T00:00:00.000Z'),
      to: asUtcInstant('2026-08-11T23:59:59.000Z'),
      currency: 'USD',
    });
    assert.equal(delta.settledCashTotal.isZero(), true);
    assert.equal(delta.costAvoidedTotal.minorUnits, 1599n);
    assert.equal(delta.unrealizedTotal.minorUnits, 8800n);
  });

  it('skips principal deposits as non-growth', () => {
    const gal = new GrowthAttributionLedger();
    gal.skipPrincipalDeposit('PRINCIPAL_DEPOSIT_IS_NOT_ECONOMIC_IMPROVEMENT');
    assert.equal(gal.count(), 0);
  });
});
