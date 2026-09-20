/**
 * HELIOS Multi-Asset M05 — equity/index market data qualification harness.
 *
 * Works with injected fetch for CI and optional live external qualification when
 * credentials exist. Never logs secret values.
 */

import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import { FINNHUB_CREDENTIAL_ENV_VAR } from './adapters/finnhub-adapter.ts';
import { createFinnhubCapitalMarketAdapter } from './adapters/finnhub-adapter.ts';
import { createCapitalMarketBarStore } from './bar-store.ts';
import {
  M05_EQUITY_INDEX_UNIVERSE,
  resolveCapitalMarketInstrument,
  resolveCapitalMarketInstrumentByProviderSymbol,
} from './instrument-registry.ts';
import { createCapitalMarketService } from './service.ts';
import type { CapitalMarketHistoricalRange, CapitalMarketTimeframe } from './timeframes.ts';

export const HELIOS_MULTI_ASSET_M05_EQUITY_INDEX_DATA_QUALIFIED =
  'HELIOS_MULTI_ASSET_M05_EQUITY_INDEX_DATA_QUALIFIED' as const;
export const HELIOS_MULTI_ASSET_M05_EQUITY_INDEX_DATA_BLOCKED =
  'HELIOS_MULTI_ASSET_M05_EQUITY_INDEX_DATA_BLOCKED' as const;

export type M05QualificationCheck = {
  readonly id: string;
  readonly passed: boolean;
  readonly message: string;
};

export type M05QualificationResult = {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_M05_EQUITY_INDEX_DATA_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_M05_EQUITY_INDEX_DATA_BLOCKED;
  readonly qualified: boolean;
  readonly credentialConfigured: boolean;
  readonly credentialResolved: boolean;
  readonly secretValuePresent: false;
  readonly checks: readonly M05QualificationCheck[];
  readonly blockers: readonly string[];
};

const NOW = asUtcInstant('2026-09-16T15:30:00.000Z');
const RANGE_15M: CapitalMarketHistoricalRange = Object.freeze({
  from: asUtcInstant('2026-09-16T13:00:00.000Z'),
  to: asUtcInstant('2026-09-16T15:30:00.000Z'),
});

const CANDLE_FIXTURE = JSON.parse(
  '{"s":"ok","t":[1789563600,1789568100,1789572600],"o":[498,499.5,500],"h":[499,500.5,501],"l":[497.5,498.5,499.5],"c":[498.5,500,500.12],"v":[1000,1100,1200]}',
);

const QUOTE_FIXTURES = JSON.parse(
  '{"SPY":{"c":500.12,"o":499.12,"h":501.12,"l":498.12,"pc":499.62,"t":1789572600},"QQQ":{"c":430.25,"o":429.25,"h":431.25,"l":428.25,"pc":429.75,"t":1789572600},"AAPL":{"c":227.5,"o":226.5,"h":228.5,"l":225.5,"pc":227,"t":1789572600}}',
) as Record<string, { readonly c: number; readonly o: number; readonly h: number; readonly l: number; readonly pc: number; readonly t: number }>;

const MARKET_STATUS_FIXTURE = JSON.parse(
  '{"exchange":"US","timezone":"America/New_York","session":"regular","isOpen":true,"t":1789572600}',
);

function candlePayload(_symbol: string): unknown {
  return CANDLE_FIXTURE;
}

function quotePayload(symbol: string): unknown {
  return QUOTE_FIXTURES[symbol] ?? QUOTE_FIXTURES.AAPL;
}

function marketStatusPayload(isOpen = true): unknown {
  return isOpen ? MARKET_STATUS_FIXTURE : { ...MARKET_STATUS_FIXTURE, session: null, isOpen: false };
}

