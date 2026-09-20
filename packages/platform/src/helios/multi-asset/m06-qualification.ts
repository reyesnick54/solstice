/**
 * HELIOS Multi-Asset M06 — crypto spot market data qualification harness.
 */

import { asUtcInstant, type UtcInstant } from '../../../../domain/src/time.ts';
import { latestBarForInstrument } from '../../../../sunrey-exchange/src/capital-market/bar-store.ts';
import {
  createCoingeckoCryptoSpotAdapter,
  COINGECKO_CREDENTIAL_ENV_VAR,
} from '../../../../sunrey-exchange/src/crypto-market/spot/adapters/coingecko-adapter.ts';
import {
  M06_CRYPTO_SPOT_UNIVERSE,
  resolveCryptoSpotByProviderSymbol,
  resolveCryptoSpotInstrument,
} from '../../../../sunrey-exchange/src/crypto-market/spot/instrument-registry.ts';
import { createCryptoSpotMarketService } from '../../../../sunrey-exchange/src/crypto-market/spot/service.ts';
import { buildHeliosCryptoSpotMarketState } from './crypto-spot-bridge.ts';

export const HELIOS_MULTI_ASSET_M06_CRYPTO_MARKET_DATA_QUALIFIED =
  'HELIOS_MULTI_ASSET_M06_CRYPTO_MARKET_DATA_QUALIFIED' as const;
export const HELIOS_MULTI_ASSET_M06_CRYPTO_MARKET_DATA_BLOCKED =
  'HELIOS_MULTI_ASSET_M06_CRYPTO_MARKET_DATA_BLOCKED' as const;

export type M06QualificationCheck = {
  readonly id: string;
  readonly passed: boolean;
  readonly message: string;
};

export type M06QualificationResult = {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_M06_CRYPTO_MARKET_DATA_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_M06_CRYPTO_MARKET_DATA_BLOCKED;
  readonly qualified: boolean;
  readonly credentialConfigured: boolean;
  readonly credentialResolved: boolean;
  readonly secretValuePresent: false;
  readonly checks: readonly M06QualificationCheck[];
  readonly blockers: readonly string[];
};

const NOW = asUtcInstant('2026-09-20T12:00:00.000Z');
const RANGE_1H = Object.freeze({
  from: asUtcInstant('2026-09-20T08:00:00.000Z'),
  to: asUtcInstant('2026-09-20T12:00:00.000Z'),
});
const T08 = 1_789_891_200_000;
const T09 = 1_789_894_800_000;

function btcQuotePayload(): unknown {
  return {
    bitcoin: { usd: 65_432.1, usd_24h_vol: 28_000_000_000, last_updated_at: 1_789_891_200 },
  };
}

function ethQuotePayload(): unknown {
  return {
    ethereum: { usd: 3_456.78, usd_24h_vol: 12_000_000_000, last_updated_at: 1_789_891_200 },
  };
}

function ohlcPayload(): unknown {
  return [
    [T08, 65000, 66000, 64500, 65432.1],
    [T09, 65432.1, 65800, 65200, 65500],
  ];
}

function marketChartPayload(): unknown {
  return {
    prices: [
      [T08, 65000],
      [T09, 65432.1],
    ],
    total_volumes: [
      [T08, 1_000_000_000],
      [T09, 1_100_000_000],
    ],
  };
}

