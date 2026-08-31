import type { Result } from '../../../domain/src/result.ts';
import type { AccessDomainFailure } from './types.ts';
import type {
  AccessAllocation,
  AccessCapacity,
  AccessCategory,
  AccessEntitlement,
  AccessProduct,
  AccessQuote,
  AccessRedemption,
  AccessReservation,
  AccessSettlement,
  AccessTransaction,
} from './types.ts';
import type { AccessCategoryId, AccessUnit } from './taxonomy.ts';
import type { AccessCapacityId, AccessDomainTransactionId, AccessUserId } from './ids.ts';

export type AccessCatalogService = {
  readonly getCategories: () => readonly AccessCategory[];
  readonly getCategory: (id: AccessCategoryId) => AccessCategory | null;
  readonly getProducts: (category?: AccessCategoryId) => readonly AccessProduct[];
  readonly getProduct: (accessProductId: AccessProduct['accessProductId']) => AccessProduct | null;
  readonly getUnits: () => readonly AccessUnit[];
};

export type AccessCapacityQuery = {
  readonly category?: AccessCategoryId;
  readonly capacityId?: AccessCapacityId;
  readonly accessProductId?: AccessProduct['accessProductId'];
};

export type AccessCapacityService = {
  readonly getCapacity: (query: AccessCapacityQuery) => readonly AccessCapacity[];
  readonly getCapacityById: (capacityId: AccessCapacityId) => AccessCapacity | null;
};

export type AccessEntitlementService = {
  readonly getEntitlements: (userId: AccessUserId) => readonly AccessEntitlement[];
  readonly getEntitlement: (
    entitlementId: AccessEntitlement['entitlementId'],
  ) => AccessEntitlement | null;
};

export type AccessTransactionService = {
  readonly getTransaction: (transactionId: AccessDomainTransactionId) => AccessTransaction | null;
  readonly getTransactions: (userId: AccessUserId) => readonly AccessTransaction[];
};

/** In-memory simulation store for Prompt 28 domain operations only. */
export type AccessDomainStore = {
  readonly categories: Map<AccessCategoryId, AccessCategory>;
  readonly products: Map<string, AccessProduct>;
  readonly capacities: Map<string, AccessCapacity>;
  readonly entitlements: Map<string, AccessEntitlement>;
  readonly allocations: Map<string, AccessAllocation>;
  readonly quotes: Map<string, AccessQuote>;
  readonly reservations: Map<string, AccessReservation>;
  readonly redemptions: Map<string, AccessRedemption>;
  readonly settlements: Map<string, AccessSettlement>;
  readonly transactions: Map<string, AccessTransaction>;
};

export function createAccessDomainStore(seed?: Partial<AccessDomainStore>): AccessDomainStore {
  return Object.freeze({
    categories: new Map(seed?.categories ?? []),
    products: new Map(seed?.products ?? []),
    capacities: new Map(seed?.capacities ?? []),
    entitlements: new Map(seed?.entitlements ?? []),
    allocations: new Map(seed?.allocations ?? []),
    quotes: new Map(seed?.quotes ?? []),
    reservations: new Map(seed?.reservations ?? []),
    redemptions: new Map(seed?.redemptions ?? []),
    settlements: new Map(seed?.settlements ?? []),
    transactions: new Map(seed?.transactions ?? []),
  });
}

export function createAccessCatalogService(store: AccessDomainStore): AccessCatalogService {
  return Object.freeze({
    getCategories: () => [...store.categories.values()],
    getCategory: (id) => store.categories.get(id) ?? null,
    getProducts: (category) =>
      [...store.products.values()].filter((product) => !category || product.category === category),
    getProduct: (accessProductId) => store.products.get(accessProductId) ?? null,
    getUnits: () => [...new Set([...store.categories.values()].map((c) => c.defaultUnit))],
  });
}

export function createAccessCapacityService(store: AccessDomainStore): AccessCapacityService {
  return Object.freeze({
    getCapacity: (query) =>
      [...store.capacities.values()].filter((capacity) => {
        if (query.capacityId && capacity.capacityId !== query.capacityId) {
          return false;
        }
        if (query.category && capacity.category !== query.category) {
          return false;
        }
        if (query.accessProductId && capacity.accessProductId !== query.accessProductId) {
          return false;
        }
        return true;
      }),
    getCapacityById: (capacityId) => store.capacities.get(capacityId) ?? null,
  });
}

export function createAccessEntitlementService(store: AccessDomainStore): AccessEntitlementService {
  return Object.freeze({
    getEntitlements: (userId) =>
      [...store.entitlements.values()].filter((entitlement) => entitlement.userId === userId),
    getEntitlement: (entitlementId) => store.entitlements.get(entitlementId) ?? null,
  });
}

export function createAccessTransactionService(store: AccessDomainStore): AccessTransactionService {
  return Object.freeze({
    getTransaction: (transactionId) => store.transactions.get(transactionId) ?? null,
    getTransactions: (userId) =>
      [...store.transactions.values()].filter((transaction) => transaction.userId === userId),
  });
}

export type AccessDomainServices = {
  readonly catalog: AccessCatalogService;
  readonly capacity: AccessCapacityService;
  readonly entitlement: AccessEntitlementService;
  readonly transaction: AccessTransactionService;
};

export function createAccessDomainServices(store: AccessDomainStore): AccessDomainServices {
  return Object.freeze({
    catalog: createAccessCatalogService(store),
    capacity: createAccessCapacityService(store),
    entitlement: createAccessEntitlementService(store),
    transaction: createAccessTransactionService(store),
  });
}

export type AccessDomainOperationResult<T> = Result<T, AccessDomainFailure>;
