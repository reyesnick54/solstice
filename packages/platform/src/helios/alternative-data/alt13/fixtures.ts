/**
 * HELIOS ALT13 — simulation panel with core HELIOS planes and alt-data features.
 */

import { asUtcInstant } from '../../../../../domain/src/time.ts';

import type { Alt13EvaluationRow } from './types.ts';

function synthDemandShock(t: number): number {
  return Math.sin(t * 0.35) * 0.6 + Math.cos(t * 0.11) * 0.25;
}

export function seedAlt13ReferencePanel(periods = 48): readonly Alt13EvaluationRow[] {
  const rows: Alt13EvaluationRow[] = [];
  for (let t = 0; t < periods; t += 1) {
    const shock = synthDemandShock(t);
    const noise = Math.sin(t * 1.7) * 0.05;
    const job = shock + noise;
    const search = shock * 0.95 + noise * 0.5;
    const web = shock * 0.92 + noise * 0.3;
    const product = shock * 0.98 + noise * 0.2;
    const uniqueAlt = Math.cos(t * 0.9) * 0.4 + noise;
    const revenue = 100 + shock * 12 + uniqueAlt * 3;
    const margin = 0.22 + shock * 0.02 + uniqueAlt * 0.005;
    const regimeId = t % 24 < 12 ? 'EXPANSION' : 'SLOWDOWN';

    rows.push(
      Object.freeze({
        periodIndex: t,
        marketFeatures: Object.freeze({ mkt_ret: 0.01 + shock * 0.002, mkt_vol: 0.18 + Math.abs(shock) * 0.01 }),
        fundamentalsFeatures: Object.freeze({ fund_growth: 0.05 + shock * 0.01, fund_margin: margin - 0.01 }),
        earningsFeatures: Object.freeze({ earn_surprise: shock * 0.08, earn_revision: uniqueAlt * 0.02 }),
        valuationFeatures: Object.freeze({ val_multiple: 18 + shock, val_spread: 0.02 + uniqueAlt * 0.01 }),
        altFeatures: Object.freeze({
          alt_job_growth: job,
          alt_search_growth: search,
          alt_web_traffic: web,
          alt_product_demand: product,
          alt_unique_supply: uniqueAlt,
        }),
        targets: Object.freeze({
          REVENUE_FORECAST: revenue,
          MARGIN_FORECAST: margin,
          EARNINGS_SURPRISE: shock * 0.1,
          CAPEX_FORECAST: 20 + shock * 2,
          SUPPLY_DISRUPTION: uniqueAlt,
          VOLATILITY_RISK: Math.abs(shock) * 0.2,
          STOCK_RETURN_SECONDARY: shock * 0.05,
        }),
        binaryTargets: Object.freeze({
          EARNINGS_SURPRISE: shock > 0,
          SUPPLY_DISRUPTION: uniqueAlt > 0.1,
        }),
        regimeId,
      }),
    );
  }
  return Object.freeze(rows);
}

export const ALT13_REFERENCE_REGISTERED_AT = asUtcInstant('2026-11-07T09:00:00.000Z');
