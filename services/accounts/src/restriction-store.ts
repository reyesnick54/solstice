import {
  freezeAccountRestriction,
  type AccountRestriction,
  type AccountRestrictionCode,
} from '../../../packages/domain/src/account-restriction.ts';
import type { AccountId } from '../../../packages/domain/src/account.ts';

export class RestrictionStore {
  private readonly byId = new Map<string, AccountRestriction>();

  put(restriction: AccountRestriction): AccountRestriction {
    const frozen = freezeAccountRestriction(restriction);
    this.byId.set(frozen.id, frozen);
    return frozen;
  }

  get(id: string): AccountRestriction | undefined {
    return this.byId.get(id);
  }

  list(): readonly AccountRestriction[] {
    return [...this.byId.values()];
  }

  listByAccount(accountId: AccountId | string): readonly AccountRestriction[] {
    return this.list().filter((row) => row.accountId === accountId);
  }

  activeFor(accountId: AccountId | string): readonly AccountRestriction[] {
    return this.listByAccount(accountId).filter((row) => row.state === 'ACTIVE');
  }

  hasActive(accountId: AccountId | string, code: AccountRestrictionCode): boolean {
    return this.activeFor(accountId).some((row) => row.code === code);
  }

  hydrate(rows: readonly AccountRestriction[]): void {
    this.byId.clear();
    for (const row of rows) {
      this.put(row);
    }
  }

  snapshot(): readonly AccountRestriction[] {
    return this.list();
  }
}

export class FinancialAccountOverlayStore {
  private readonly byAccount = new Map<string, import('./product-account.ts').FinancialAccountOverlay>();

  put(overlay: import('./product-account.ts').FinancialAccountOverlay): void {
    this.byAccount.set(overlay.accountId, Object.freeze({ ...overlay, metadata: Object.freeze({ ...overlay.metadata }) }));
  }

  get(accountId: string): import('./product-account.ts').FinancialAccountOverlay | undefined {
    return this.byAccount.get(accountId);
  }

  list(): readonly import('./product-account.ts').FinancialAccountOverlay[] {
    return [...this.byAccount.values()];
  }

  hydrate(rows: readonly import('./product-account.ts').FinancialAccountOverlay[]): void {
    this.byAccount.clear();
    for (const row of rows) {
      this.put(row);
    }
  }
}
