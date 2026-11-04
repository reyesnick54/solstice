export const EARN06_EARNINGS_QUALITY_MODULE =
  'packages/platform/src/helios/earnings-intelligence/earn06-earnings-quality.ts' as const;

export function assessEarningsQuality(input: {
  readonly accrualsRatioBps: number;
  readonly cashConversionBps: number;
}): { readonly qualityScoreBps: number; readonly flagged: boolean } {
  const qualityScoreBps = Math.max(
    0,
    Math.min(10_000, input.cashConversionBps - Math.abs(input.accrualsRatioBps)),
  );
  const flagged = input.accrualsRatioBps > 2_500 || input.cashConversionBps < 4_000;
  return Object.freeze({ qualityScoreBps, flagged });
}
