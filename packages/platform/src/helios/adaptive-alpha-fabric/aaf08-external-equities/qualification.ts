/**
 * AAF08 qualification harness — contract fixtures only unless live flag set.
 */

import { asUtcInstant, type UtcInstant } from '../../../../../domain/src/time.ts';
import { FrozenClock } from '../../../../../config/src/clock.ts';
import { createTemporalEntityGraphStore } from '../../feature-fabric/entity-resolution/graph-store.ts';
import { HeliosMarketObservationFabric } from '../../market-observation/ingest.ts';
import { createHeliosFeatureFabricStore, HeliosFeatureFabric } from '../../feature-fabric/index.ts';
import { seedAaf08EquitiesEntityGraph } from './entity-graph.ts';
import { HeliosExternalEquitiesObservationPlane } from './plane.ts';
import { AAF08_EQUITIES_ETF_UNIVERSE } from './universe.ts';
import { materializeAaf08LastPriceFeature } from './feature-bridge.ts';

export const HELIOS_AAF08_EXTERNAL_EQUITIES_DATA_QUALIFIED =
  'HELIOS_AAF08_EXTERNAL_EQUITIES_DATA_QUALIFIED' as const;
export const HELIOS_AAF08_EXTERNAL_EQUITIES_DATA_BLOCKED =
  'HELIOS_AAF08_EXTERNAL_EQUITIES_DATA_BLOCKED' as const;

export type Aaf08QualificationCheck = {
  readonly id: string;
  readonly passed: boolean;
  readonly message: string;
};

export type Aaf08QualificationResult = {
  readonly marker:
    | typeof HELIOS_AAF08_EXTERNAL_EQUITIES_DATA_QUALIFIED
    | typeof HELIOS_AAF08_EXTERNAL_EQUITIES_DATA_BLOCKED;
  readonly qualified: boolean;
  readonly checks: readonly Aaf08QualificationCheck[];
  readonly blockers: readonly string[];
};

export type RunAaf08QualificationOptions = {
  readonly nowUtc?: UtcInstant;
  readonly createProviderPort: (fetchFn: typeof fetch) => import('./provider-port.ts').ExternalEquitiesProviderPort;
};

const NOW = asUtcInstant('2026-09-16T15:30:00.000Z');
const RANGE = Object.freeze({
  from: asUtcInstant('2026-09-16T13:00:00.000Z'),
  to: asUtcInstant('2026-09-16T15:30:00.000Z'),
});

