import type { Account, AccountId } from '../../packages/domain/src/account.ts';
import type { Customer, CustomerId } from '../../packages/domain/src/customer.ts';
import type { LegalEntity, LegalEntityId } from '../../packages/domain/src/legal-entity.ts';
import type { Product, ProductId } from '../../packages/domain/src/product.ts';

export class InMemoryMap<K extends string, V> {
  private readonly items = new Map<string, V>();

  put(id: K, value: V): void {
    this.items.set(id, value);
  }

  get(id: K): V | undefined {
    return this.items.get(id);
  }

  has(id: K): boolean {
    return this.items.has(id);
  }

  list(): readonly V[] {
    return [...this.items.values()];
  }
}

export class CustomerStore extends InMemoryMap<CustomerId, Customer> {}
export class AccountStore extends InMemoryMap<AccountId, Account> {
  listByOwner(ownerId: CustomerId): readonly Account[] {
    return this.list().filter((account) => account.ownerId === ownerId);
  }
}
export class LegalEntityStore extends InMemoryMap<LegalEntityId, LegalEntity> {}
export class ProductStore extends InMemoryMap<ProductId, Product> {
  asCatalog() {
    return {
      get: (id: ProductId) => this.get(id),
      list: () => this.list(),
    };
  }
}
