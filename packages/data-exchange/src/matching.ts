import type { CustomerId } from '@solstice/domain';
import type { DataRequest } from './request.ts';
import type { EligibilityVault } from './vault.ts';

/**
 * Buyer-facing match result. Intentionally contains no customer ids,
 * names, or other individual identifiers.
 */
export type BuyerMatchResult = {
  readonly requestId: string;
  readonly eligibleCount: bigint;
  readonly matchJobId: string;
};

export type CustomerOpportunity = {
  readonly requestId: string;
  readonly customerId: CustomerId;
  readonly purpose: string;
  readonly dataCategories: readonly string[];
  readonly compensationMinorUnits: bigint;
  readonly jurisdiction: string;
};

export function matchWithoutIdentities(
  request: DataRequest,
  vault: EligibilityVault,
): { readonly buyerView: BuyerMatchResult; readonly opportunities: readonly CustomerOpportunity[] } {
  const opportunities: CustomerOpportunity[] = [];
  for (const profile of vault.list()) {
    if (profile.jurisdiction !== request.jurisdiction) continue;
    const hasCategory = request.dataCategories.every((cat) =>
      profile.eligibleCategories.includes(cat),
    );
    if (!hasCategory) continue;
    const tokensOk = request.cohortCriteria.every((token) => profile.cohortTokens.includes(token));
    if (!tokensOk) continue;
    opportunities.push(
      Object.freeze({
        requestId: request.id,
        customerId: profile.customerId,
        purpose: request.purpose,
        dataCategories: request.dataCategories,
        compensationMinorUnits: request.compensationMinorUnits,
        jurisdiction: request.jurisdiction,
      }),
    );
  }
  const buyerView: BuyerMatchResult = Object.freeze({
    requestId: request.id,
    eligibleCount: BigInt(opportunities.length),
    matchJobId: `match_${request.id}`,
  });
  return {
    buyerView,
    opportunities: Object.freeze(opportunities),
  };
}

export function opportunitiesFor(
  customerId: CustomerId,
  all: readonly CustomerOpportunity[],
): readonly CustomerOpportunity[] {
  return all.filter((row) => row.customerId === customerId);
}
