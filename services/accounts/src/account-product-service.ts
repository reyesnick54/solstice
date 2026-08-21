import { randomUUID } from 'node:crypto';

import { transitionAccountStatus, type Account } from '../../../packages/domain/src/account.ts';
import {
  asAccountRestrictionId,
  freezeAccountRestriction,
  type AccountRestriction,
  type AccountRestrictionCode,
} from '../../../packages/domain/src/account-restriction.ts';
import type { CustomerId } from '../../../packages/domain/src/customer.ts';
import { err, isErr, isOk, ok, type Result } from '../../../packages/domain/src/result.ts';
import type { UtcInstant } from '../../../packages/domain/src/time.ts';
import type { CustomerStatement } from '../../../packages/domain/src/statement.ts';
import type { CustomerActivityItem } from '../../../packages/domain/src/customer-activity.ts';
import type { Clock } from '../../../packages/config/src/clock.ts';
import type { EvidenceVault } from '../../../packages/evidence/src/vault.ts';
import type { DomainEvent, DomainEventLog } from '../../../packages/events/src/events.ts';
import type { Ledger } from '../../../packages/ledger/src/journal.ts';
import { ResourceOwnershipRegistry, type SolsticeIdentityId } from '../../../packages/identity/src/index.ts';
import type { IdentityService } from '../../../packages/identity/src/service.ts';
import { filterActivity, normalizeActivityItem, type ActivityFilter } from './activity.ts';
import { projectBankingPosition, type BankingPosition } from './available-funds.ts';
import { assertLifecycleTransition } from './account-lifecycle.ts';
import {
  assembleFinancialAccount,
  deriveLifecycle,
  type CustomerFinancialAccount,
  type FinancialAccountLifecycle,
  type FinancialAccountOverlay,
} from './product-account.ts';
import { FinancialAccountOverlayStore, RestrictionStore } from './restriction-store.ts';
import { generateAccountStatement } from './statements.ts';
import { projectTransactionHistory } from './transaction-history.ts';
import type { AccountStore } from './stores.ts';
import type { HoldStore } from './hold-store.ts';
import { projectCustomerWealth, unavailableFxValuation, type FxValuationPort, type WealthValuation } from './wealth.ts';

export type AccountProductDenial = {
  readonly code: string;
  readonly message: string;
};

/**
 * Customer-facing Account Service product/orchestration layer.
 * Ledger remains the accounting authority. This service never stores a
 * mutable balance and never issues Execution Authority.
 */
export class AccountProductService {
  private readonly accounts: AccountStore;
  private readonly ledger: Ledger;
  private readonly holds: HoldStore;
  private readonly clock: Clock;
  private readonly evidence: EvidenceVault;
  private readonly events: DomainEventLog;
  readonly restrictions: RestrictionStore;
  readonly overlays: FinancialAccountOverlayStore;
  readonly ownership: ResourceOwnershipRegistry;
  private readonly identity: IdentityService | undefined;
  private readonly persist:
    | {
        persistRestriction?(restriction: AccountRestriction): Promise<void>;
        persistOverlay?(overlay: FinancialAccountOverlay): Promise<void>;
      }
    | undefined;

  constructor(input: {
    readonly accounts: AccountStore;
    readonly ledger: Ledger;
    readonly holds: HoldStore;
    readonly clock: Clock;
    readonly evidence: EvidenceVault;
    readonly events: DomainEventLog;
    readonly restrictions?: RestrictionStore;
    readonly overlays?: FinancialAccountOverlayStore;
    readonly ownership?: ResourceOwnershipRegistry;
    readonly identity?: IdentityService;
    readonly persist?: {
      persistRestriction?(restriction: AccountRestriction): Promise<void>;
      persistOverlay?(overlay: FinancialAccountOverlay): Promise<void>;
    };
  }) {
    this.accounts = input.accounts;
    this.ledger = input.ledger;
    this.holds = input.holds;
    this.clock = input.clock;
    this.evidence = input.evidence;
    this.events = input.events;
    this.restrictions = input.restrictions ?? new RestrictionStore();
    this.overlays = input.overlays ?? new FinancialAccountOverlayStore();
    this.ownership = input.ownership ?? new ResourceOwnershipRegistry();
    this.identity = input.identity;
    this.persist = input.persist;
  }

