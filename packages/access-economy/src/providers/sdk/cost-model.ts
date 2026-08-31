/**
 * ACCESS Wave 2 — Provider cost metadata.
 *
 * Discount is commercial metadata only. It is not fiat funding.
 */

export const PROVIDER_COST_FIELDS = [
  'retailPrice',
  'contractedPrice',
  'providerCost',
  'discount',
  'commission',
  'subsidy',
] as const;

export type ProviderCostField = (typeof PROVIDER_COST_FIELDS)[number];

export type ProviderCostMetadata = {
  readonly currency: string;
  readonly retailPriceMinorUnits: bigint | null;
  readonly contractedPriceMinorUnits: bigint | null;
  readonly providerCostMinorUnits: bigint | null;
  readonly discountMinorUnits: bigint | null;
  readonly commissionMinorUnits: bigint | null;
  readonly subsidyMinorUnits: bigint | null;
};

export function buildProviderCostMetadata(input: {
  readonly currency: string;
  readonly retailPriceMinorUnits?: bigint | null;
  readonly contractedPriceMinorUnits?: bigint | null;
  readonly providerCostMinorUnits?: bigint | null;
  readonly discountMinorUnits?: bigint | null;
  readonly commissionMinorUnits?: bigint | null;
  readonly subsidyMinorUnits?: bigint | null;
}): ProviderCostMetadata {
  return Object.freeze({
    currency: input.currency,
    retailPriceMinorUnits: input.retailPriceMinorUnits ?? null,
    contractedPriceMinorUnits: input.contractedPriceMinorUnits ?? null,
    providerCostMinorUnits: input.providerCostMinorUnits ?? null,
    discountMinorUnits: input.discountMinorUnits ?? null,
    commissionMinorUnits: input.commissionMinorUnits ?? null,
    subsidyMinorUnits: input.subsidyMinorUnits ?? null,
  });
}
