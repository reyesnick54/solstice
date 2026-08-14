import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asCurrencyCode, asUtcInstant, Money } from '@solstice/domain';
import { quoteAllSources } from './fx/quotes.ts';
import { createSimulatedRails } from './rails/index.ts';
import { scoreRoutes } from './routing/engine.ts';

const NOW = asUtcInstant('2026-08-13T15:00:00.000Z');

describe('route scoring', () => {
  it('is deterministic', () => {
    const rails = Object.values(createSimulatedRails());
    const quotes = quoteAllSources(
      { from: asCurrencyCode('USD'), to: asCurrencyCode('EUR') },
      'seed-a',
      NOW,
    );
    const instruction = {
      paymentId: 'pay',
      sourceCountry: 'US',
      destinationCountry: 'DE',
      currency: 'EUR',
      amount: Money.fromDecimalString('5000.00', 'EUR'),
      debtorName: 'Jane',
      creditorName: 'Ahmed',
      creditorIban: 'DE00',
      creditorBic: 'COBADEFF',
    };
    const a = scoreRoutes({
      rails,
      instruction,
      sourceCurrency: 'USD',
      fxQuote: quotes[0],
      fxQuotes: quotes,
      corridorPermitted: true,
    });
    const b = scoreRoutes({
      rails,
      instruction,
      sourceCurrency: 'USD',
      fxQuote: quotes[0],
      fxQuotes: quotes,
      corridorPermitted: true,
    });
    assert.equal(a.chosen?.railId, b.chosen?.railId);
    assert.deepEqual(
      a.ranked.map((row) => row.score.toString()),
      b.ranked.map((row) => row.score.toString()),
    );
  });

  it('excludes non-permitted routes rather than scoring them low', () => {
    const rails = Object.values(createSimulatedRails());
    const instruction = {
      paymentId: 'pay',
      sourceCountry: 'US',
      destinationCountry: 'DE',
      currency: 'EUR',
      amount: Money.fromDecimalString('5000.00', 'EUR'),
      debtorName: 'Jane',
      creditorName: 'Ahmed',
      creditorIban: 'DE00',
    };
    const denied = scoreRoutes({
      rails,
      instruction,
      sourceCurrency: 'USD',
      fxQuote: undefined,
      fxQuotes: [],
      corridorPermitted: false,
    });
    assert.equal(denied.chosen, undefined);
    assert.equal(denied.ranked.length, 0);
    assert.ok(denied.excluded.length > 0);
    for (const row of denied.excluded) {
      assert.equal(row.regulatory, 'EXCLUDED');
      assert.equal(row.exclusionReason, 'corridor is not permitted by policy');
    }

    const allowed = scoreRoutes({
      rails,
      instruction,
      sourceCurrency: 'USD',
      fxQuote: undefined,
      fxQuotes: [],
      corridorPermitted: true,
    });
    for (const row of allowed.ranked) {
      assert.ok(row.railId !== undefined);
    }
    for (const row of allowed.excluded) {
      assert.notEqual(row.regulatory, 'PERMITTED');
    }
    if (allowed.chosen) {
      assert.equal(
        allowed.excluded.some((row) => row.railId === allowed.chosen?.railId),
        false,
      );
    }
  });

  it('never selects domestic for a cross-border EUR payout', () => {
    const rails = Object.values(createSimulatedRails());
    const decision = scoreRoutes({
      rails,
      instruction: {
        paymentId: 'pay',
        sourceCountry: 'US',
        destinationCountry: 'DE',
        currency: 'EUR',
        amount: Money.fromDecimalString('5000.00', 'EUR'),
        debtorName: 'Jane',
        creditorName: 'Ahmed',
        creditorIban: 'DE00',
      },
      sourceCurrency: 'USD',
      fxQuote: undefined,
      fxQuotes: [],
      corridorPermitted: true,
    });
    assert.ok(decision.excluded.some((row) => row.railId === 'domestic'));
    assert.equal(
      decision.ranked.some((row) => row.railId === 'domestic'),
      false,
    );
    assert.notEqual(decision.chosen?.railId, 'domestic');
  });
});