  noteOpened(account: Account, actorId: string): CustomerFinancialAccount {
    const overlay: FinancialAccountOverlay = {
      accountId: account.id,
      lifecycle: null,
      closedAt: null,
      providerLink: null,
      metadata: Object.freeze({ openedByActorId: actorId }),
    };
    this.overlays.put(overlay);
    this.registerOwnership(account, actorId);
    this.emitLifecycle(account, 'AccountActivated', {
      accountId: account.id,
      ownerId: account.ownerId,
      fromStatus: 'PENDING',
      toStatus: 'ACTIVE',
      accountVersion: account.version,
    });
    return this.project(account);
  }

  listForCustomer(customerId: CustomerId | string): readonly CustomerFinancialAccount[] {
    return this.accounts
      .list()
      .filter((account) => account.ownerId === customerId)
      .map((account) => this.project(account))
      .sort((a, b) => a.accountId.localeCompare(b.accountId));
  }

  get(accountId: string): CustomerFinancialAccount | undefined {
    const account = this.accounts.get(accountId as Account['id']);
    return account ? this.project(account) : undefined;
  }

  authorizeRead(
    accountId: string,
    customerId: string,
    subjectId: string | null,
  ): Result<CustomerFinancialAccount, AccountProductDenial> {
    const account = this.accounts.get(accountId as Account['id']);
    if (!account) {
      return err({ code: 'NOT_FOUND', message: 'account not found' });
    }
    if (account.ownerId !== customerId) {
      return err({ code: 'RESOURCE_NOT_OWNED', message: 'account is not owned by the authenticated customer' });
    }
    if (subjectId) {
      const registered = this.ownership.get('account', accountId);
      if (registered) {
        const owned = this.ownership.assertOwnedBySubject('account', accountId, subjectId as SolsticeIdentityId);
        if (isErr(owned)) {
          return err({ code: 'RESOURCE_NOT_OWNED', message: 'account is not owned by the authenticated subject' });
        }
      }
    }
    return ok(this.project(account));
  }

  balanceOf(accountId: string): Result<
    BankingPosition & { readonly posted: BankingPosition['ledgerBalance'] },
    AccountProductDenial
  > {
    const account = this.accounts.get(accountId as Account['id']);
    if (!account) {
      return err({ code: 'NOT_FOUND', message: 'account not found' });
    }
    const projected = projectBankingPosition(this.ledger, account, this.holds, this.clock.now());
    if (isErr(projected)) {
      return err({ code: projected.error.code, message: projected.error.message });
    }
    return ok(
      Object.freeze({
        ...projected.value,
        posted: projected.value.ledgerBalance,
      }),
    );
  }