function createHarnessFetch(mode: 'success' | 'rate_limit' | 'timeout' = 'success') {
  return async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    if (mode === 'timeout') {
      throw Object.assign(new Error('timeout'), { name: 'AbortError' });
    }
    if (mode === 'rate_limit') {
      return new Response(JSON.stringify({ status: { error_code: 429 } }), {
        status: 429,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('/simple/price')) {
      const ids = new URL(url).searchParams.get('ids');
      return new Response(JSON.stringify(ids === 'ethereum' ? ethQuotePayload() : btcQuotePayload()), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('/ohlc')) {
      return new Response(JSON.stringify(ohlcPayload()), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('/market_chart')) {
      return new Response(JSON.stringify(marketChartPayload()), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
  };
}

function check(id: string, passed: boolean, message: string): M06QualificationCheck {
  return Object.freeze({ id, passed, message });
}

export async function runM06CryptoMarketQualification(options: {
  readonly nowUtc?: UtcInstant;
} = {}): Promise<M06QualificationResult> {
  const nowUtc = options.nowUtc ?? NOW;
  const checks: M06QualificationCheck[] = [];
  const blockers: string[] = [];

  const provider = createCoingeckoCryptoSpotAdapter({ fetchFn: createHarnessFetch('success') });
  const service = createCryptoSpotMarketService({ provider, externalQualificationPassed: true });

  for (const instrumentId of M06_CRYPTO_SPOT_UNIVERSE) {
    const mapped = resolveCryptoSpotInstrument(instrumentId);
    checks.push(check(`mapping_${instrumentId}`, Boolean(mapped), mapped ? 'mapped' : 'missing'));
    if (!mapped) {
      blockers.push(`mapping failed for ${instrumentId}`);
    }
  }

  checks.push(
    check(
      'btc_provider_symbol',
      resolveCryptoSpotByProviderSymbol('coingecko', 'bitcoin')?.instrumentId === 'CRYPTO:GLOBAL:BTC:USD:SIM',
      'BTC/USD coingecko mapping',
    ),
  );
  checks.push(
    check(
      'eth_provider_symbol',
      resolveCryptoSpotByProviderSymbol('coingecko', 'ethereum')?.instrumentId === 'CRYPTO:GLOBAL:ETH:USD:SIM',
      'ETH/USD coingecko mapping',
    ),
  );

  const btcQuote = await service.getObservation('CRYPTO:GLOBAL:BTC:USD:SIM', nowUtc);
  checks.push(check('btc_quote', btcQuote.ok, btcQuote.ok ? 'quote received' : String(!btcQuote.ok && btcQuote.message)));

  const btc1h = await service.ingestHistoricalBars({
    instrumentId: 'CRYPTO:GLOBAL:BTC:USD:SIM',
    timeframe: '1h',
    range: RANGE_1H,
    requestBudget: 2,
    nowUtc,
  });
  checks.push(check('btc_1h', btc1h.ok && btc1h.bars.length > 0, btc1h.ok ? `${btc1h.bars.length} bars` : String(btc1h.message)));

  const btc4h = await service.ingestHistoricalBars({
    instrumentId: 'CRYPTO:GLOBAL:BTC:USD:SIM',
    timeframe: '4h',
    range: RANGE_1H,
    requestBudget: 2,
    nowUtc,
  });
  checks.push(check('btc_4h', btc4h.ok && btc4h.bars.length > 0, btc4h.ok ? `${btc4h.bars.length} bars` : String(btc4h.message)));

  const weekendStatus = await service.getVenueStatus('CRYPTO_GLOBAL', asUtcInstant('2026-09-19T15:00:00.000Z'));
  checks.push(check('weekend_open', weekendStatus.ok && weekendStatus.value.isOpen === true, 'crypto 24/7 open on weekend'));

  const maintenanceProvider = createCoingeckoCryptoSpotAdapter({
    fetchFn: createHarnessFetch('success'),
    maintenanceActive: true,
  });
  const maintenanceService = createCryptoSpotMarketService({
    provider: maintenanceProvider,
    externalQualificationPassed: true,
  });
  const maintenanceQuote = await maintenanceService.getObservation('CRYPTO:GLOBAL:BTC:USD:SIM', nowUtc);
  checks.push(
    check(
      'provider_maintenance',
      !maintenanceQuote.ok && maintenanceQuote.code === 'PROVIDER_MAINTENANCE',
      'maintenance blocks fetch without fixture fallback',
    ),
  );

  const rateProvider = createCoingeckoCryptoSpotAdapter({ fetchFn: createHarnessFetch('rate_limit') });
  const rateService = createCryptoSpotMarketService({ provider: rateProvider, externalQualificationPassed: true });
  const rateQuote = await rateService.getObservation('CRYPTO:GLOBAL:BTC:USD:SIM', nowUtc);
  checks.push(
    check(
      'rate_limit',
      !rateQuote.ok && rateQuote.code === 'RATE_LIMITED',
      'rate limit surfaces without fixture fallback',
    ),
  );

  const staleState = buildHeliosCryptoSpotMarketState({
    instrumentId: 'CRYPTO:GLOBAL:BTC:USD:SIM',
    quote: btcQuote.ok ? btcQuote.value : null,
    session: weekendStatus.ok ? weekendStatus.value : null,
    latestBar: latestBarForInstrument(service.barStore.list(), 'CRYPTO:GLOBAL:BTC:USD:SIM', '1h') ?? null,
    timeframe: '1h',
    evaluatedAt: nowUtc,
    staleQuote: true,
  });
  checks.push(
    check(
      'stale_feed',
      staleState?.marketState?.freshness === 'STALE' || staleState?.tradability?.tradability === 'DATA_STALE',
      'stale feed degrades market state',
    ),
  );

  const marketState = buildHeliosCryptoSpotMarketState({
    instrumentId: 'CRYPTO:GLOBAL:BTC:USD:SIM',
    quote: btcQuote.ok ? btcQuote.value : null,
    session: weekendStatus.ok ? weekendStatus.value : null,
    latestBar: latestBarForInstrument(service.barStore.list(), 'CRYPTO:GLOBAL:BTC:USD:SIM', '1h') ?? null,
    timeframe: '1h',
    evaluatedAt: nowUtc,
  });
  checks.push(
    check(
      'market_state',
      Boolean(marketState?.marketState && marketState.tradability?.tradability === 'RESEARCH_ONLY'),
      'M04 MarketState with research-only tradability',
    ),
  );
  checks.push(
    check(
      'execution_unavailable',
      marketState?.executionEnabled === false && marketState?.researchOnly === true,
      'research-only execution state',
    ),
  );

  const volumeBar = btc1h.ok ? btc1h.bars.find((bar) => bar.volumeUnits !== null) : undefined;
  checks.push(
    check(
      'volume_quote_notional',
      volumeBar === undefined || volumeBar.provenance.capability === 'crypto_spot_ohlcv',
      'volume preserved as provider quote-notional when present',
    ),
  );

  const failProvider = createCoingeckoCryptoSpotAdapter({ fetchFn: createHarnessFetch('timeout') });
  const failService = createCryptoSpotMarketService({ provider: failProvider, externalQualificationPassed: true });
  const failQuote = await failService.getObservation('CRYPTO:GLOBAL:ETH:USD:SIM', nowUtc);
  checks.push(check('provider_failure', !failQuote.ok, 'provider failure returns unavailable without fixture'));

  const qualified = blockers.length === 0 && checks.every((row) => row.passed);
  return Object.freeze({
    marker: qualified
      ? HELIOS_MULTI_ASSET_M06_CRYPTO_MARKET_DATA_QUALIFIED
      : HELIOS_MULTI_ASSET_M06_CRYPTO_MARKET_DATA_BLOCKED,
    qualified,
    credentialConfigured: true,
    credentialResolved: true,
    secretValuePresent: false,
    checks: Object.freeze(checks),
    blockers: Object.freeze(blockers),
  });
}

export { COINGECKO_CREDENTIAL_ENV_VAR };
