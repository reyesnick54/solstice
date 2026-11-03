/**
 * Canonical OHLCV bar columns (OpenChart `common/market` parity).
 */

export const OHLCV_BAR_COLUMNS = ['open', 'high', 'low', 'close', 'volume'] as const;
export type OhlcvBarColumn = (typeof OHLCV_BAR_COLUMNS)[number];

export type OhlcvBar = {
  readonly timeMs: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
  readonly final?: boolean;
};

export function isValidOhlcvBar(bar: OhlcvBar): boolean {
  if (!Number.isSafeInteger(bar.timeMs)) return false;
  for (const key of OHLCV_BAR_COLUMNS) {
    const value = bar[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  }
  if (bar.high < bar.low) return false;
  if (bar.open > bar.high || bar.open < bar.low) return false;
  if (bar.close > bar.high || bar.close < bar.low) return false;
  return true;
}