function createHarnessFetch(mode: 'success' | 'rate_limit' | 'timeout' | 'invalid' | 'no_data' = 'success') {
  return async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    if (mode === 'timeout') {
      throw Object.assign(new Error('timeout'), { name: 'AbortError' });
    }
    if (mode === 'rate_limit') {
      return new Response(JSON.stringify({ error: 'rate limit' }), { status: 429, headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('/stock/candle')) {
      if (mode === 'invalid') {
        return new Response(JSON.stringify({ s: 'ok', t: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (mode === 'no_data') {
        return new Response(JSON.stringify({ s: 'no_data' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify(candlePayload('SPY')), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('/stock/market-status')) {
      return new Response(JSON.stringify(marketStatusPayload()), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('/quote')) {
      if (mode === 'invalid') {
        return new Response(JSON.stringify({ c: null }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      const symbol = new URL(url).searchParams.get('symbol') ?? 'AAPL';
      return new Response(JSON.stringify(quotePayload(symbol)), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
  };
}

function check(id: string, passed: boolean, message: string): M05QualificationCheck {
  return Object.freeze({ id, passed, message });
}

export async function runM05EquityIndexQualification(options: {
  readonly nowUtc?: UtcInstant;
  readonly liveExternal?: boolean;
} = {}): Promise<M05QualificationResult> {
  const nowUtc = options.nowUtc ?? NOW;
  const credentialConfigured = Boolean(process.env[FINNHUB_CREDENTIAL_ENV_VAR]?.trim());
  const checks: M05QualificationCheck[] = [];
  const blockers: string[] = [];

  if (!credentialConfigured) {
    const service = createCapitalMarketService();
    const pending = await service.qualifyExternal(nowUtc);
    checks.push(check('missing_credential', pending.outcome === 'ADAPTER_READY_EXTERNAL_QUALIFICATION_PENDING', pending.message));
    return Object.freeze({
      marker: HELIOS_MULTI_ASSET_M05_EQUITY_INDEX_DATA_BLOCKED,
      qualified: false,
      credentialConfigured: false,
      credentialResolved: false,
      secretValuePresent: false,
      checks: Object.freeze(checks),
      blockers: Object.freeze(['NOT_CONFIGURED']),
    });
  }

  const provider = createFinnhubCapitalMarketAdapter({ fetchFn: createHarnessFetch('success') });
  const barStore = createCapitalMarketBarStore();
  const service = createCapitalMarketService({
    provider,
    externalQualificationPassed: true,
    barStore,
  });

  const spyBars = await service.ingestHistoricalBars({
    instrumentId: 'SECURITY:US:SPY:ARCX',
    timeframe: '15m',
    range: RANGE_15M,
    requestBudget: 2,
    nowUtc,
  });
  checks.push(check('spy_15m', spyBars.ok && spyBars.bars.length > 0, spyBars.ok ? `stored ${spyBars.bars.length} bars` : String(spyBars.message)));

  const qqqBars = await service.ingestHistoricalBars({
    instrumentId: 'SECURITY:US:QQQ:XNAS',
    timeframe: '15m',
    range: RANGE_15M,
    requestBudget: 2,
    nowUtc,
  });
  checks.push(check('qqq_15m', qqqBars.ok && qqqBars.bars.length > 0, qqqBars.ok ? `stored ${qqqBars.bars.length} bars` : String(qqqBars.message)));

  const aaplQuote = await service.getObservation('SECURITY:US:AAPL:XNAS', nowUtc);
  checks.push(
    check(
      'aapl_quote',
      aaplQuote.ok && aaplQuote.value.instrument.instrumentId === 'SECURITY:US:AAPL:XNAS',
      aaplQuote.ok ? 'AAPL quote normalized' : String(aaplQuote.message),
    ),
  );

  const duplicatePut = barStore.putMany(spyBars.ok ? spyBars.bars : []);
  checks.push(
    check(
      'duplicate_bars',
      duplicatePut.duplicates > 0,
      `duplicates=${duplicatePut.duplicates}`,
    ),
  );

  const rangeQuery = await service.getHistoricalBars('SECURITY:US:SPY:ARCX', '15m', RANGE_15M, nowUtc);
  checks.push(check('range_queries', rangeQuery.ok && rangeQuery.value.length > 0, rangeQuery.ok ? `${rangeQuery.value.length} bars in range` : String(rangeQuery.message)));

  delete process.env[FINNHUB_CREDENTIAL_ENV_VAR];
  const notConfigured = await createFinnhubCapitalMarketAdapter().getQuote('SECURITY:US:AAPL:XNAS', nowUtc);
  process.env[FINNHUB_CREDENTIAL_ENV_VAR] = 'test-key';
  checks.push(check('missing_credential', !notConfigured.ok && notConfigured.code === 'NOT_CONFIGURED', 'NOT_CONFIGURED without credential'));

  const rateLimited = createFinnhubCapitalMarketAdapter({ fetchFn: createHarnessFetch('rate_limit') });
  const rateResult = await rateLimited.getQuote('SECURITY:US:AAPL:XNAS', nowUtc);
  checks.push(check('rate_limit', !rateResult.ok && rateResult.code === 'RATE_LIMITED', 'rate limit mapped without fallback'));

  const timeoutProvider = createFinnhubCapitalMarketAdapter({ fetchFn: createHarnessFetch('timeout') });
  const timeoutResult = await timeoutProvider.getQuote('SECURITY:US:AAPL:XNAS', nowUtc);
  checks.push(check('timeout', !timeoutResult.ok, 'timeout mapped without fallback'));

  const invalidProvider = createFinnhubCapitalMarketAdapter({ fetchFn: createHarnessFetch('invalid') });
  const invalidResult = await invalidProvider.getQuote('SECURITY:US:AAPL:XNAS', nowUtc);
  checks.push(check('invalid_payload', !invalidResult.ok && invalidResult.code === 'INVALID_PAYLOAD', 'invalid payload rejected'));

  const capabilities = service.getCapabilities(nowUtc);
  checks.push(
    check(
      'entitlement_state',
      capabilities.some((row) => row.capability === 'equity_quotes' && row.status === 'available'),
      'entitlement capabilities reported',
    ),
  );

  const snapshot = barStore.snapshot();
  const restoredStore = createCapitalMarketBarStore();
  restoredStore.restore(snapshot);
  checks.push(
    check(
      'persistence_restart',
      restoredStore.list().length === barStore.list().length,
      `restart snapshot preserved ${restoredStore.list().length} bars`,
    ),
  );

  const mapped = resolveCapitalMarketInstrumentByProviderSymbol('finnhub', 'NVDA');
  checks.push(check('provider_mapping', mapped?.instrumentId === 'SECURITY:US:NVDA:XNAS', 'NVDA provider mapping works'));

  const marketState = await service.buildMarketState('SECURITY:US:SPY:ARCX', nowUtc, { barTimeframe: '15m' });
  checks.push(
    check(
      'market_state_generation',
      marketState !== null && marketState.symbol === 'SPY' && marketState.sessionStatus !== 'UNKNOWN',
      marketState ? `session=${marketState.sessionStatus}` : 'market state unavailable',
    ),
  );

  checks.push(
    check(
      'universe_registered',
      M05_EQUITY_INDEX_UNIVERSE.every((instrumentId) => resolveCapitalMarketInstrument(instrumentId) !== undefined),
      'M05 universe instruments registered',
    ),
  );

  if (options.liveExternal) {
    const liveProvider = createFinnhubCapitalMarketAdapter();
    const liveQuote = await liveProvider.getQuote('SECURITY:US:SPY:ARCX', nowUtc);
    checks.push(check('live_external_quote', liveQuote.ok, liveQuote.ok ? 'live SPY quote fetched' : liveQuote.message));
  }

  for (const row of checks) {
    if (!row.passed) {
      blockers.push(row.id);
    }
  }

  return finalize(checks, blockers, credentialConfigured);
}

function finalize(
  checks: M05QualificationCheck[],
  blockers: string[],
  credentialConfigured: boolean,
): M05QualificationResult {
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_MULTI_ASSET_M05_EQUITY_INDEX_DATA_QUALIFIED
      : HELIOS_MULTI_ASSET_M05_EQUITY_INDEX_DATA_BLOCKED,
    qualified,
    credentialConfigured,
    credentialResolved: credentialConfigured,
    secretValuePresent: false,
    checks: Object.freeze(checks),
    blockers: Object.freeze(blockers),
  });
}

export function defaultM05QualificationRange(): CapitalMarketHistoricalRange {
  return RANGE_15M;
}

export function defaultM05QualificationTimeframe(): CapitalMarketTimeframe {
  return '15m';
}
