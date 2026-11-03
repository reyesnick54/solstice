/**
 * AAF07 market-data certification states.
 * Names describe verification progress — not regulatory approval.
 */

export const MARKET_DATA_CERTIFICATION_STATES = [
  'REGISTERED',
  'DOCS_VERIFIED',
  'CREDENTIAL_READY',
  'SANDBOX_VERIFIED',
  'TIMESTAMP_VERIFIED',
  'ENTITLEMENT_VERIFIED',
  'QUALITY_VERIFIED',
  'PAPER_DATA_APPROVED',
  'DEGRADED',
  'SUSPENDED',
] as const;

export type MarketDataCertificationState = (typeof MARKET_DATA_CERTIFICATION_STATES)[number];

export const MARKET_DATA_CERTIFICATION_STATE_RANK: Readonly<Record<MarketDataCertificationState, number>> =
  Object.freeze({
    SUSPENDED: -2,
    DEGRADED: -1,
    REGISTERED: 0,
    DOCS_VERIFIED: 1,
    CREDENTIAL_READY: 2,
    SANDBOX_VERIFIED: 3,
    TIMESTAMP_VERIFIED: 4,
    ENTITLEMENT_VERIFIED: 5,
    QUALITY_VERIFIED: 6,
    PAPER_DATA_APPROVED: 7,
  });

export function isAtLeastMarketDataCertificationState(
  current: MarketDataCertificationState,
  required: MarketDataCertificationState,
): boolean {
  return MARKET_DATA_CERTIFICATION_STATE_RANK[current] >= MARKET_DATA_CERTIFICATION_STATE_RANK[required];
}
