import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import { buildChronologicalObservation, freezeEvaluationDatasetManifest } from '../evaluation/manifest.ts';
import type { EvaluationDatasetManifest } from '../evaluation/manifest.ts';
import { M09_QQQ_INSTRUMENT_ID, M09_SPY_INSTRUMENT_ID } from './ids.ts';
import type { M09BarObservation } from './types.ts';

const BASE_DAY = '2026-04-01';

function barTime(dayOffset: number, barIndex: number): UtcInstant {
  const hour = 14 + Math.floor((barIndex * 15) / 60);
  const minute = (barIndex * 15) % 60;
  const day = 1 + dayOffset;
  return asUtcInstant(
    `${BASE_DAY.slice(0, 8)}${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`,
  );
}

function spyCloseForScenario(barIndex: number): bigint {
  const base = 450_00n;
  if (barIndex < 20) {
    return base + BigInt(barIndex) * 5n;
  }
  if (barIndex < 25) {
    return base - BigInt(barIndex - 19) * 120n;
  }
  if (barIndex < 30) {
    return base - 720n + BigInt(barIndex - 24) * 100n;
  }
  return base;
}

function qqqCloseForScenario(barIndex: number): bigint {
  const base = 380_00n;
  return base + BigInt(barIndex) * 8n;
}

export function buildM09Bar(input: {
  readonly instrumentId: string;
  readonly barIndex: number;
  readonly dayOffset?: number;
  readonly closeMinor: bigint;
  readonly overrides?: Partial<Pick<M09BarObservation, 'available' | 'sessionState' | 'marketState' | 'liquidityState' | 'spreadBps' | 'knowableAt'>>;
}): M09BarObservation {
  const at = barTime(input.dayOffset ?? 0, input.barIndex);
  const close = input.closeMinor;
  const spread = input.overrides?.spreadBps ?? 5n;
  const bid = close - spread;
  const ask = close + spread;
  return Object.freeze({
    instrumentId: input.instrumentId,
    barInterval: '15m',
    sourceEventTime: at,
    knowableAt: input.overrides?.knowableAt ?? at,
    openMinor: close - 10n,
    highMinor: close + 20n,
    lowMinor: close - 20n,
    closeMinor: close,
    bidMinor: bid,
    askMinor: ask,
    spreadBps: spread,
    available: input.overrides?.available ?? true,
    sessionState: input.overrides?.sessionState ?? 'OPEN',
    marketState: input.overrides?.marketState ?? 'NORMAL',
    liquidityState: input.overrides?.liquidityState ?? 'NORMAL',
    marketRegime: 'MEAN_REVERTING',
    providerId: 'fixture_m09',
    providerSequence: input.barIndex,
    observationId: `obs_m09_${input.instrumentId}_${String(input.barIndex)}`,
  });
}

export function syntheticM09BarSeries(input?: {
  readonly barCount?: number;
  readonly includeEntrySignal?: boolean;
}): readonly M09BarObservation[] {
  const count = input?.barCount ?? 35;
  const bars: M09BarObservation[] = [];
  for (let i = 0; i < count; i += 1) {
    bars.push(
      buildM09Bar({
        instrumentId: M09_SPY_INSTRUMENT_ID,
        barIndex: i,
        closeMinor: spyCloseForScenario(i),
      }),
    );
    bars.push(
      buildM09Bar({
        instrumentId: M09_QQQ_INSTRUMENT_ID,
        barIndex: i,
        closeMinor: qqqCloseForScenario(i),
      }),
    );
  }
  return Object.freeze(bars);
}

export function m09ChronologicalManifest(): EvaluationDatasetManifest {
  const bars = syntheticM09BarSeries();
  const observations = bars.map((bar) =>
    buildChronologicalObservation({
      observationId: bar.observationId,
      instrumentId: bar.instrumentId,
      sourceEventTime: bar.sourceEventTime,
      sunreyArrivalTime: bar.knowableAt,
      ingestionTime: bar.knowableAt,
      providerId: bar.providerId,
      providerSequence: bar.providerSequence,
      openMinor: bar.openMinor,
      highMinor: bar.highMinor,
      lowMinor: bar.lowMinor,
      closeMinor: bar.closeMinor,
      bidMinor: bar.bidMinor,
      askMinor: bar.askMinor,
      available: bar.available,
      sessionOpen: bar.sessionState === 'OPEN',
    }),
  );

  const frozen = freezeEvaluationDatasetManifest({
    version: 'edmf-m09-spy-qqq-15m-v1',
    instruments: Object.freeze([M09_SPY_INSTRUMENT_ID, M09_QQQ_INSTRUMENT_ID]),
    membership: Object.freeze([
      { instrumentId: M09_SPY_INSTRUMENT_ID, enteredAt: asUtcInstant(`${BASE_DAY}T00:00:00.000Z`), leftAt: null },
      { instrumentId: M09_QQQ_INSTRUMENT_ID, enteredAt: asUtcInstant(`${BASE_DAY}T00:00:00.000Z`), leftAt: null },
    ]),
    timeRange: {
      start: asUtcInstant(`${BASE_DAY}T14:00:00.000Z`),
      end: asUtcInstant('2026-04-05T16:45:00.000Z'),
    },
    providerIds: Object.freeze(['fixture_m09']),
    datasetIds: Object.freeze(['fixture_m09_spy_qqq_15m']),
    corporateActionHandling: 'INVESTMENTS_SPLIT_DIVIDEND_SEMANTICS',
    corporateActionVersion: 'corp-m09-v1',
    degradedPeriods: Object.freeze([]),
    feedEntitlement: 'SYNTHETIC_FIXTURE',
    gapsExplicit: Object.freeze([]),
    limitations: Object.freeze([
      'HELIOS M09 synthetic 15-minute SPY/QQQ fixture — not live market data.',
      'Includes engineered dislocation window for mean-reversion entry tests.',
    ]),
    observations: Object.freeze(observations),
    corporateActions: Object.freeze([]),
  });
  if (!frozen.ok) {
    throw new Error(frozen.error.message);
  }
  return frozen.value;
}

export function barsFromManifest(manifest: EvaluationDatasetManifest): readonly M09BarObservation[] {
  return Object.freeze(
    manifest.observations.map((obs) =>
      Object.freeze({
        instrumentId: obs.instrumentId,
        barInterval: '15m' as const,
        sourceEventTime: obs.informationTime.sourceEventTime,
        knowableAt: obs.informationTime.knowableAt,
        closeMinor: obs.closeMinor,
        openMinor: obs.openMinor,
        highMinor: obs.highMinor,
        lowMinor: obs.lowMinor,
        bidMinor: obs.bidMinor,
        askMinor: obs.askMinor,
        spreadBps:
          obs.bidMinor !== null && obs.askMinor !== null && obs.closeMinor > 0n
            ? ((obs.askMinor - obs.bidMinor) * 10_000n) / obs.closeMinor
            : null,
        available: obs.available,
        sessionState: obs.sessionOpen ? ('OPEN' as const) : ('CLOSED' as const),
        marketState: obs.degraded ? ('DEGRADED' as const) : obs.available ? ('NORMAL' as const) : ('UNAVAILABLE' as const),
        liquidityState: 'NORMAL' as const,
        marketRegime: 'MEAN_REVERTING' as const,
        providerId: obs.providerId,
        providerSequence: obs.providerSequence,
        observationId: obs.observationId,
      }),
    ),
  );
}
