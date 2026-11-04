/**
 * HELIOS EARN02 — earnings event observation taxonomy (external-data plane).
 */

export const EARNINGS_EXTERNAL_OBSERVATION_SCHEMA = 'sunrey.external.earnings-observation.v1' as const;

export const EARNINGS_PROVIDER_KINDS = [
  'SEC_EDGAR',
  'ISSUER_IR',
  'EARNINGS_CALENDAR',
  'ANALYST_ESTIMATE',
  'TRANSCRIPT',
  'MARKET_DATA',
  'OPTIONS',
] as const;
export type EarningsProviderKind = (typeof EARNINGS_PROVIDER_KINDS)[number];

export const EARNINGS_ARTIFACT_KINDS = [
  'EXPECTED_EVENT',
  'CONFIRMED_ANNOUNCEMENT',
  'EARNINGS_RELEASE',
  'SEC_8K_2_02',
  'SEC_8K_7_01',
  'SEC_EX99',
  'SEC_10Q',
  'SEC_10K',
  'SEC_6K',
  'FINANCIAL_SUPPLEMENT',
  'CONFERENCE_CALL',
  'GUIDANCE',
  'ANALYST_REVISION',
  'MARKET_REACTION',
] as const;
export type EarningsArtifactKind = (typeof EARNINGS_ARTIFACT_KINDS)[number];

export const EARNINGS_SESSION_TIMING = ['BEFORE_MARKET', 'AFTER_MARKET', 'DURING_MARKET', 'UNKNOWN'] as const;
export type EarningsSessionTiming = (typeof EARNINGS_SESSION_TIMING)[number];

export const SEC_EARNINGS_FORMS = ['8-K', '8-K/A', '6-K', '6-K/A', '10-Q', '10-K', '10-Q/A', '10-K/A'] as const;
export type SecEarningsForm = (typeof SEC_EARNINGS_FORMS)[number];

export const SEC_8K_ITEMS = ['2.02', '7.01'] as const;
export type Sec8kItem = (typeof SEC_8K_ITEMS)[number];
