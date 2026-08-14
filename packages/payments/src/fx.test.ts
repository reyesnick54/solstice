import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { Money, RoundingMode } from '../../money/src/money.ts';
import { convertExact } from './fx-rate.ts';
import { quoteIsExpired } from './fx-quote.ts';
import { QUOTE_TTL_MS, SimulationFxProvider } from './fx-provider.ts';
import { asCorridorId, asQuoteId } from './ids.ts';

const NOW = asUtcInstant('2026-08-14T12:00:00.000Z');

describe('FX exact rational math', () => {
  it('converts 100000 USD cents at 3745/1000 to 374500 SAR halalas', () => {
    const source = Money.fromMinorUnits(100_000n, 'USD');
    const dest = convertExact(source, {
      base: 'USD',
      quote: 'SAR',
      numerator: 3745n,
      denominator: 1000n,
      timestamp: NOW,
      source: 'SIMULATION_CUSTOMER',
    }, RoundingMode.HALF_EVEN);
    assert.equal(dest.currency, 'SAR');
    assert.equal(dest.minorUnits, 374_500n);
  });

  it('never uses floating point for the USD/SAR customer rate', () => {
    const clock = new FrozenClock(NOW);
    const provider = new SimulationFxProvider(clock);
    const quote = provider.quote({
      quoteId: asQuoteId('q_math'),
      baseCurrency: 'USD',
      quoteCurrency: 'SAR',
      sourceAmount: Money.fromMinorUnits(100_000n, 'USD'),
      corridorId: asCorridorId('US-SA-USD-SAR'),
      legalEntityId: 'le_solstice_us_inc',
      now: NOW,
    });
    assert.equal(quote.customerRate.numerator, 3745n);
    assert.equal(quote.customerRate.denominator, 1000n);
    assert.equal(quote.marketRate.numerator, 15n);
    assert.equal(quote.marketRate.denominator, 4n);
    assert.equal(quote.destinationAmount.minorUnits, 374_500n);
    assert.equal(quote.fee.minorUnits, 1_500n);
    assert.equal(quote.amountDebited.minorUnits, 101_500n);
    assert.equal(quote.rateSource, 'SIMULATION_REF_NOT_LIVE_MARKET');
  });

  it('treats the exact expiry timestamp as expired and the prior millisecond as live', () => {
    const clock = new FrozenClock(NOW);
    const provider = new SimulationFxProvider(clock);
    const quote = provider.quote({
      quoteId: asQuoteId('q_exp'),
      baseCurrency: 'USD',
      quoteCurrency: 'SAR',
      sourceAmount: Money.fromMinorUnits(100_000n, 'USD'),
      corridorId: asCorridorId('US-SA-USD-SAR'),
      legalEntityId: 'le_solstice_us_inc',
      now: NOW,
    });
    assert.equal(QUOTE_TTL_MS, 60_000n);
    assert.equal(quote.expiresAt, asUtcInstant('2026-08-14T12:01:00.000Z'));
    assert.equal(quoteIsExpired(quote, asUtcInstant('2026-08-14T12:00:59.999Z')), false);
    assert.equal(quoteIsExpired(quote, asUtcInstant('2026-08-14T12:01:00.000Z')), true);
    assert.equal(quoteIsExpired(quote, asUtcInstant('2026-08-14T12:01:00.001Z')), true);
  });
});
