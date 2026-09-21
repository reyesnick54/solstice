/**
 * HELIOS Multi-Asset M17 — deterministic correlation fixtures.
 */

import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import type { CorrelationBarObservation } from './types.ts';

export const M17_SPY = 'SECURITY:US:SPY:ARCX';
export const M17_QQQ = 'SECURITY:US:QQQ:XNAS';
export const M17_BTC = 'CRYPTO:BTC:bitcoin:native:USD';
export const M17_ETH = 'CRYPTO:ETH:ethereum:native:USD';
export const M17_GLD = 'SECURITY:US:GLD:ARCX';
export const M17_USO = 'SECURITY:US:USO:ARCX';
export const M17_EURUSD = 'FX:EURUSD:spot:USD';

const BASE = '2026-05-01T14:00:00.000Z';

function barAt(offsetMinutes: number): UtcInstant {
  const ms = Date.parse(BASE) + offsetMinutes * 60_000;
  return asUtcInstant(new Date(ms).toISOString());
}

function buildBar(input: {
  readonly instrumentId: string;
  readonly assetClass: string;
  readonly timeframe: CorrelationBarObservation['timeframe'];
  readonly index: number;
  readonly closeMinor: bigint;
  readonly knowableAt?: UtcInstant;
}): CorrelationBarObservation {
  const at = barAt(input.index * 15);
  return Object.freeze({
    instrumentId: input.instrumentId,
    assetClass: input.assetClass,
    timeframe: input.timeframe,
    sourceEventTime: at,
    knowableAt: input.knowableAt ?? at,
    closeMinor: input.closeMinor,
    observationId: `obs_m17_${input.instrumentId}_${input.index}`,
    providerId: 'fixture_m17',
  });
}

export function syntheticHighCorrelationSpyQqqSeries(barCount = 80): readonly CorrelationBarObservation[] {
  const bars: CorrelationBarObservation[] = [];
  let spyClose = 450_00n;
  let qqqClose = 380_00n;
  for (let i = 0; i < barCount; i += 1) {
    const spyDelta = 20n + BigInt((i * 7) % 11);
    const qqqDelta = (spyDelta * 85n) / 100n + BigInt((i * 2) % 3);
    spyClose += spyDelta;
    qqqClose += qqqDelta;
    bars.push(
      buildBar({
        instrumentId: M17_SPY,
        assetClass: 'etf',
        timeframe: '15m',
        index: i,
        closeMinor: spyClose,
      }),
    );
    bars.push(
      buildBar({
        instrumentId: M17_QQQ,
        assetClass: 'etf',
        timeframe: '15m',
        index: i,
        closeMinor: qqqClose,
      }),
    );
  }
  return Object.freeze(bars);
}

export function syntheticUnrelatedPairSeries(barCount = 80): readonly CorrelationBarObservation[] {
  const bars: CorrelationBarObservation[] = [];
  for (let i = 0; i < barCount; i += 1) {
    const gldClose = 180_00n + (i % 2 === 0 ? BigInt(i) * 5n : BigInt(i) * -3n);
    const btcClose = 60_000_00n + BigInt(i % 7) * 500n - BigInt(i % 5) * 300n;
    bars.push(
      buildBar({
        instrumentId: M17_GLD,
        assetClass: 'commodity',
        timeframe: '4h',
        index: i,
        closeMinor: gldClose,
      }),
    );
    bars.push(
      buildBar({
        instrumentId: M17_BTC,
        assetClass: 'crypto',
        timeframe: '1h',
        index: i,
        closeMinor: btcClose,
      }),
    );
  }
  return Object.freeze(bars);
}

export function syntheticNegativeCorrelationSeries(barCount = 80): readonly CorrelationBarObservation[] {
  const bars: CorrelationBarObservation[] = [];
  let spyClose = 450_00n;
  let usoClose = 70_00n;
  for (let i = 0; i < barCount; i += 1) {
    const spyDelta = 18n + BigInt((i * 3) % 7);
    const usoDelta = -((spyDelta * 70n) / 100n + BigInt((i * 2) % 4));
    spyClose += spyDelta;
    usoClose += usoDelta;
    bars.push(
      buildBar({
        instrumentId: M17_SPY,
        assetClass: 'etf',
        timeframe: '15m',
        index: i,
        closeMinor: spyClose,
      }),
    );
    bars.push(
      buildBar({
        instrumentId: M17_USO,
        assetClass: 'commodity',
        timeframe: '4h',
        index: i,
        closeMinor: usoClose,
      }),
    );
  }
  return Object.freeze(bars);
}

