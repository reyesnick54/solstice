export type PurchaseIntentId = string & { readonly __brand: 'PurchaseIntentId' };
export type MerchantOfferId = string & { readonly __brand: 'MerchantOfferId' };
export type MerchantExchangeMerchantId = string & { readonly __brand: 'MerchantExchangeMerchantId' };
export type MerchantPurchaseId = string & { readonly __brand: 'MerchantPurchaseId' };

export function asPurchaseIntentId(value: string): PurchaseIntentId {
  return value as PurchaseIntentId;
}

export function asMerchantOfferId(value: string): MerchantOfferId {
  return value as MerchantOfferId;
}

export function asMerchantExchangeMerchantId(value: string): MerchantExchangeMerchantId {
  return value as MerchantExchangeMerchantId;
}

export function asMerchantPurchaseId(value: string): MerchantPurchaseId {
  return value as MerchantPurchaseId;
}

export function newPurchaseIntentId(prefix = 'pint'): PurchaseIntentId {
  return asPurchaseIntentId(`${prefix}_${crypto.randomUUID()}`);
}

export function newMerchantOfferId(prefix = 'moff'): MerchantOfferId {
  return asMerchantOfferId(`${prefix}_${crypto.randomUUID()}`);
}

export function newMerchantPurchaseId(prefix = 'mpur'): MerchantPurchaseId {
  return asMerchantPurchaseId(`${prefix}_${crypto.randomUUID()}`);
}