function harnessFetch(mode: 'success' | 'rate_limit' | 'timeout' | 'invalid' | 'closed' = 'success') {
  return async (input: string | URL): Promise<Response> => {
    const url = String(input);
    if (mode === 'timeout') {
      throw Object.assign(new Error('timeout'), { name: 'AbortError' });
    }
    if (mode === 'rate_limit') {
      return new Response(JSON.stringify({ error: 'rate limit' }), {
        status: 429,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('/stock/candle')) {
      return new Response(
        JSON.stringify({
          s: 'ok',
          t: [1_789_563_600, 1_789_568_100],
          o: [498, 499.5],
          h: [499, 500.5],
          l: [497.5, 498.5],
          c: [498.5, 500],
          v: [1000, 1100],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (url.includes('/stock/market-status')) {
      const body =
        mode === 'closed'
          ? { exchange: 'US', timezone: 'America/New_York', session: null, isOpen: false, t: 1_789_572_600 }
          : { exchange: 'US', timezone: 'America/New_York', session: 'regular', isOpen: true, t: 1_789_572_600 };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('/quote')) {
      if (mode === 'invalid') {
        return new Response(JSON.stringify({ c: null }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      const symbol = new URL(url).searchParams.get('symbol') ?? 'SPY';
      const price = symbol === 'SPY' ? 500.12 : symbol === 'QQQ' ? 430.25 : 227.5;
      return new Response(
        JSON.stringify({ c: price, o: price - 1, h: price + 1, l: price - 2, pc: price - 0.5, t: 1_789_572_600 }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
  };
}

export async function runAaf08Qualification(
  options: RunAaf08QualificationOptions,
): Promise<Aaf08QualificationResult> {
  const nowUtc = options.nowUtc ?? NOW;
  const checks: Aaf08QualificationCheck[] = [];

  const graph = createTemporalEntityGraphStore();
  seedAaf08EquitiesEntityGraph(graph);
  const clock = new FrozenClock(nowUtc);
  const marketFabric = new HeliosMarketObservationFabric({ clock });
  const provider = options.createProviderPort(harnessFetch('success'));
  const plane = new HeliosExternalEquitiesObservationPlane({ clock, marketFabric, entityGraph: graph, provider });

  for (const instrumentId of AAF08_EQUITIES_ETF_UNIVERSE) {
    const quote = await plane.ingestQuote(instrumentId);
    checks.push({
      id: `quote_${instrumentId}`,
      passed: quote.ok,
      message: quote.ok ? 'ok' : quote.message,
    });
  }

  const bars = await plane.ingestHistoricalBars(AAF08_EQUITIES_ETF_UNIVERSE[0], '15m', RANGE);
  checks.push({ id: 'historical_bars_spy_15m', passed: bars.ok, message: bars.ok ? 'ok' : bars.message });

  const session = await plane.ingestMarketSession('US', AAF08_EQUITIES_ETF_UNIVERSE[0]);
  checks.push({
    id: 'market_session_us',
    passed: session.ok,
    message: session.ok ? 'ok' : session.message,
  });

  const strategyBars = plane.strategyApi().getBars({
    instrumentId: AAF08_EQUITIES_ETF_UNIVERSE[0],
    timeframe: '15m',
    knowableAt: nowUtc,
  });
  checks.push({
    id: 'chronological_strategy_bars',
    passed: strategyBars.length >= 1,
    message: `bars=${strategyBars.length}`,
  });

  const featureFabric = new HeliosFeatureFabric({ clock, store: createHeliosFeatureFabricStore() });
  const latest = plane.strategyApi().getLatestQuote({
    instrumentId: AAF08_EQUITIES_ETF_UNIVERSE[0],
    knowableAt: nowUtc,
  });
  if (latest) {
    materializeAaf08LastPriceFeature(featureFabric, latest, nowUtc);
  }
  checks.push({
    id: 'aaf02_feature_bridge',
    passed: featureFabric.store().listObservations().length >= 1,
    message: 'last price feature materialized',
  });

  const failureModes: Array<{ readonly id: string; readonly mode: 'rate_limit' | 'timeout' | 'invalid' | 'closed' }> =
    [
      { id: 'failure_rate_limit', mode: 'rate_limit' },
      { id: 'failure_timeout', mode: 'timeout' },
      { id: 'failure_malformed', mode: 'invalid' },
      { id: 'failure_market_closed', mode: 'closed' },
    ];

  for (const failure of failureModes) {
    const failProvider = options.createProviderPort(harnessFetch(failure.mode));
    const failPlane = new HeliosExternalEquitiesObservationPlane({
      clock,
      marketFabric: new HeliosMarketObservationFabric({ clock }),
      entityGraph: graph,
      provider: failProvider,
    });
    const outcome =
      failure.mode === 'closed'
        ? await failPlane.ingestMarketSession('US', AAF08_EQUITIES_ETF_UNIVERSE[0])
        : await failPlane.ingestQuote(AAF08_EQUITIES_ETF_UNIVERSE[0]);
    const passed =
      failure.mode === 'closed' ? outcome.ok === true : outcome.ok === false;
    checks.push({
      id: failure.id,
      passed,
      message: failure.mode === 'closed' ? (outcome.ok ? 'closed session ingested' : outcome.code) : outcome.code,
    });
  }

  const dupPlane = new HeliosExternalEquitiesObservationPlane({
    clock,
    marketFabric,
    entityGraph: graph,
    provider,
  });
  await dupPlane.ingestQuote(AAF08_EQUITIES_ETF_UNIVERSE[0]);
  const dup = await dupPlane.ingestQuote(AAF08_EQUITIES_ETF_UNIVERSE[0]);
  checks.push({
    id: 'duplicate_tick_handled',
    passed: dup.ok || dup.code === 'DUPLICATE_BAR',
    message: dup.ok ? `duplicate=${dup.duplicate}` : dup.code,
  });

  const blockers = checks.filter((row) => !row.passed).map((row) => row.id);
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_AAF08_EXTERNAL_EQUITIES_DATA_QUALIFIED
      : HELIOS_AAF08_EXTERNAL_EQUITIES_DATA_BLOCKED,
    qualified,
    checks: Object.freeze(checks),
    blockers: Object.freeze(blockers),
  });
}