export function syntheticChangingCorrelationSeries(): readonly CorrelationBarObservation[] {
  const bars: CorrelationBarObservation[] = [];
  let spyClose = 450_00n;
  let qqqClose = 380_00n;
  for (let i = 0; i < 100; i += 1) {
    const spyDelta = 15n + BigInt((i * 2) % 5);
    spyClose += spyDelta;
    if (i < 50) {
      qqqClose += (spyDelta * 9n) / 10n + BigInt(i % 3);
    } else {
      qqqClose += BigInt((i % 9) * 18 - (i % 6) * 22);
    }
    bars.push(
      buildBar({
        instrumentId: M17_SPY,
        assetClass: 'etf',
        timeframe: '15m',
        index: i,
        closeMinor: spyClose,
      }),
    );
    bars.push(
      buildBar({
        instrumentId: M17_QQQ,
        assetClass: 'etf',
        timeframe: '15m',
        index: i,
        closeMinor: qqqClose,
      }),
    );
  }
  return Object.freeze(bars);
}

export function syntheticInsufficientHistorySeries(): readonly CorrelationBarObservation[] {
  const bars: CorrelationBarObservation[] = [];
  let spyClose = 450_00n;
  let qqqClose = 380_00n;
  for (let i = 0; i < 5; i += 1) {
    spyClose += 10n + BigInt(i);
    qqqClose += 8n + BigInt(i);
    bars.push(
      buildBar({
        instrumentId: M17_SPY,
        assetClass: 'etf',
        timeframe: '15m',
        index: i,
        closeMinor: spyClose,
      }),
    );
    bars.push(
      buildBar({
        instrumentId: M17_QQQ,
        assetClass: 'etf',
        timeframe: '15m',
        index: i,
        closeMinor: qqqClose,
      }),
    );
  }
  return Object.freeze(bars);
}

/** Same bars as high-correlation series; evaluate with `syntheticStaleAsOf()` to mark stale. */
export function syntheticStaleObservationSeries(): readonly CorrelationBarObservation[] {
  return syntheticHighCorrelationSpyQqqSeries(40);
}

export function syntheticStaleAsOf(): UtcInstant {
  return asUtcInstant('2026-05-02T20:00:00.000Z');
}

export function syntheticFutureLeakBar(asOf: UtcInstant): CorrelationBarObservation {
  const future = asUtcInstant(new Date(Date.parse(asOf) + 60 * 60_000).toISOString());
  return buildBar({
    instrumentId: M17_SPY,
    assetClass: 'etf',
    timeframe: '15m',
    index: 999,
    closeMinor: 999_00n,
    knowableAt: future,
  });
}

export const M17_INSTRUMENT_METADATA = Object.freeze({
  [M17_SPY]: Object.freeze({ instrumentId: M17_SPY, assetClass: 'etf', symbol: 'SPY' }),
  [M17_QQQ]: Object.freeze({ instrumentId: M17_QQQ, assetClass: 'etf', symbol: 'QQQ' }),
  [M17_BTC]: Object.freeze({ instrumentId: M17_BTC, assetClass: 'crypto', symbol: 'BTC' }),
  [M17_ETH]: Object.freeze({ instrumentId: M17_ETH, assetClass: 'crypto', symbol: 'ETH' }),
  [M17_GLD]: Object.freeze({ instrumentId: M17_GLD, assetClass: 'commodity', symbol: 'GLD' }),
  [M17_USO]: Object.freeze({ instrumentId: M17_USO, assetClass: 'commodity', symbol: 'USO' }),
  [M17_EURUSD]: Object.freeze({ instrumentId: M17_EURUSD, assetClass: 'fx', symbol: 'EURUSD' }),
});

/** As-of instant shortly after the last fixture bar (avoids false stale classification). */
export const M17_DEFAULT_AS_OF = asUtcInstant('2026-05-02T10:30:00.000Z');
