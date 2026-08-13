/**
 * The thirteen typed account classes. These did not exist in the repository
 * before Phase 1; this is the canonical catalog.
 *
 * Customer position reporting rolls these into five buckets (deposits,
 * investments, digital_assets, rewards, pending). Corporate, simulation,
 * and bridge classes never appear in a customer position total.
 */
export const ACCOUNT_CLASSES = [
  'DEMAND_DEPOSIT',
  'SAVINGS_DEPOSIT',
  'TIME_DEPOSIT',
  'BROKERAGE_CASH',
  'SECURITIES',
  'RETIREMENT',
  'DIGITAL_ASSET_CUSTODY',
  'STABLECOIN_CUSTODY',
  'REWARDS',
  'PENDING_SETTLEMENT',
  'CLASS_BRIDGE',
  'SIMULATED_FUNDING_SOURCE',
  'CORPORATE_OPERATING',
] as const;

export type AccountClass = (typeof ACCOUNT_CLASSES)[number];

export const POSITION_BUCKETS = [
  'deposits',
  'investments',
  'digital_assets',
  'rewards',
  'pending',
] as const;

export type PositionBucket = (typeof POSITION_BUCKETS)[number];

export type InsuranceClassification = 'insured' | 'at_risk';
export type RealizationClassification = 'realized' | 'unrealized' | 'pending';

export type FundOwnership = 'CUSTOMER' | 'CORPORATE' | 'SIMULATION' | 'SYSTEM';

export type AccountClassRecord = {
  readonly accountClass: AccountClass;
  readonly fundOwnership: FundOwnership;
  readonly positionBucket: PositionBucket | null;
  readonly insurance: InsuranceClassification | null;
  readonly realization: RealizationClassification | null;
};

export const ACCOUNT_CLASS_CATALOG: {
  readonly [C in AccountClass]: AccountClassRecord & { readonly accountClass: C };
} = {
  DEMAND_DEPOSIT: {
    accountClass: 'DEMAND_DEPOSIT',
    fundOwnership: 'CUSTOMER',
    positionBucket: 'deposits',
    insurance: 'insured',
    realization: 'realized',
  },
  SAVINGS_DEPOSIT: {
    accountClass: 'SAVINGS_DEPOSIT',
    fundOwnership: 'CUSTOMER',
    positionBucket: 'deposits',
    insurance: 'insured',
    realization: 'realized',
  },
  TIME_DEPOSIT: {
    accountClass: 'TIME_DEPOSIT',
    fundOwnership: 'CUSTOMER',
    positionBucket: 'deposits',
    insurance: 'insured',
    realization: 'realized',
  },
  BROKERAGE_CASH: {
    accountClass: 'BROKERAGE_CASH',
    fundOwnership: 'CUSTOMER',
    positionBucket: 'investments',
    insurance: 'at_risk',
    realization: 'realized',
  },
  SECURITIES: {
    accountClass: 'SECURITIES',
    fundOwnership: 'CUSTOMER',
    positionBucket: 'investments',
    insurance: 'at_risk',
    realization: 'unrealized',
  },
  RETIREMENT: {
    accountClass: 'RETIREMENT',
    fundOwnership: 'CUSTOMER',
    positionBucket: 'investments',
    insurance: 'at_risk',
    realization: 'realized',
  },
  DIGITAL_ASSET_CUSTODY: {
    accountClass: 'DIGITAL_ASSET_CUSTODY',
    fundOwnership: 'CUSTOMER',
    positionBucket: 'digital_assets',
    insurance: 'at_risk',
    realization: 'realized',
  },
  STABLECOIN_CUSTODY: {
    accountClass: 'STABLECOIN_CUSTODY',
    fundOwnership: 'CUSTOMER',
    positionBucket: 'digital_assets',
    insurance: 'at_risk',
    realization: 'realized',
  },
  REWARDS: {
    accountClass: 'REWARDS',
    fundOwnership: 'CUSTOMER',
    positionBucket: 'rewards',
    insurance: 'at_risk',
    realization: 'realized',
  },
  PENDING_SETTLEMENT: {
    accountClass: 'PENDING_SETTLEMENT',
    fundOwnership: 'CUSTOMER',
    positionBucket: 'pending',
    insurance: 'at_risk',
    realization: 'pending',
  },
  CLASS_BRIDGE: {
    accountClass: 'CLASS_BRIDGE',
    fundOwnership: 'SYSTEM',
    positionBucket: null,
    insurance: null,
    realization: null,
  },
  SIMULATED_FUNDING_SOURCE: {
    accountClass: 'SIMULATED_FUNDING_SOURCE',
    fundOwnership: 'SIMULATION',
    positionBucket: null,
    insurance: null,
    realization: null,
  },
  CORPORATE_OPERATING: {
    accountClass: 'CORPORATE_OPERATING',
    fundOwnership: 'CORPORATE',
    positionBucket: null,
    insurance: null,
    realization: null,
  },
};

export function isAccountClass(value: unknown): value is AccountClass {
  return typeof value === 'string' && (ACCOUNT_CLASSES as readonly string[]).includes(value);
}

export function catalogFor(accountClass: AccountClass): AccountClassRecord {
  return ACCOUNT_CLASS_CATALOG[accountClass];
}

export function isCustomerFundedClass(accountClass: AccountClass): boolean {
  return ACCOUNT_CLASS_CATALOG[accountClass].fundOwnership === 'CUSTOMER';
}
