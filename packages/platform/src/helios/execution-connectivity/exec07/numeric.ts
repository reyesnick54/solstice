export function clampBps(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(-50_000, Math.min(50_000, Math.floor(value)));
}

export function bpsFromMinorDelta(deltaMinor: bigint, notionalMinor: bigint): number | null {
  if (notionalMinor <= 0n) {
    return null;
  }
  const scaled = (deltaMinor * 10_000n) / notionalMinor;
  return clampBps(Number(scaled));
}

export function signedSlippageMinor(input: {
  readonly side: 'BUY' | 'SELL';
  readonly benchmarkPriceMinor: bigint;
  readonly fillPriceMinor: bigint;
  readonly quantityUnits: bigint;
}): bigint {
  const perUnit = input.fillPriceMinor - input.benchmarkPriceMinor;
  const raw = perUnit * input.quantityUnits;
  return input.side === 'BUY' ? raw : -raw;
}

export function averageNullableBps(samples: readonly (number | null)[]): number | null {
  const values = samples.filter((row): row is number => row != null);
  if (values.length === 0) {
    return null;
  }
  const sum = values.reduce((acc, row) => acc + row, 0);
  return clampBps(sum / values.length);
}

export function rateBps(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return clampBps(Math.round((numerator * 10_000) / denominator));
}
