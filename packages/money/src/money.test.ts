import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyFxConversion,
  MAX_ABS_MINOR_UNITS,
  Money,
  RoundingMode,
  roundQuotient,
} from './money.ts';

describe('Money', () => {
  it('stores bigint minor units and rejects number construction', () => {
    const amount = Money.fromMinorUnits(10000n, 'USD');
    assert.equal(amount.minorUnits, 10000n);
    assert.equal(amount.currency, 'USD');
    assert.throws(
      () => Money.fromMinorUnits(100 as unknown as bigint, 'USD'),
      /bigint/,
    );
  });

  it('rejects decimal strings', () => {
    assert.throws(() => Money.fromMinorUnitsString('100.00', 'USD'));
    assert.throws(() => Money.fromMinorUnitsString('1e2', 'USD'));
  });

  it('adds and subtracts same-currency amounts', () => {
    const a = Money.fromMinorUnits(100n, 'USD');
    const b = Money.fromMinorUnits(40n, 'USD');
    assert.equal(a.plus(b).minorUnits, 140n);
    assert.equal(a.minus(b).minorUnits, 60n);
    assert.equal(a.minorUnits, 100n);
  });

  it('refuses mixed-currency arithmetic', () => {
    const usd = Money.fromMinorUnits(100n, 'USD');
    const gbp = Money.fromMinorUnits(100n, 'GBP');
    assert.throws(() => usd.plus(gbp), /Currency mismatch/);
  });

  it('HALF_EVEN ties to even', () => {
    assert.equal(roundQuotient(5n, 2n, RoundingMode.HALF_EVEN), 2n);
    assert.equal(roundQuotient(7n, 2n, RoundingMode.HALF_EVEN), 4n);
  });

  it('FLOOR toward -infinity', () => {
    assert.equal(roundQuotient(-5n, 2n, RoundingMode.FLOOR), -3n);
  });

  it('rejects overflow beyond the safe minor-unit bound', () => {
    assert.throws(() => Money.fromMinorUnits(MAX_ABS_MINOR_UNITS + 1n, 'USD'), /overflow/);
    const near = Money.fromMinorUnits(MAX_ABS_MINOR_UNITS, 'USD');
    assert.throws(() => near.plus(Money.fromMinorUnits(1n, 'USD')), /overflow/);
  });

  it('accepts ISO 4217 codes and uppercase simulation book codes', () => {
    assert.equal(Money.fromMinorUnits(1n, 'JPY').currency, 'JPY');
    assert.equal(Money.fromMinorUnits(1n, 'KWD').currency, 'KWD');
    assert.equal(Money.fromMinorUnits(1n, 'SUNREY').currency, 'SUNREY');
    assert.throws(() => Money.fromMinorUnits(1n, 'usd'), /uppercase alphabetic/);
    assert.throws(() => Money.fromMinorUnits(1n, 'US'), /uppercase alphabetic/);
    assert.throws(() => Money.fromMinorUnits(1n, 'usd1'), /uppercase alphabetic/);
  });

  it('serializes minor units as a decimal-free string', () => {
    const amount = Money.fromMinorUnits(12345n, 'EUR');
    assert.deepEqual(amount.toJSON(), { minorUnits: '12345', currency: 'EUR' });
  });

  it('applies FX with bigint rate and timestamp', () => {
    const usd = Money.fromMinorUnits(10000n, 'USD');
    const gbp = applyFxConversion(usd, {
      from: 'USD',
      to: 'GBP',
      rate: { numerator: 8n, denominator: 10n },
      timestamp: '2026-08-13T15:00:00.000Z',
    });
    assert.equal(gbp.currency, 'GBP');
    assert.equal(gbp.minorUnits, 8000n);
  });
});
