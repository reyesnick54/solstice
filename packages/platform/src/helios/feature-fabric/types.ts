/**
 * HELIOS OS10 — point-in-time corporate fundamental feature types.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';

export const HELIOS_FUNDAMENTAL_FEATURE_SCHEMA = 'sunrey.helios.fundamental-feature.v1' as const;

export const FUNDAMENTAL_FEATURE_IDS = [
  'revenue',
  'revenue_growth',
  'gross_margin',
  'operating_margin',
  'fcf',
  'fcf_margin',
  'roic_proxy',
  'cash',
  'debt',
  'net_debt',
  'share_count',
  'capex',
  'sbc',
  'working_capital_change',
] as const;

export type FundamentalFeatureId = (typeof FUNDAMENTAL_FEATURE_IDS)[number];

export type FundamentalFeatureValue = {
  readonly featureId: FundamentalFeatureId;
  readonly supported: boolean;
  readonly valueMinor: bigint | null;
  readonly ratio: string | null;
  readonly unit: string | null;
  readonly fiscalPeriod: string | null;
  readonly reportPeriod: string | null;
  readonly sourceFilingId: string | null;
  readonly evidenceRef: string | null;
  readonly knowableAt: UtcInstant | null;
};

export type PointInTimeFundamentalSnapshot = {
  readonly schema: typeof HELIOS_FUNDAMENTAL_FEATURE_SCHEMA;
  readonly canonicalEntityId: string;
  readonly evaluationTimeUtc: UtcInstant;
  readonly features: Readonly<Record<FundamentalFeatureId, FundamentalFeatureValue>>;
};
