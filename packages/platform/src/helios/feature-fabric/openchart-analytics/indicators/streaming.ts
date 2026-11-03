import { computeEma, computeSma } from './math.ts';

export type StreamingSmaState = {
  readonly kind: 'sma';
  readonly length: number;
  readonly window: number[];
};

export type StreamingEmaState = {
  readonly kind: 'ema';
  readonly length: number;
  readonly alpha: number;
  readonly value: number | null;
};

export function createStreamingSma(length: number): StreamingSmaState {
  if (!Number.isInteger(length) || length < 1) {
    throw new Error('streaming SMA length must be a positive integer');
  }
  return Object.freeze({ kind: 'sma', length, window: [] });
}

export function pushStreamingSma(state: StreamingSmaState, value: number): { readonly state: StreamingSmaState; readonly value: number } {
  const window = [...state.window, value];
  if (window.length > state.length) {
    window.shift();
  }
  const next = Object.freeze({ ...state, window });
  if (window.length < state.length) {
    return { state: next, value: Number.NaN };
  }
  const sum = window.reduce((acc, v) => acc + v, 0);
  return { state: next, value: sum / state.length };
}

export function createStreamingEma(length: number): StreamingEmaState {
  if (!Number.isInteger(length) || length < 1) {
    throw new Error('streaming EMA length must be a positive integer');
  }
  return Object.freeze({ kind: 'ema', length, alpha: 2 / (length + 1), value: null });
}

export function pushStreamingEma(state: StreamingEmaState, sample: number): { readonly state: StreamingEmaState; readonly value: number } {
  const value =
    state.value === null ? sample : state.alpha * sample + (1 - state.alpha) * state.value;
  return {
    state: Object.freeze({ ...state, value }),
    value,
  };
}

/** Batch SMA via streaming must match vector SMA. */
export function smaSeriesViaStreaming(values: readonly number[], length: number): number[] {
  let state = createStreamingSma(length);
  return values.map((value) => {
    const step = pushStreamingSma(state, value);
    state = step.state;
    return step.value;
  });
}

export function emaSeriesViaStreaming(values: readonly number[], length: number): number[] {
  let state = createStreamingEma(length);
  return values.map((value) => {
    const step = pushStreamingEma(state, value);
    state = step.state;
    return step.value;
  });
}

/** Sanity: streaming matches batch for SMA/EMA. */
export function streamingMatchesBatchSma(values: readonly number[], length: number): boolean {
  const batch = computeSma(values, length);
  const stream = smaSeriesViaStreaming(values, length);
  return batch.every((value, i) => {
    const other = stream[i]!;
    return (Number.isNaN(value) && Number.isNaN(other)) || value === other;
  });
}
