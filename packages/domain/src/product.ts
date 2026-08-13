import type { AccountClass } from './account-class.ts';
import { type Brand, brandAs } from './brand.ts';
import type { CurrencyCode } from './currency.ts';
import type { Jurisdiction } from './jurisdiction.ts';
import type { LegalEntityId } from './legal-entity.ts';

export type ProductId = Brand<string, 'ProductId'>;

export function asProductId(value: string): ProductId {
  if (value.length === 0) {
    throw new TypeError('ProductId must be a non-empty string');
  }
  return brandAs<string, 'ProductId'>(value);
}

export const PRODUCT_STATUSES = ['ACTIVE', 'RETIRED'] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

/**
 * A bookable product: one account class, one currency, one legal entity,
 * one jurisdiction. Structural validators compare an OPEN_ACCOUNT intent
 * against this record. This is not authorization.
 */
export type Product = {
  readonly id: ProductId;
  readonly name: string;
  readonly accountClass: AccountClass;
  readonly currency: CurrencyCode;
  readonly legalEntityId: LegalEntityId;
  readonly jurisdiction: Jurisdiction;
  readonly status: ProductStatus;
};

export function freezeProduct(product: Product): Product {
  return Object.freeze({
    id: product.id,
    name: product.name,
    accountClass: product.accountClass,
    currency: product.currency,
    legalEntityId: product.legalEntityId,
    jurisdiction: product.jurisdiction,
    status: product.status,
  });
}

export type ProductCatalog = {
  get(id: ProductId): Product | undefined;
  list(): readonly Product[];
};

export function createProductCatalog(products: readonly Product[]): ProductCatalog {
  const byId = new Map<string, Product>();
  for (const product of products) {
    byId.set(product.id, freezeProduct(product));
  }
  return {
    get(id: ProductId): Product | undefined {
      return byId.get(id);
    },
    list(): readonly Product[] {
      return [...byId.values()];
    },
  };
}
