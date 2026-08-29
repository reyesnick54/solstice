export const ACCESS_ID_PREFIXES = Object.freeze({
  quote: 'aq',
  allocation: 'ad',
  capacity: 'cap',
  resource: 'ar',
} as const);

export type AccessQuoteId = string & { readonly __brand: 'AccessQuoteId' };
export type AllocationDecisionId = string & { readonly __brand: 'AllocationDecisionId' };
export type AccessResourceId = string & { readonly __brand: 'AccessResourceId' };
export type VerifiedCapacityId = string & { readonly __brand: 'VerifiedCapacityId' };

export function asAccessQuoteId(value: string): AccessQuoteId {
  return value as AccessQuoteId;
}

export function asAllocationDecisionId(value: string): AllocationDecisionId {
  return value as AllocationDecisionId;
}

export function asAccessResourceId(value: string): AccessResourceId {
  return value as AccessResourceId;
}

export function asVerifiedCapacityId(value: string): VerifiedCapacityId {
  return value as VerifiedCapacityId;
}
