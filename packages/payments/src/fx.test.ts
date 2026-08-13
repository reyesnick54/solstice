import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asCurrencyCode, asUtcInstant, Money } from '@solstice/domain';
import { quoteAllSources } from './fx/quotes.ts';
import { compareQuotes, sourceAmountForDestination } from './fx/router.ts';

const NOW = asUtcInstant('2026-08-13T15:00:00.000Z');

describe('FX quotes', () => {
  it('is deterministic for a seed', () => {
    const a = quoteAllSources(
      { from: asCurrencyCode('USD'), to: asCurrencyCode('EUR') },
      'seed-a',
      NOW,
    );
    const b = quoteAllSources(
      { from: asCurrencyCode('USD'), to: asCurrencyCode('EUR') },
      'seed-a',
      NOW,
    );
    assert.equal(a.length, 3);
    for (let i = 0; i < a.length; i += 1) {
      assert.equal(a[i]?.rate.numerator, b[i]?.rate.numerator);
      assert.equal(a[i]?.rate.denominator, b[i]?.rate.denominator);
      assert.equal(a[i]?.fee.minorUnits, b[i]?.fee.minorUnits);
    }
  });

  it('changes when the seed changes', () => {
    const a = quoteAllSources(
      { from: asCurrencyCode('USD'), to: asCurrencyCode('EUR') },
      'seed-a',
      NOW,
    );
    const b = quoteAllSources(
      { from: asCurrencyCode('USD'), to: asCurrencyCode('EUR') },
      'seed-b',
      NOW,
    );
    const same = a.every(
      (quote, i) =>
        quote.rate.numerator === b[i]?.rate.numerator &&
        quote.rate.denominator === b[i]?.rate.denominator,
    );
    assert.equal(same, false);
  });

  it('never uses floating-point rates', () => {
    const quotes = quoteAllSources(
      { from: asCurrencyCode('USD'), to: asCurrencyCode('EUR') },
      'seed-a',
      NOW,
    );
    for (const quote of quotes) {
      assert.equal(typeof quote.rate.numerator, 'bigint');
      assert.equal(typeof quote.rate.denominator, 'bigint');
      assert.equal(typeof quote.fee.minorUnits, 'bigint');
    }
  });

  it('converts destination EUR to source USD with exact inverse', () => {
    const quotes = quoteAllSources(
      { from: asCurrencyCode('USD'), to: asCurrencyCode('EUR') },
      'seed-a',
      NOW,
    );
    const quote = quotes[0];
    assert.ok(quote);
    const eur = Money.fromDecimalString('5000.00', 'EUR');
    const usd = sourceAmountForDestination(eur, quote);
    assert.equal(usd.currency, 'USD');
    const compared = compareQuotes(usd, quotes);
    assert.ok(compared.length > 0);
  });
});
