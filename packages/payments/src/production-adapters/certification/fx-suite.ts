import { FrozenClock } from '../../../../config/src/clock.ts';
import { asUtcInstant } from '../../../../domain/src/time.ts';
import { Money } from '../../../../money/src/money.ts';
import { asCorridorId, asQuoteId } from '../../ids.ts';
import { SimulatedProductionFxAdapter } from '../fx/simulated.ts';
import { verifyProviderQuoteTerms } from '../fx/quote-integrity.ts';
import { caseResult, suiteResult, type CertificationSuiteResult } from './harness.ts';

const NOW = asUtcInstant('2026-08-21T12:00:00.000Z');

export function runFxCertificationSuite(): CertificationSuiteResult {
  const clock = new FrozenClock(NOW);
  const adapter = new SimulatedProductionFxAdapter(clock);
  const cases = [];

  const quote = adapter.getQuote({
    quoteId: asQuoteId('quote_cert_usd_sar'),
    baseCurrency: 'USD' as never,
    quoteCurrency: 'SAR' as never,
    sourceAmount: Money.fromMinorUnits(100_00n, 'USD'),
    corridorId: asCorridorId('US-SA-USD-SAR'),
    legalEntityId: 'le_solstice_us_inc' as never,
    now: NOW,
  });
  cases.push(caseResult('quote', quote.ok, quote.ok ? quote.value.quoteId : quote.code));
  if (!quote.ok) {
    return suiteResult('FX', cases);
  }

  const expired = adapter.innerProvider;
  expired.setMode('EXPIRED_QUOTE');
  const expiredQuote = adapter.getQuote({
    quoteId: asQuoteId('quote_cert_expired'),
    baseCurrency: 'USD' as never,
    quoteCurrency: 'SAR' as never,
    sourceAmount: Money.fromMinorUnits(100_00n, 'USD'),
    corridorId: asCorridorId('US-SA-USD-SAR'),
    legalEntityId: 'le_solstice_us_inc' as never,
    now: NOW,
  });
  cases.push(caseResult('expiry', expiredQuote.ok && expiredQuote.value.status === 'EXPIRED', expiredQuote.ok ? expiredQuote.value.status : expiredQuote.code));
  expired.setMode('NORMAL');

  const executed = adapter.executeQuote({
    quote: quote.value,
    now: NOW,
    tradeId: 'fxtr_cert_1',
  });
  cases.push(caseResult('execute', executed.ok && executed.value.status === 'SETTLED', executed.ok ? executed.value.status : executed.code));
  if (!executed.ok) {
    return suiteResult('FX', cases);
  }

  const status = adapter.getTradeStatus(executed.value.tradeId);
  cases.push(caseResult('status', status.ok && status.value.status === 'SETTLED', status.ok ? status.value.status : status.code));

  expired.setMode('EXECUTION_FAILED');
  const failed = adapter.executeQuote({
    quote: quote.value,
    now: NOW,
    tradeId: 'fxtr_cert_fail',
  });
  cases.push(caseResult('failure', failed.ok === false && failed.code === 'EXECUTION_FAILED', failed.ok ? 'ok' : failed.code));
  expired.setMode('NORMAL');

  const settlement = adapter.retrieveSettlement(executed.value.tradeId);
  cases.push(caseResult('settlement', settlement.ok && settlement.value.settlementRef.length > 0, settlement.ok ? settlement.value.settlementRef : settlement.code));

  const integrity = verifyProviderQuoteTerms(quote.value, {
    providerQuoteId: quote.value.quoteId,
    rate: { numerator: quote.value.providerRate.numerator, denominator: quote.value.providerRate.denominator },
    sourceAmount: quote.value.sourceAmount,
    destinationAmount: quote.value.destinationAmount,
    baseCurrency: quote.value.baseCurrency,
    quoteCurrency: quote.value.quoteCurrency,
    expiresAt: quote.value.expiresAt,
    feeMinor: quote.value.fee.minorUnits,
    executionRef: executed.value.tradeId,
  });
  cases.push(caseResult('precision', integrity.ok && quote.value.providerRate.numerator > 0n, integrity.ok ? 'exact_rational' : integrity.code));
  cases.push(caseResult('pricing_owned', adapter.canRedefineCustomerPricing === false && adapter.pricingMode === 'SUNREY_PRICES_CUSTOMER', adapter.pricingMode));
  return suiteResult('FX', cases);
}