  activity(customerId: string, accountId: string | undefined, filter: ActivityFilter = {}): readonly CustomerActivityItem[] {
    const owned = this.accounts.list().filter((account) => account.ownerId === customerId);
    const items = projectTransactionHistory({
      ledger: this.ledger,
      customerId: customerId as CustomerId,
      accounts: owned,
      holds: owned.flatMap((account) => this.holds.listByAccount(account.id)),
      pending: [],
      now: this.clock.now() as UtcInstant,
    }).map(normalizeActivityItem);
    const scoped = accountId ? items.filter((item) => item.accountId === accountId) : items;
    return filterActivity(scoped, filter).slice().sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0));
  }

  statement(input: {
    readonly accountId: string;
    readonly periodStart: UtcInstant;
    readonly periodEnd: UtcInstant;
  }): Result<CustomerStatement, AccountProductDenial> {
    const account = this.accounts.get(input.accountId as Account['id']);
    if (!account) {
      return err({ code: 'NOT_FOUND', message: 'account not found' });
    }
    if (input.periodEnd < input.periodStart) {
      return err({ code: 'INVALID_PERIOD', message: 'statement periodEnd must be on or after periodStart' });
    }
    return ok(
      generateAccountStatement({
        ledger: this.ledger,
        account,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        generatedAt: this.clock.now() as UtcInstant,
      }),
    );
  }

  wealth(customerId: string, valuationCurrency: string, fx: FxValuationPort = unavailableFxValuation): WealthValuation {
    const owned = this.accounts.list().filter((account) => account.ownerId === customerId);
    const projected = projectCustomerWealth(
      this.ledger,
      customerId as CustomerId,
      owned,
      valuationCurrency,
      fx,
    );
    if (isErr(projected)) {
      return {
        kind: 'UNAVAILABLE',
        valuationCurrency,
        valuationStatus: 'UNAVAILABLE',
        currencies: projected.error.currencies,
        reason: projected.error.message,
      };
    }
    return projected.value;
  }

  applyRestriction(input: {
    readonly accountId: string;
    readonly code: AccountRestrictionCode;
    readonly reason: string;
    readonly actorId: string;
  }): Result<AccountRestriction, AccountProductDenial> {
    const account = this.accounts.get(input.accountId as Account['id']);
    if (!account) {
      return err({ code: 'NOT_FOUND', message: 'account not found' });
    }
    const existing = this.restrictions
      .activeFor(account.id)
      .find((row) => row.code === input.code);
    if (existing) {
      return ok(existing);
    }
    const now = this.clock.now() as UtcInstant;
    const restriction = freezeAccountRestriction({
      id: asAccountRestrictionId(`rst_${randomUUID()}`),
      accountId: account.id,
      code: input.code,
      state: 'ACTIVE',
      reason: input.reason,
      appliedAt: now,
      releasedAt: null,
      appliedByActorId: input.actorId,
    });
    this.restrictions.put(restriction);
    this.evidence.seal('ACCOUNT_RESTRICTED', {
      accountId: account.id,
      restriction: input.code,
      reason: input.reason,
      actorId: input.actorId,
    });
    this.emitLifecycle(account, 'AccountRestricted', {
      accountId: account.id,
      ownerId: account.ownerId,
      restriction: input.code,
      reason: input.reason,
      accountVersion: account.version,
    });
    void this.persist?.persistRestriction?.(restriction);
    return ok(restriction);
  }

  releaseRestriction(input: {
    readonly accountId: string;
    readonly code: AccountRestrictionCode;
    readonly actorId: string;
  }): Result<AccountRestriction, AccountProductDenial> {
    const current = this.restrictions.activeFor(input.accountId).find((row) => row.code === input.code);
    if (!current) {
      return err({ code: 'NOT_FOUND', message: 'active restriction not found' });
    }
    const released = freezeAccountRestriction({
      ...current,
      state: 'RELEASED',
      releasedAt: this.clock.now() as UtcInstant,
    });
    this.restrictions.put(released);
    this.evidence.seal('ACCOUNT_RESTRICTION_RELEASED', {
      accountId: input.accountId,
      restriction: input.code,
      actorId: input.actorId,
    });
    void this.persist?.persistRestriction?.(released);
    return ok(released);
  }

  /**
   * Server-controlled lifecycle. Clients cannot POST status=ACTIVE.
   */
  transitionLifecycle(input: {
    readonly accountId: string;
    readonly to: FinancialAccountLifecycle;
    readonly actorId: string;
  }): Result<CustomerFinancialAccount, AccountProductDenial> {
    const account = this.accounts.get(input.accountId as Account['id']);
    if (!account) {
      return err({ code: 'NOT_FOUND', message: 'account not found' });
    }
    const current = this.project(account);
    if (input.to === 'CLOSING' || input.to === 'CLOSED') {
      const balance = this.balanceOf(account.id);
      if (isOk(balance) && balance.value.posted.minorUnits !== 0n) {
        return err({
          code: 'ACCOUNT_HAS_BALANCE',
          message: 'server-controlled close requires a zero posted ledger balance',
        });
      }
    }
    const allowed = assertLifecycleTransition(current.status, input.to, account);
    if (isErr(allowed)) {
      return err({ code: allowed.error.code, message: allowed.error.message });
    }
    let nextAccount = account;
    if (allowed.value) {
      const moved = transitionAccountStatus(account, allowed.value, this.clock.now() as UtcInstant);
      if (!isOk(moved)) {
        return err({ code: moved.error.code, message: `illegal domain transition ${moved.error.from} → ${moved.error.to}` });
      }
      nextAccount = moved.value.account;
      this.accounts.put(nextAccount.id, nextAccount);
    }
    const overlay: FinancialAccountOverlay = {
      accountId: nextAccount.id,
      lifecycle: input.to === 'CLOSING' ? 'CLOSING' : input.to === 'CLOSED' ? 'CLOSED' : null,
      closedAt: input.to === 'CLOSED' ? (this.clock.now() as UtcInstant) : null,
      providerLink: this.overlays.get(nextAccount.id)?.providerLink ?? null,
      metadata: Object.freeze({
        ...(this.overlays.get(nextAccount.id)?.metadata ?? {}),
        lastLifecycleActorId: input.actorId,
      }),
    };
    this.overlays.put(overlay);
    this.evidence.seal('ACCOUNT_LIFECYCLE_CHANGED', {
      accountId: nextAccount.id,
      from: current.status,
      to: input.to,
      actorId: input.actorId,
    });
    if (input.to === 'CLOSED') {
      this.emitLifecycle(nextAccount, 'AccountClosed', {
        accountId: nextAccount.id,
        ownerId: nextAccount.ownerId,
        fromStatus: current.status,
        toStatus: 'CLOSED',
        accountVersion: nextAccount.version,
      });
    } else if (input.to === 'ACTIVE' && current.status === 'PENDING') {
      this.emitLifecycle(nextAccount, 'AccountActivated', {
        accountId: nextAccount.id,
        ownerId: nextAccount.ownerId,
        fromStatus: current.status,
        toStatus: 'ACTIVE',
        accountVersion: nextAccount.version,
      });
    } else if (input.to === 'RESTRICTED') {
      this.emitLifecycle(nextAccount, 'AccountRestricted', {
        accountId: nextAccount.id,
        ownerId: nextAccount.ownerId,
        restriction: 'COMPLIANCE_REVIEW',
        reason: 'server-controlled restriction',
        accountVersion: nextAccount.version,
      });
    }
    void this.persist?.persistOverlay?.(overlay);
    return ok(this.project(nextAccount));
  }

  registerOwnership(account: Account, actorId: string): void {
    const identityId =
      this.identity?.store.identityByCustomer.get(account.ownerId) ??
      this.identity?.store.identityByActor.get(actorId) ??
      null;
    if (!identityId) {
      return;
    }
    this.ownership.register({
      kind: 'account',
      id: account.id,
      ownerSubjectId: identityId,
      ownerCustomerId: account.ownerId,
      ownerActorId: actorId,
    });
  }

  private project(account: Account): CustomerFinancialAccount {
    return assembleFinancialAccount(
      account,
      this.restrictions.listByAccount(account.id),
      this.overlays.get(account.id) ?? null,
    );
  }

  private emitLifecycle(
    account: Account,
    eventType: 'AccountActivated' | 'AccountRestricted' | 'AccountClosed',
    payload: Record<string, unknown>,
  ): void {
    this.events.append({
      eventType,
      schemaVersion: 1,
      occurredAt: this.clock.now() as UtcInstant,
      aggregateType: 'account',
      aggregateId: account.id,
      payload,
    } as unknown as DomainEvent);
  }
}

export function lifecycleOf(
  account: Account,
  restrictions: RestrictionStore,
  overlays: FinancialAccountOverlayStore,
): FinancialAccountLifecycle {
  return deriveLifecycle(account.status, restrictions.listByAccount(account.id), overlays.get(account.id) ?? null);
}
