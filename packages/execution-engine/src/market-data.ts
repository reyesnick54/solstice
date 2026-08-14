import type { UtcInstant } from '../../contracts/src/time.ts';
import { asUtcInstant } from '../../contracts/src/time.ts';
import type { SimulatedPrice } from '../../contracts/src/investment-types.ts';

const REPLAY_SHAPED: readonly bigint[] = Object.freeze([
  10_000n, 10_040n, 9_980n, 10_120n, 10_080n, 10_200n, 10_150n, 10_300n,
  10_250n, 10_180n, 10_220n, 10_400n, 10_360n, 10_280n, 10_340n, 10_500n,
]);

/**
 * Deterministic integer LCG. No Math.random, no floating-point prices.
 */
export function nextLcg(state: bigint): { readonly value: bigint; readonly state: bigint } {
  const next = (state * 1664525n + 1013904223n) & 0xffffffffn;
  return { value: next, state: next };
}

export type SimulatedSeries = {
  readonly instrumentId: string;
  readonly currency: string;
  readonly seed: bigint;
  readonly mode: 'SEEDED' | 'REPLAY';
  readonly points: readonly SimulatedPrice[];
};

export function simulatePriceSeries(input: {
  readonly instrumentId: string;
  readonly currency: string;
  readonly seed: bigint;
  readonly steps: number;
  readonly startMinorUnits: bigint;
  readonly volatilityBps: bigint;
  readonly startAt: UtcInstant;
  readonly stepMillis: bigint;
  readonly mode?: 'SEEDED' | 'REPLAY';
}): SimulatedSeries {
  const mode = input.mode ?? 'SEEDED';
  const points: SimulatedPrice[] = [];
  if (mode === 'REPLAY') {
    for (let i = 0; i < input.steps; i += 1) {
      const shaped = REPLAY_SHAPED[i % REPLAY_SHAPED.length]!;
      points.push(
        Object.freeze({
          instrumentId: input.instrumentId,
          minorUnitsPerShare: shaped,
          currency: input.currency,
          asOf: asUtcInstant(
            new Date(Date.parse(input.startAt) + Number(input.stepMillis) * i).toISOString(),
          ),
          source: 'SIMULATED_REPLAY',
        }),
      );
    }
    return { instrumentId: input.instrumentId, currency: input.currency, seed: input.seed, mode, points };
  }
  let state = input.seed;
  let price = input.startMinorUnits;
  for (let i = 0; i < input.steps; i += 1) {
    const step = nextLcg(state);
    state = step.state;
    const signed = step.value % 2n === 0n ? 1n : -1n;
    const deltaBps = (step.value % (input.volatilityBps + 1n)) * signed;
    price = price + (price * deltaBps) / 10_000n;
    if (price < 1n) price = 1n;
    points.push(
      Object.freeze({
        instrumentId: input.instrumentId,
        minorUnitsPerShare: price,
        currency: input.currency,
        asOf: asUtcInstant(
          new Date(Date.parse(input.startAt) + Number(input.stepMillis) * i).toISOString(),
        ),
        source: 'SIMULATED_SEEDED',
      }),
    );
  }
  return { instrumentId: input.instrumentId, currency: input.currency, seed: input.seed, mode, points };
}
