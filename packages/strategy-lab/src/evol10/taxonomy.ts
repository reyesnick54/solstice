/**
 * HELIOS EVOL10 — regime dimensions for strategy generalization analysis.
 *
 * Maps HELIOS M13 market regimes and optional macro observations into a
 * stable cross-strategy vocabulary. Macro tags are optional; when absent,
 * only price/volatility/liquidity/risk labels from M13 apply.
 */

import type { MarketRegimeDimension } from '@solstice/platform/helios/regime';

/** EVOL10 economic-environment dimensions (analysis labels, not trade signals). */
export const HELIOS_EVOL10_REGIME_DIMENSIONS = [
  'bull',
  'bear',
  'sideways',
  'high_volatility',
  'low_volatility',
  'inflationary',
  'disinflationary',
  'rising_rates',
  'falling_rates',
  'liquidity_expansion',
  'liquidity_contraction',
  'risk_on',
  'risk_off',
] as const;

export type HeliosEvol10RegimeDimension = (typeof HELIOS_EVOL10_REGIME_DIMENSIONS)[number];

/** Stress-related EVOL10 labels (subset used for tail checks). */
export const HELIOS_EVOL10_STRESS_REGIME_DIMENSIONS: readonly HeliosEvol10RegimeDimension[] = Object.freeze([
  'high_volatility',
  'liquidity_contraction',
  'risk_off',
  'bear',
]);

/**
 * Optional point-in-time macro observations (knowable at `asOf`).
 * Callers must not pass values derived from future regime labels.
 */
export type HeliosEvol10MacroObservation = {
  readonly asOf: string;
  /** Headline CPI or PCE YoY in basis points (e.g. 320 = 3.20%). */
  readonly headlineInflationYoYBps?: number;
  /** Signed change in policy rate over the knowable window (basis points). */
  readonly policyRateChangeBps?: number;
};

function pushUnique(out: HeliosEvol10RegimeDimension[], tag: HeliosEvol10RegimeDimension): void {
  if (!out.includes(tag)) {
    out.push(tag);
  }
}

/**
 * Map M13 dimensions to EVOL10 tags (historical classifier output only).
 */
export function mapM13DimensionsToEvol10(
  dimensions: readonly MarketRegimeDimension[],
): readonly HeliosEvol10RegimeDimension[] {
  const out: HeliosEvol10RegimeDimension[] = [];
  for (const d of dimensions) {
    switch (d) {
      case 'TRENDING_UP':
        pushUnique(out, 'bull');
        break;
      case 'TRENDING_DOWN':
        pushUnique(out, 'bear');
        break;
      case 'RANGE_BOUND':
        pushUnique(out, 'sideways');
        break;
      case 'HIGH_VOLATILITY':
        pushUnique(out, 'high_volatility');
        break;
      case 'LOW_VOLATILITY':
        pushUnique(out, 'low_volatility');
        break;
      case 'LIQUIDITY_STRESS':
        pushUnique(out, 'liquidity_contraction');
        break;
      case 'NORMAL_LIQUIDITY':
        pushUnique(out, 'liquidity_expansion');
        break;
      case 'RISK_ON':
        pushUnique(out, 'risk_on');
        break;
      case 'RISK_OFF':
        pushUnique(out, 'risk_off');
        break;
      default:
        break;
    }
  }
  return Object.freeze(out);
}

/**
 * Optional macro-derived tags. Thresholds are engineering defaults for simulation analysis.
 */
export function mapMacroObservationToEvol10(
  macro: HeliosEvol10MacroObservation | undefined,
): readonly HeliosEvol10RegimeDimension[] {
  if (macro === undefined) {
    return Object.freeze([]);
  }
  const out: HeliosEvol10RegimeDimension[] = [];
  const inf = macro.headlineInflationYoYBps;
  if (inf !== undefined) {
    if (inf >= 300) {
      pushUnique(out, 'inflationary');
    } else if (inf <= 150) {
      pushUnique(out, 'disinflationary');
    }
  }
  const dr = macro.policyRateChangeBps;
  if (dr !== undefined) {
    if (dr >= 25) {
      pushUnique(out, 'rising_rates');
    } else if (dr <= -25) {
      pushUnique(out, 'falling_rates');
    }
  }
  return Object.freeze(out);
}

export function mergeEvol10Tags(
  m13: readonly HeliosEvol10RegimeDimension[],
  macro: readonly HeliosEvol10RegimeDimension[],
): readonly HeliosEvol10RegimeDimension[] {
  const out: HeliosEvol10RegimeDimension[] = [...m13];
  for (const t of macro) {
    pushUnique(out, t);
  }
  return Object.freeze(out);
}
