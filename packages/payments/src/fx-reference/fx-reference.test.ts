// @ts-nocheck
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { loadCatalog, validateCatalog } from '../../../../scripts/lib/free-api-catalog-validator.mjs';
import {
  ALL_FX_REFERENCE_ADAPTERS,
  BLOCKED_CURRENCYAPI_ADAPTER,
  FX_REFERENCE_PROVIDER_IDS,
  createFxReferenceService,
  createFailingFxReferenceAdapter,
  createRateLimitedFxReferenceAdapter,
  crossReferenceRate,
  indicativeConversionEstimate,
  invertReferenceRate,
  isExecutionRateSource,
  isReferencePresentationRate,
  parseDecimalRateToRational,
  fxReferenceRateToPresentationRate,
} from './index.ts';
import { SIMULATION_RATE_SOURCE } from '../fx-provider.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

describe('fx reference network', () => {
  const now = asUtcInstant('2026-08-30T14:00:00.000Z');

  it('registers every selected FX adapter', () => {
    assert.equal(ALL_FX_REFERENCE_ADAPTERS.length, 7);
    for (const providerId of FX_REFERENCE_PROVIDER_IDS) {
      assert.ok(ALL_FX_REFERENCE_ADAPTERS.some((adapter) => adapter.providerId === providerId));
    }
  });

  it('catalog contains FX providers with partial population', () => {
    const { catalog } = loadCatalog(ROOT);
    const result = validateCatalog(catalog);
    assert.equal(result.ok, true, result.errors.join('\n'));
    assert.equal(catalog.population_status, 'partial');
    const fxProviders = catalog.providers.filter((entry) => entry.primary_category === 'foreign_exchange');
    assert.equal(fxProviders.length, 8);
    assert.ok(catalog.providers.length >= fxProviders.length);
  });

  it('normalizes USD/SAR and EUR/USD', () => {
    const service = createFxReferenceService({ nowUtc: () => now });
    const usdSar = service.getRate('USD', 'SAR', { nowUtc: now });
    assert.equal(usdSar.ok, true);
    if (usdSar.ok) {
      assert.equal(usdSar.value.rate.baseCurrency, 'USD');
      assert.equal(usdSar.value.rate.quoteCurrency, 'SAR');
      assert.equal(usdSar.value.rate.numerator * 100n, usdSar.value.rate.denominator * 375n);
    }
    const eurUsd = service.getRate('EUR', 'USD', { nowUtc: now });
    assert.equal(eurUsd.ok, true);
    if (eurUsd.ok) {
      assert.equal(eurUsd.value.rate.baseCurrency, 'EUR');
      assert.equal(eurUsd.value.rate.quoteCurrency, 'USD');
    }
  });

  it('validates ISO currency codes and rejects malformed codes', () => {
    const service = createFxReferenceService({ nowUtc: () => now });
    assert.equal(service.getRate('US', 'SAR', { nowUtc: now }).ok, false);
    assert.equal(service.getRate('USD', 'US', { nowUtc: now }).ok, false);
  });

  it('rejects invalid rates', () => {
    assert.throws(() => parseDecimalRateToRational('0'), /positive/);
    assert.throws(() => parseDecimalRateToRational('-1.2'), /positive/);
    assert.throws(() => parseDecimalRateToRational('NaN'), /invalid decimal/);
  });

  it('computes inverse rates with derived provenance', () => {
    const service = createFxReferenceService({ nowUtc: () => now });
    const direct = service.getRate('USD', 'SAR', { nowUtc: now });
    assert.equal(direct.ok, true);
    if (!direct.ok) {
      return;
    }
    const inverse = invertReferenceRate(direct.value.rate, now);
    assert.equal(inverse.baseCurrency, 'SAR');
    assert.equal(inverse.quoteCurrency, 'USD');
    assert.equal(inverse.authorityClass, 'derived_data');
    assert.deepEqual(inverse.derivedFrom, [direct.value.rate.observationId]);
  });

  it('computes cross rates with derived provenance', () => {
    const service = createFxReferenceService({ nowUtc: () => now });
    const legA = service.getRate('EUR', 'USD', { nowUtc: now });
    const legB = service.getRate('USD', 'SAR', { nowUtc: now });
    assert.equal(legA.ok, true);
    assert.equal(legB.ok, true);
    if (!legA.ok || !legB.ok) {
      return;
    }
    const cross = crossReferenceRate(legA.value.rate, legB.value.rate, 'EUR', 'SAR', now);
    assert.equal(cross.authorityClass, 'derived_data');
    assert.equal(cross.derivedFrom?.length, 2);
    const derived = service.getRate('EUR', 'SAR', { nowUtc: now });
    assert.equal(derived.ok, true);
  });

  it('retains decimal precision as exact rationals', () => {
    const rational = parseDecimalRateToRational('3.6725');
    assert.equal(rational.numerator, 1469n);
    assert.equal(rational.denominator, 400n);
  });

  it('uses provider timestamps and supports cache hits', () => {
    const service = createFxReferenceService({ nowUtc: () => now });
    const first = service.getRate('USD', 'GBP', { nowUtc: now });
    const second = service.getRate('USD', 'GBP', { nowUtc: now });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (first.ok && second.ok) {
      assert.equal(second.value.cacheSource, 'fresh');
      assert.equal(first.value.rate.sourceTimestamp, '2026-08-30T12:00:00.000Z');
    }
  });

  it('handles provider timeout and rate-limit failures via fallback', () => {
    const failing = createFailingFxReferenceAdapter('fixture-timeout');
    const limited = createRateLimitedFxReferenceAdapter('fixture-limited');
    const service = createFxReferenceService({
      providers: [failing, limited, ...ALL_FX_REFERENCE_ADAPTERS],
      nowUtc: () => now,
    });
    const result = service.getRate('USD', 'SAR', { nowUtc: now });
    assert.equal(result.ok, true);
  });

  it('does not activate blocked providers', () => {
    const service = createFxReferenceService({
      providers: [BLOCKED_CURRENCYAPI_ADAPTER],
      nowUtc: () => now,
    });
    const result = service.getRate('USD', 'SAR', { nowUtc: now });
    assert.equal(result.ok, false);
  });

  it('keeps reference and execution rates separate', () => {
    const service = createFxReferenceService({ nowUtc: () => now });
    const reference = service.getRate('USD', 'SAR', { nowUtc: now });
    assert.equal(reference.ok, true);
    if (!reference.ok) {
      return;
    }
    const presentation = fxReferenceRateToPresentationRate(reference.value.rate);
    assert.equal(isReferencePresentationRate(presentation), true);
    assert.equal(isExecutionRateSource(SIMULATION_RATE_SOURCE), true);
    assert.equal(isExecutionRateSource(presentation.source), false);
  });

  it('supports indicative money estimates without execution authority', () => {
    const service = createFxReferenceService({ nowUtc: () => now });
    const reference = service.getRate('USD', 'SAR', { nowUtc: now });
    assert.equal(reference.ok, true);
    if (!reference.ok) {
      return;
    }
    const estimate = indicativeConversionEstimate(reference.value.rate);
    assert.equal(estimate.authority, 'FX_REFERENCE_ONLY_NOT_EXECUTION');
    assert.equal(estimate.presentationRate.kind, 'REFERENCE');
  });

  it('exposes historical reference lookup', () => {
    const service = createFxReferenceService({ nowUtc: () => now });
    const history = service.getHistoricalRate('USD', 'SAR', '2026-08-01', { nowUtc: now });
    assert.equal(history.ok, true);
    if (history.ok) {
      assert.equal(history.value.rate.rateType, 'HISTORICAL');
    }
  });
});

describe('fx reference catalog yaml', () => {
  it('lists approved FX providers only from catalog fragment', () => {
    const text = readFileSync(join(ROOT, 'config/providers/free-api-catalog.yaml'), 'utf8');
    const catalog = parseYaml(text);
    const fxProviders = catalog.providers.filter(
      (entry: { primary_category: string }) => entry.primary_category === 'foreign_exchange',
    );
    const active = fxProviders.filter(
      (entry: { sunrey: { launch_tier: string } }) => entry.sunrey.launch_tier !== 'blocked_pending_review',
    );
    assert.equal(active.length, 7);
  });
});
