import type { AccountClass } from './account-class.ts';
import { type Brand, brandAs } from './brand.ts';
import type { Currency } from './currency.ts';
import type { LegalEntityId } from './legal-entity.ts';

export type ProductId = Brand<string, 'ProductId'>;

export function asProductId(value: string): ProductId {
  if (value.length === 0) {
    throw new TypeError('ProductId must be a non-empty string');
  }
  return brandAs<string, 'ProductId'>(value);
}

/**
 * A catalog product is bound to exactly one account class and one currency.
 * Eligibility and offering rules live in jurisdiction packs, not here.
 */
export type Product = {
  readonly id: ProductId;
  readonly accountClass: AccountClass;
  readonly currency: Currency;
  readonly legalEntityId: LegalEntityId;
};

export type CreateProductInput = {
  readonly id: ProductId;
  readonly accountClass: AccountClass;
  readonly currency: Currency;
  readonly legalEntityId: LegalEntityId;
};

export function createProduct(input: CreateProductInput): Product {
  return Object.freeze({
    id: input.id,
    accountClass: input.accountClass,
    currency: input.currency,
    legalEntityId: input.legalEntityId,
  });
}

export type ProductCatalog = {
  readonly products: readonly Product[];
};

export function lookupProduct(
  catalog: ProductCatalog,
  productId: ProductId,
): Product | undefined {
  return catalog.products.find((product) => product.id === productId);
}
