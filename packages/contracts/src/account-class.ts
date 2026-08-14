/**
 * Product account classes visible on the customer position.
 * Distinct from ledger posting classes (CUSTOMER/SIMULATION/…).
 */
export const PRODUCT_ACCOUNT_CLASSES = [
  'deposits',
  'investments',
  'digital_assets',
  'rewards',
  'pending',
] as const;

export type ProductAccountClass = (typeof PRODUCT_ACCOUNT_CLASSES)[number];

export const RISK_CEILINGS = ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'] as const;
export type RiskCeiling = (typeof RISK_CEILINGS)[number];

const RISK_RANK: { readonly [R in RiskCeiling]: number } = {
  CONSERVATIVE: 0,
  MODERATE: 1,
  AGGRESSIVE: 2,
};

export function riskRank(ceiling: RiskCeiling): number {
  return RISK_RANK[ceiling];
}

export function isRiskCeiling(value: unknown): value is RiskCeiling {
  return typeof value === 'string' && (RISK_CEILINGS as readonly string[]).includes(value);
}

export function isProductAccountClass(value: unknown): value is ProductAccountClass {
  return (
    typeof value === 'string' &&
    (PRODUCT_ACCOUNT_CLASSES as readonly string[]).includes(value)
  );
}
