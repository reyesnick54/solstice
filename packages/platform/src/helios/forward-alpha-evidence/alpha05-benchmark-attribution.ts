/**
 * ALPHA05 — benchmark attribution (excess vs declared benchmark, integer minor units).
 */

export const HELIOS_ALPHA05_BENCHMARK_ATTRIBUTION = 'HELIOS_ALPHA05_BENCHMARK_ATTRIBUTION' as const;

export function attributeExcessMinor(
  portfolioPnlMinor: bigint,
  benchmarkPnlMinor: bigint,
): { readonly excessMinor: bigint; readonly trackingDiffMinor: bigint } {
  const excessMinor = portfolioPnlMinor - benchmarkPnlMinor;
  return Object.freeze({
    excessMinor,
    trackingDiffMinor: excessMinor,
  });
}

export function selectionEffectMinor(
  portfolioWeightsBps: readonly number[],
  benchmarkWeightsBps: readonly number[],
  activeReturnsMinor: readonly bigint[],
): bigint {
  if (
    portfolioWeightsBps.length !== benchmarkWeightsBps.length ||
    portfolioWeightsBps.length !== activeReturnsMinor.length
  ) {
    throw new Error('attribution: dimension mismatch');
  }
  let effect = 0n;
  for (let i = 0; i < portfolioWeightsBps.length; i++) {
    const dw = portfolioWeightsBps[i]! - benchmarkWeightsBps[i]!;
    effect += (BigInt(dw) * activeReturnsMinor[i]!) / 10_000n;
  }
  return effect;
}
