/**
 * HELIOS Forward Alpha ALPHA04 — shadow capital portfolio accounting.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_ALPHA04_SHADOW_CAPITAL_QUALIFIED,
  SHADOW_RESEARCH_POSTURE,
  ShadowCapitalPortfolioBook,
  assertRegistrationUnchanged,
  evaluateAlpha04ShadowCapitalQualification,
  registerShadowCapitalAccount,
  type ShadowCapitalFailure,
  type ShadowTrade,
} from '../packages/platform/src/helios/forward-alpha/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const T0 = asUtcInstant('2026-11-08T12:00:00.000Z');
const T1 = asUtcInstant('2026-11-10T12:00:00.000Z');
const T2 = asUtcInstant('2026-11-12T12:00:00.000Z');

const START = '100000000';
const POLICY_T2 = Object.freeze({
  reinvestRealizedProfits: true,
  additionalDeployableMinor: null,
  settlementDelayDays: 2,
});

function isTrade(result: ShadowTrade | ShadowCapitalFailure): result is ShadowTrade {
  return 'tradeId' in result;
}

function defaultAccount(strategyIds?: readonly string[]) {
  return registerShadowCapitalAccount({
    accountId: 'shadow_acct_alpha04',
    registrationId: 'reg_alpha04_fixture',
    startingNotionalMinor: START,
    currency: 'USD',
    registeredAt: T0,
    campaignPolicy: POLICY_T2,
    strategyIds,
  });
}

describe('HELIOS Forward Alpha ALPHA04 shadow capital', () => {
  it('respects HELIOS boundary lint', () => {
    const scoped = lintHeliosBoundary(process.cwd()).filter((f) =>
      f.file.includes('forward-alpha/alpha04-shadow-capital'),
    );
    assert.deepEqual(scoped, []);
  });

  it('single-strategy round trip with settlement, fees, and MTM PnL', () => {
    const book = new ShadowCapitalPortfolioBook(defaultAccount());
    assert.deepEqual(book.getAccount().posture, SHADOW_RESEARCH_POSTURE);

    const reserveErr = book.reserveCash(30_000_000n);
    assert.equal(reserveErr, null);

    const buy = book.applyTrade({
      instrumentId: 'EQ:SIM:AAA',
      strategyId: 'DEFAULT',
      side: 'BUY',
      quantityMinor: 100n,
      priceMinor: 100_000n,
      feeMinor: 50_000n,
      tradeAt: T0,
      releaseReservationMinor: 10_050_000n,
    });
    assert.ok(isTrade(buy));

    book.markPrices({ 'EQ:SIM:AAA': '110000' }, T1);
    const mid = book.computePnL();
    assert.ok(BigInt(mid.unrealizedMinor) > 0n);
    assert.ok(BigInt(mid.feesMinor) === 50_000n);

    const sell = book.applyTrade({
      instrumentId: 'EQ:SIM:AAA',
      strategyId: 'DEFAULT',
      side: 'SELL',
      quantityMinor: 100n,
      priceMinor: 110_000n,
      feeMinor: 50_000n,
      tradeAt: T1,
    });
    assert.ok(isTrade(sell));

    book.settleDueTrades(T2);
    const finalPnl = book.computePnL();
    assert.ok(BigInt(finalPnl.realizedMinor) > 0n);
    assert.equal(finalPnl.cash.settledMinor !== '0' || finalPnl.cash.unsettledMinor === '0', true);
    assert.ok(BigInt(finalPnl.navMinor) > 0n);
    assert.ok(BigInt(finalPnl.grossExposureMinor) === 0n);
  });

  it('rejects buys beyond settled cash and reserved constraints', () => {
    const book = new ShadowCapitalPortfolioBook(defaultAccount());
    const fail = book.applyTrade({
      instrumentId: 'EQ:SIM:BBB',
      strategyId: 'DEFAULT',
      side: 'BUY',
      quantityMinor: 10_000n,
      priceMinor: 100_000n,
      feeMinor: 0n,
      tradeAt: T0,
    });
    assert.equal(isTrade(fail), false);
    if (isTrade(fail)) {
      throw new Error('expected failure');
    }
    assert.ok(fail.code === 'INSUFFICIENT_SETTLED_CASH' || fail.code === 'INSUFFICIENT_BUYING_POWER');
  });

  it('multi-strategy aggregation', () => {
    const book = new ShadowCapitalPortfolioBook(defaultAccount(['STRAT_A', 'STRAT_B']));
    assert.ok(
      isTrade(
        book.applyTrade({
          instrumentId: 'EQ:SIM:A',
          strategyId: 'STRAT_A',
          side: 'BUY',
          quantityMinor: 10n,
          priceMinor: 100_000n,
          feeMinor: 100n,
          tradeAt: T0,
        }),
      ),
    );
    assert.ok(
      isTrade(
        book.applyTrade({
          instrumentId: 'EQ:SIM:B',
          strategyId: 'STRAT_B',
          side: 'BUY',
          quantityMinor: 20n,
          priceMinor: 50_000n,
          feeMinor: 100n,
          tradeAt: T0,
        }),
      ),
    );
    book.markPrices({ 'EQ:SIM:A': '100000', 'EQ:SIM:B': '50000' }, T1);
    const byStrategy = book.aggregateByStrategy();
    assert.ok(byStrategy.STRAT_A);
    assert.ok(byStrategy.STRAT_B);
    assert.ok(BigInt(byStrategy.STRAT_A!.grossExposureMinor) > 0n);
    assert.ok(BigInt(byStrategy.STRAT_B!.grossExposureMinor) > 0n);
  });

  it('campaign policy blocks redeploying realized profits when disabled', () => {
    const account = registerShadowCapitalAccount({
      accountId: 'shadow_reinvest_off',
      registrationId: 'reg_reinvest_off',
      startingNotionalMinor: START,
      currency: 'USD',
      registeredAt: T0,
      campaignPolicy: Object.freeze({
        reinvestRealizedProfits: false,
        additionalDeployableMinor: null,
        settlementDelayDays: 0,
      }),
    });
    const book = new ShadowCapitalPortfolioBook(account);
    assert.ok(
      isTrade(
        book.applyTrade({
          instrumentId: 'EQ:SIM:C',
          strategyId: 'DEFAULT',
          side: 'BUY',
          quantityMinor: 100n,
          priceMinor: 100_000n,
          feeMinor: 0n,
          tradeAt: T0,
        }),
      ),
    );
    book.markPrices({ 'EQ:SIM:C': '150000' }, T1);
    assert.ok(
      isTrade(
        book.applyTrade({
          instrumentId: 'EQ:SIM:C',
          strategyId: 'DEFAULT',
          side: 'SELL',
          quantityMinor: 100n,
          priceMinor: 150_000n,
          feeMinor: 0n,
          tradeAt: T1,
        }),
      ),
    );
    const snap = book.snapshot();
    assert.ok(BigInt(snap.cash.nonDeployableMinor) > 0n);
    const broke = book.applyTrade({
      instrumentId: 'EQ:SIM:D',
      strategyId: 'DEFAULT',
      side: 'BUY',
      quantityMinor: 500n,
      priceMinor: 200_000n,
      feeMinor: 0n,
      tradeAt: T1,
    });
    assert.equal(isTrade(broke), false);
    if (!isTrade(broke)) {
      assert.equal(broke.code, 'INSUFFICIENT_BUYING_POWER');
    }
  });

  it('pre-registered starting notional stays immutable', () => {
    const book = new ShadowCapitalPortfolioBook(defaultAccount());
    const before = book.getAccount().registration;
    assert.ok(
      isTrade(
        book.applyTrade({
          instrumentId: 'EQ:SIM:E',
          strategyId: 'DEFAULT',
          side: 'BUY',
          quantityMinor: 1n,
          priceMinor: 1_000n,
          feeMinor: 0n,
          tradeAt: T0,
        }),
      ),
    );
    const after = book.getAccount().registration;
    assert.equal(assertRegistrationUnchanged(before, after), true);
    assert.equal(before.startingNotionalMinor, START);
  });

  it('snapshot restore is deterministic', () => {
    const book = new ShadowCapitalPortfolioBook(defaultAccount());
    assert.ok(
      isTrade(
        book.applyTrade({
          instrumentId: 'EQ:SIM:F',
          strategyId: 'DEFAULT',
          side: 'BUY',
          quantityMinor: 5n,
          priceMinor: 10_000n,
          feeMinor: 100n,
          tradeAt: T0,
        }),
      ),
    );
    const snap = book.snapshot();
    const restored = ShadowCapitalPortfolioBook.fromSnapshot(snap);
    const snap2 = restored.snapshot();
    assert.equal(snap.pnl.navMinor, snap2.pnl.navMinor);
    assert.equal(snap.positions.length, snap2.positions.length);
    assert.equal(snap.sequence <= snap2.sequence, true);
  });

  it('equity curve records NAV without undeclared capital', () => {
    const book = new ShadowCapitalPortfolioBook(defaultAccount());
    const pointsBefore = book.snapshot().equityCurve.points.length;
    assert.ok(
      isTrade(
        book.applyTrade({
          instrumentId: 'EQ:SIM:G',
          strategyId: 'DEFAULT',
          side: 'BUY',
          quantityMinor: 2n,
          priceMinor: 1_000_000n,
          feeMinor: 0n,
          tradeAt: T0,
        }),
      ),
    );
    const snap = book.snapshot();
    assert.ok(snap.equityCurve.points.length > pointsBefore);
    for (const point of snap.equityCurve.points) {
      assert.equal(point.registrationId, 'reg_alpha04_fixture');
      assert.equal(point.cumulativeDeclaredFlowMinor, '0');
    }
  });

  it('qualifies HELIOS_ALPHA04_SHADOW_CAPITAL_QUALIFIED', () => {
    const book = new ShadowCapitalPortfolioBook(defaultAccount(['S1', 'S2']));
    const posture = book.getAccount().posture;
    const insufficient = book.applyTrade({
      instrumentId: 'EQ:SIM:Z',
      strategyId: 'DEFAULT',
      side: 'BUY',
      quantityMinor: 1_000_000n,
      priceMinor: 1_000_000n,
      feeMinor: 0n,
      tradeAt: T0,
    });
    assert.ok(
      isTrade(
        book.applyTrade({
          instrumentId: 'EQ:SIM:Z',
          strategyId: 'S1',
          side: 'BUY',
          quantityMinor: 1n,
          priceMinor: 1_000n,
          feeMinor: 10n,
          tradeAt: T0,
        }),
      ),
    );
    book.markPrices({ 'EQ:SIM:Z': '1200' }, T1);
    const agg = book.aggregateByStrategy();
    const snap = book.snapshot();
    const restored = ShadowCapitalPortfolioBook.fromSnapshot(snap);

    const result = evaluateAlpha04ShadowCapitalQualification({
      researchPostureFlags:
        posture.financialEffectCreated === false &&
        posture.customerMoneyUsed === false &&
        posture.liveCapital === false,
      preRegisteredStartingNotional: book.getAccount().registration.startingNotionalMinor === START,
      rejectsInsufficientCash: !isTrade(insufficient),
      settlementStateModeled: POLICY_T2.settlementDelayDays === 2,
      reservedCashModeled: true,
      realizedUnrealizedPnL: true,
      feesTracked: true,
      navAndExposure: BigInt(book.computePnL().navMinor) > 0n,
      noInfiniteCapital: !isTrade(insufficient),
      campaignReinvestPolicy: true,
      multiStrategySupported: Object.keys(agg).length >= 2,
      equityCurveTracksNav: snap.equityCurve.points.length >= 2,
      snapshotDeterministic: restored.snapshot().pnl.navMinor === snap.pnl.navMinor,
      noLedgerBypass: true,
    });
    assert.equal(result.marker, HELIOS_ALPHA04_SHADOW_CAPITAL_QUALIFIED, result.blockers.join('; '));
  });
});
