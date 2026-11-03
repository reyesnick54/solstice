/** Simple moving average; leading values are NaN until `length` samples exist. */
export function computeSma(values: readonly number[], length: number): number[] {
  if (!Number.isInteger(length) || length < 1) {
    throw new Error('SMA length must be a positive integer');
  }
  const out: number[] = [];
  for (let i = 0; i < values.length; i += 1) {
    if (i + 1 < length) {
      out.push(Number.NaN);
      continue;
    }
    let sum = 0;
    for (let j = i - length + 1; j <= i; j += 1) {
      sum += values[j]!;
    }
    out.push(sum / length);
  }
  return out;
}

/** Exponential moving average (smoothing 2 / (length + 1)). */
export function computeEma(values: readonly number[], length: number): number[] {
  if (!Number.isInteger(length) || length < 1) {
    throw new Error('EMA length must be a positive integer');
  }
  const alpha = 2 / (length + 1);
  const out: number[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i]!;
    if (i === 0) {
      out.push(value);
      continue;
    }
    const prev = out[i - 1]!;
    out.push(Number.isNaN(prev) ? value : alpha * value + (1 - alpha) * prev);
  }
  return out;
}

function wilderRma(values: readonly number[], length: number): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i]!;
    if (i < length) {
      sum += value;
      out.push(i + 1 === length ? sum / length : Number.NaN);
      continue;
    }
    const prev = out[i - 1]!;
    out.push((prev * (length - 1) + value) / length);
  }
  return out;
}

/** Relative strength index (Wilder smoothing), OpenChart `ta.rsi` compatible. */
export function computeRsi(values: readonly number[], length: number): number[] {
  if (!Number.isInteger(length) || length < 1) {
    throw new Error('RSI length must be a positive integer');
  }
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 0; i < values.length; i += 1) {
    if (i === 0) {
      gains.push(0);
      losses.push(0);
      continue;
    }
    const delta = values[i]! - values[i - 1]!;
    gains.push(delta > 0 ? delta : 0);
    losses.push(delta < 0 ? -delta : 0);
  }
  const avgGain = wilderRma(gains, length);
  const avgLoss = wilderRma(losses, length);
  return values.map((_, i) => {
    const gain = avgGain[i]!;
    const loss = avgLoss[i]!;
    if (Number.isNaN(gain) || Number.isNaN(loss)) return Number.NaN;
    if (loss === 0) return gain === 0 ? 50 : 100;
    const rs = gain / loss;
    return 100 - 100 / (1 + rs);
  });
}

/** Average true range (Wilder). */
export function computeAtr(
  highs: readonly number[],
  lows: readonly number[],
  closes: readonly number[],
  length: number,
): number[] {
  if (highs.length !== lows.length || lows.length !== closes.length) {
    throw new Error('ATR inputs must have equal length');
  }
  const tr: number[] = [];
  for (let i = 0; i < closes.length; i += 1) {
    if (i === 0) {
      tr.push(highs[i]! - lows[i]!);
      continue;
    }
    const hl = highs[i]! - lows[i]!;
    const hc = Math.abs(highs[i]! - closes[i - 1]!);
    const lc = Math.abs(lows[i]! - closes[i - 1]!);
    tr.push(Math.max(hl, hc, lc));
  }
  return wilderRma(tr, length);
}

export type MacdResult = {
  readonly macd: readonly number[];
  readonly signal: readonly number[];
  readonly histogram: readonly number[];
};

export function computeMacd(
  values: readonly number[],
  fastLength: number,
  slowLength: number,
  signalLength: number,
): MacdResult {
  const fast = computeEma(values, fastLength);
  const slow = computeEma(values, slowLength);
  const macd = values.map((_, i) => fast[i]! - slow[i]!);
  const signal = computeEma(macd, signalLength);
  const histogram = macd.map((value, i) => value - signal[i]!);
  return Object.freeze({ macd, signal, histogram });
}

export function crossover(seriesA: readonly number[], seriesB: readonly number[] | number): boolean[] {
  const bSeries =
    typeof seriesB === 'number' ? seriesA.map(() => seriesB) : seriesB;
  if (seriesA.length !== bSeries.length) {
    throw new Error('crossover series must have equal length');
  }
  const out: boolean[] = [];
  for (let i = 0; i < seriesA.length; i += 1) {
    if (i === 0) {
      out.push(false);
      continue;
    }
    const prevA = seriesA[i - 1]!;
    const prevB = bSeries[i - 1]!;
    const curA = seriesA[i]!;
    const curB = bSeries[i]!;
    out.push(prevA <= prevB && curA > curB);
  }
  return out;
}

export function crossunder(seriesA: readonly number[], seriesB: readonly number[] | number): boolean[] {
  const bSeries =
    typeof seriesB === 'number' ? seriesA.map(() => seriesB) : seriesB;
  if (seriesA.length !== bSeries.length) {
    throw new Error('crossunder series must have equal length');
  }
  const out: boolean[] = [];
  for (let i = 0; i < seriesA.length; i += 1) {
    if (i === 0) {
      out.push(false);
      continue;
    }
    const prevA = seriesA[i - 1]!;
    const prevB = bSeries[i - 1]!;
    const curA = seriesA[i]!;
    const curB = bSeries[i]!;
    out.push(prevA >= prevB && curA < curB);
  }
  return out;
}
