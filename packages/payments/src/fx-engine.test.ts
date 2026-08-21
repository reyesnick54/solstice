import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asCurrencyCode } from '../../domain/src/currency.ts';
import { asLegalEntityId } from '../../domain/src/legal-entity.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { Money, RoundingMode } from '../../money/src/money.ts';
import { convertExact } from './fx-rate.ts';
import { quoteIsExpired } from './fx-quote.ts';
import { QUOTE_TTL_MS, SimulationFxProvider } from './fx-provider.ts';
import { applyFixedAndPercentageFee, resolvePairPricing, SIMULATION_PRICING_POLICY } from './fx-pricing.ts';
import { listSupportedCurrencies } from './fx-currency.ts';
import { valuePositions } from './fx-valuation.ts';
import { asCorridorId, asQuoteId } from './ids.ts';

const NOW = asUtcInstant('2026-08-14T12:00:00.000Z');

describe('FX engine unit surface', () => {
  it('lists supported currencies without implying live capability', () => {
    const currencies = listSupportedCurrencies();
    assert.deepEqual(currencies.map((row) => row.code), ['USD', 'EUR', 'GBP', 'SAR', 'AED']);
    for (const row of currencies) {
      assert.equal(row.liveEnabled, false);
      assert.equal(row.liveFxAvailable, false);
      assert.equal(row.fxAvailable, true);
      assert.ok(Number.isInteger(row.minorUnitExponent));
    }
  });

  it('uses bigint HALF_EVEN conversion and server-controlled fees', () => {
    const source = Money.fromMinorUnits(100_000n, 'USD');
    const dest = convertExact(
      source,
      {
        kind: 'CUSTOMER',
        base: 'USD',
        quote: 'SAR',
        numerator: 3745n,
        denominator: 1000n,
        timestamp: NOW,
        source: 'SIMULATION_CUSTOMER',
      },
      RoundingMode.HALF_EVEN,
    );
    assert.equal(dest.minorUnits, 374_500n);
    const pricing = resolvePairPricing(SIMULATION_PRICING_POLICY, 'USD/SAR');
    assert.ok(pricing);
    const fee = applyFixedAndPercentageFee(source, pricing, 1500n);
    assert.equal(fee.minorUnits, 1500n);
  });

  it('keeps issued quote terms immutable and marks simulation', () => {
    const clock = new FrozenClock(NOW);
    const provider = new SimulationFxProvider(clock);
    const quote = provider.quote({
      quoteId: asQuoteId('q_immut'),
      baseCurrency: asCurrencyCode('USD'),
      quoteCurrency: asCurrencyCode('SAR'),
      sourceAmount: Money.fromMinorUnits(100_000n, 'USD'),
      corridorId: asCorridorId('GB-SA-USD-SAR'),
      legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
      now: NOW,
    });
    assert.equal(quote.customerRate.numerator, 3745n);
    assert.equal(quote.destinationAmount.minorUnits, 374_500n);
    assert.equal(quote.fee.minorUnits, 1_500n);
    assert.equal(quote.rateSource, 'SIMULATION_REF_NOT_LIVE_MARKET');
    assert.equal(QUOTE_TTL_MS, 60_000n);
    assert.equal(quoteIsExpired(quote, asUtcInstant('2026-08-14T12:00:59.999Z')), false);
    assert.equal(quoteIsExpired(quote, asUtcInstant('2026-08-14T12:01:00.000Z')), true);
    assert.throws(() => {
      (quote as { status: string }).status = 'EXECUTED';
    });
  });

  it('exposes provider lifecycle modes', () => {
    const clock = new FrozenClock(NOW);
    const provider = new SimulationFxProvider(clock);
    provider.setMode('PROVIDER_UNAVAILABLE');
    const unavailable = provider.getQuote({
      quoteId: asQuoteId('q_down'),
      baseCurrency: asCurrencyCode('USD'),
      quoteCurrency: asCurrencyCode('SAR'),
      sourceAmount: Money.fromMinorUnits(100_000n, 'USD'),
      corridorId: asCorridorId('US-SA-USD-SAR'),
      legalEntityId: asLegalEntityId('le_solstice_us_inc'),
      now: NOW,
    });
    assert.equal(unavailable.ok, false);
    provider.setMode('NORMAL');
    const quoted = provider.getQuote({
      quoteId: asQuoteId('q_ok'),
      baseCurrency: asCurrencyCode('USD'),
      quoteCurrency: asCurrencyCode('SAR'),
      sourceAmount: Money.fromMinorUnits(100_000n, 'USD'),
      corridorId: asCorridorId('US-SA-USD-SAR'),
      legalEntityId: asLegalEntityId('le_solstice_us_inc'),
      now: NOW,
    });
    assert.equal(quoted.ok, true);
    provider.setMode('EXECUTION_FAILED');
    const failed = provider.executeQuote({
      quote: quoted.value,
      now: NOW,
      tradeId: 'fxtr_fail',
    });
    assert.equal(failed.ok, false);
    if (!failed.ok) {
      assert.equal(failed.code, 'EXECUTION_FAILED');
    }
    provider.setMode('EXECUTION_PENDING');
    const pending = provider.executeQuote({
      quote: quoted.value,
      now: NOW,
      tradeId: 'fxtr_pending',
    });
    assert.equal(pending.ok, true);
    assert.equal(pending.value.status, 'PENDING');
    const cancelled = provider.cancel('fxtr_pending');
    assert.equal(cancelled.ok, true);
    assert.equal(cancelled.value.status, 'CANCELLED');
  });

  it('values mixed positions as presentation-only', () => {
    const clock = new FrozenClock(NOW);
    const provider = new SimulationFxProvider(clock);
    const valuation = valuePositions({
      positions: [
        { currency: 'USD', minorUnits: 100_000n },
        { currency: 'SAR', minorUnits: 374_500n },
        { currency: 'EUR', minorUnits: 10_000n },
      ],
      targetCurrency: 'USD',
      now: NOW,
      rates: {
        getReferenceRate: (base, quote, at) => {
          const result = provider.getReferenceRate({ baseCurrency: base, quoteCurrency: quote, at });
          return result.ok ? result.value : undefined;
        },
      },
    });
    assert.equal(valuation.authority, 'PRESENTATION_ONLY_NOT_LEDGER');
    assert.equal(valuation.ledgerAuthoritative, false);
    assert.equal(valuation.available, true);
    assert.ok(valuation.aggregateMinorUnits);
    assert.equal(valuation.lines.length, 3);
    assert.ok(valuation.lines[0]?.rateTimestamp);
  });
});
