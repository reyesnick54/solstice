/**
 * Deterministic fixtures for M13 regime qualification scenarios.
 */

import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import type { RegimeBarInput } from './types.ts';

const BASE = asUtcInstant('2026-09-20T14:00:00.000Z');

function barAt(index: number, closeMinor: bigint, overrides: Partial<RegimeBarInput> = {}): RegimeBarInput {
  const at = asUtcInstant(new Date(Date.parse(BASE) + index * 15 * 60 * 1000).toISOString());
  return Object.freeze({
    barId: `bar_m13_${index}`,
    closeMinor,
    highMinor: closeMinor + 20n,
    lowMinor: closeMinor - 20n,
    volume: '1000000',
    knowableAt: overrides.knowableAt ?? at,
    spreadBps: overrides.spreadBps ?? 5,
    ...overrides,
  });
}

export function trendingUpBars(count = 30): readonly RegimeBarInput[] {
  const bars: RegimeBarInput[] = [];
  let price = 100_00n;
  for (let i = 0; i < count; i += 1) {
    price += 25n;
    bars.push(barAt(i, price));
  }
  return Object.freeze(bars);
}

export function trendingDownBars(count = 30): readonly RegimeBarInput[] {
  const bars: RegimeBarInput[] = [];
  let price = 200_00n;
  for (let i = 0; i < count; i += 1) {
    price -= 30n;
    bars.push(barAt(i, price));
  }
  return Object.freeze(bars);
}

export function rangeBoundBars(count = 30): readonly RegimeBarInput[] {
  const bars: RegimeBarInput[] = [];
  const base = 150_00n;
  for (let i = 0; i < count; i += 1) {
    const offset = i % 2 === 0 ? 5n : -5n;
    bars.push(barAt(i, base + offset));
  }
  return Object.freeze(bars);
}

export function highVolatilityBars(count = 30): readonly RegimeBarInput[] {
  const bars: RegimeBarInput[] = [];
  let price = 100_00n;
  for (let i = 0; i < count; i += 1) {
    price += i % 2 === 0 ? 200n : -180n;
    bars.push(barAt(i, price));
  }
  return Object.freeze(bars);
}

export function lowVolatilityBars(count = 30): readonly RegimeBarInput[] {
  const bars: RegimeBarInput[] = [];
  let price = 100_00n;
  for (let i = 0; i < count; i += 1) {
    price += 1n;
    bars.push(barAt(i, price));
  }
  return Object.freeze(bars);
}

export function liquidityStressBars(count = 30, spreadBps = 150): readonly RegimeBarInput[] {
  return Object.freeze(
    trendingUpBars(count).map((bar, index) =>
      barAt(index, bar.closeMinor, { spreadBps, knowableAt: bar.knowableAt }),
    ),
  );
}

export function insufficientBars(): readonly RegimeBarInput[] {
  return Object.freeze(trendingUpBars(5));
}

export function staleFutureBars(count = 30): readonly RegimeBarInput[] {
  const future = asUtcInstant('2099-01-01T00:00:00.000Z');
  return Object.freeze(
    trendingUpBars(count).map((bar, index) => barAt(index, bar.closeMinor, { knowableAt: future })),
  );
}

export function fixtureNow(): UtcInstant {
  return asUtcInstant(new Date(Date.parse(BASE) + 30 * 15 * 60 * 1000).toISOString());
}
