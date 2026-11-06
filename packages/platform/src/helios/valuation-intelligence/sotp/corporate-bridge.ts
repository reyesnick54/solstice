/**
 * Corporate-level bridge after segment valuation.
 */

import type { CorporateAdjustment, CorporateAdjustmentBridge } from './types.ts';

export function buildCorporateAdjustmentBridge(
  segmentEnterpriseTotalMinor: bigint,
  adjustments: readonly CorporateAdjustment[],
): CorporateAdjustmentBridge {
  let net = 0n;
  for (const row of adjustments) {
    if (row.sign === 'ADD') {
      net += row.amountMinor;
    } else {
      net -= row.amountMinor;
    }
  }

  const bridgedEnterprise = segmentEnterpriseTotalMinor;
  const bridgedEquity = segmentEnterpriseTotalMinor + net;

  return Object.freeze({
    segmentEnterpriseTotalMinor,
    adjustments: Object.freeze([...adjustments]),
    netAdjustmentMinor: net,
    bridgedEquityMinor: bridgedEquity,
    bridgedEnterpriseMinor: bridgedEnterprise,
  });
}
