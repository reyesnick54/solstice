import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asCurrencyCode } from './currency.ts';
import { Money, applyFxRate, formatMoney } from './money.ts';
import { asRational, gcd, roundHalfAwayFromZero } from './rational.ts';
import { asUtcInstant } from './time.ts';

describe('Money', () => {
  it('rejects number minor units', () => {
    assert.throws(() => Money.of(100 as unknown as bigint, 'USD'), /bigint/);
  });

  it('parses decimal strings exactly', () => {
    const amount = Money.fromDecimalString('5000.00', 'EUR');
    assert.equal(amount.minorUnits, 500000n);
    assert.equal(amount.currency, 'EUR');
    assert.equal(formatMoney(amount), '5000.00 EUR');
  });

  it('refuses to add mixed currencies', () => {
    const usd = Money.fromDecimalString('10.00', 'USD');
    const eur = Money.fromDecimalString('10.00', 'EUR');
    assert.throws(() => usd.add(eur), /explicit FX conversion/);
  });

  it('applies an exact rational rate', () => {
    const usd = Money.fromDecimalString('100.00', 'USD');
    const converted = applyFxRate(usd, {
      from: asCurrencyCode('USD'),
      to: asCurrencyCode('EUR'),
      rate: asRational(9n, 10n),
      timestamp: asUtcInstant('2026-08-13T15:00:00.000Z'),
    });
    assert.equal(converted.currency, 'EUR');
    assert.equal(converted.minorUnits, 9000n);
  });
});

describe('rational rounding', () => {
  it('rounds half away from zero', () => {
    assert.equal(roundHalfAwayFromZero(1n, 2n), 1n);
    assert.equal(roundHalfAwayFromZero(-1n, 2n), -1n);
    assert.equal(roundHalfAwayFromZero(1n, 3n), 0n);
  });

  it('gcd is exact', () => {
    assert.equal(gcd(12n, 8n), 4n);
    assert.equal(gcd(7n, 13n), 1n);
  });
});
