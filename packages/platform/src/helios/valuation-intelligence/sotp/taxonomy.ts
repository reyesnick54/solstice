/**
 * HELIOS VAL09 — sum-of-the-parts and segment valuation taxonomy.
 */

export const VAL09_SOTP_SCHEMA = 'helios.valuation-intelligence.val09-sotp.v1' as const;

export const VAL09_SOTP_MODULE = 'VAL09_SOTP' as const;

export const HELIOS_VAL09_SOTP_QUALIFIED = 'HELIOS_VAL09_SOTP_QUALIFIED' as const;

export const HELIOS_VAL09_SOTP_BLOCKED = 'HELIOS_VAL09_SOTP_BLOCKED' as const;

/** Per-segment valuation methods (independent of consolidated method choice). */
export const SEGMENT_VALUATION_METHODS = [
  'DCF_FCFF',
  'DCF_FCFE',
  'RESIDUAL_INCOME',
  'COMPARABLE_MULTIPLES',
  'ASSET_BASED',
  'DIVIDEND_DISCOUNT',
] as const;

export type SegmentValuationMethod = (typeof SEGMENT_VALUATION_METHODS)[number];

export const SEGMENT_LIFECYCLE_EVENTS = [
  'REPORTED',
  'RENAMED',
  'REORGANIZED',
  'ACQUIRED',
  'DISPOSED',
  'SPIN_OFF',
  'REPORTING_STRUCTURE_CHANGE',
] as const;

export type SegmentLifecycleEventKind = (typeof SEGMENT_LIFECYCLE_EVENTS)[number];

export const CORPORATE_ADJUSTMENT_KINDS = [
  'CORPORATE_OVERHEAD',
  'UNALLOCATED_COSTS',
  'NET_DEBT',
  'CASH',
  'PENSIONS',
  'LEASE_LIABILITIES',
  'MINORITY_INTEREST',
  'NON_CONTROLLING_INTEREST',
  'CROSS_HOLDINGS',
  'ASSOCIATES_JVS',
  'PREFERRED_EQUITY',
  'OPTION_DILUTION',
  'SHARE_COUNT',
] as const;

export type CorporateAdjustmentKind = (typeof CORPORATE_ADJUSTMENT_KINDS)[number];

export const INTERSEGMENT_FLOW_KINDS = [
  'INTERSEGMENT_REVENUE',
  'TRANSFER_PRICING',
  'ELIMINATION',
] as const;

export type IntersegmentFlowKind = (typeof INTERSEGMENT_FLOW_KINDS)[number];
